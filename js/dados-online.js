'use strict';
/* Camada de dados ONLINE (Supabase): login, tabelas, fotos/assinaturas e posição GPS.
   Mesma interface da camada local (DadosLocal). Veja banco/schema.sql e o README. */
var DadosOnline=(function(){
  var sb=null, snap={colaboradores:{},entregas:{},ocorrencias:{},catalogo:{}}, fila=Promise.resolve(), tmr=null, pos={};
  var TS={prazo:1,criadoEm:1,saidaEm:1,concluidoEm:1,retornoEm:1,em:1};
  var STR={empresa:1,veiculo:1,placa:1,telefone:1,cpf:1,matricula:1,obs:1,recebedor:1,endereco:1,codigo:1,motivo:1,usuario:1};
  var MAPA={
    colaboradores:{id:'id',nome:'nome',tipo:'tipo',empresa:'empresa',veiculo:'veiculo',placa:'placa',telefone:'telefone',usuario:'usuario',cpf:'cpf',matricula:'matricula',ativo:'ativo',token:'token',authId:'auth_id'},
    entregas:{id:'id',dia:'dia',cliente:'cliente',endereco:'endereco',motoristaId:'motorista_id',status:'status',prazo:'prazo',criadoEm:'criado_em',saidaEm:'saida_em',concluidoEm:'concluido_em',retornoEm:'retorno_em',itens:'itens',obs:'obs',recebedor:'recebedor',foto:'foto',assinatura:'assinatura',x:'x',y:'y',lat:'lat',lng:'lng'},
    ocorrencias:{id:'id',entregaId:'entrega_id',dia:'dia',tipo:'tipo',codigo:'codigo',motivo:'motivo',em:'em',motoristaId:'motorista_id'}
  };
  function cli(){
    if(!sb)sb=window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});
    return sb;
  }
  function toRow(tab,o){var m=MAPA[tab],r={};Object.keys(m).forEach(function(k){var v=o[k];r[m[k]]=(v===undefined?null:v);});return r;}
  function fromRow(tab,r){
    var m=MAPA[tab],o={};
    Object.keys(m).forEach(function(k){
      var v=r[m[k]];
      if(v!=null&&TS[k])v=new Date(v).toISOString();
      if(v==null&&STR[k])v='';
      o[k]=v;
    });
    if(tab==='colaboradores'){o.senha='';if(o.ativo==null)o.ativo=true;}
    if(tab==='entregas'&&typeof o.itens==='string')o.itens=JSON.parse(o.itens);
    return o;
  }
  function erro(e){return (e&&e.message)||String(e);}
  function falhou(r){if(r&&r.error)throw r.error;return r;}

  function perfilDe(uid){
    return cli().from('perfis').select('papel,colaborador_id').eq('auth_id',uid).maybeSingle().then(function(r){
      falhou(r);
      if(!r.data)return null;
      return r.data.papel==='admin'?{role:'admin'}:{role:'driver',id:r.data.colaborador_id,via:'login'};
    });
  }
  function maxNum(list,f){return list.reduce(function(m,x){var n=f(x);return n>m?n:m;},0);}

  function buscar(){
    var desde=dayKey(Date.now()-30*86400000);
    return Promise.all([
      cli().from('colaboradores').select('*'),
      cli().from('entregas').select('*').gte('dia',desde).order('id'),
      cli().from('ocorrencias').select('*').gte('dia',desde).order('id'),
      cli().from('catalogo').select('*').order('codigo')
    ]).then(function(rs){
      rs.forEach(falhou);
      var col=rs[0].data.map(function(r){return fromRow('colaboradores',r);});
      var ent=rs[1].data.map(function(r){return fromRow('entregas',r);});
      var oc=rs[2].data.map(function(r){return fromRow('ocorrencias',r);});
      var cat=rs[3].data.map(function(r){return [r.codigo,r.descricao||r.codigo];});
      return {v:1,demo:false,seedDay:todayKey(),
        seq:{ent:Math.max(1000,maxNum(ent,function(e){return e.id;})),oc:maxNum(oc,function(o){return o.id;}),col:maxNum(col,function(c){return parseInt(String(c.id).replace(/\D/g,''),10)||0;})},
        colaboradores:col,entregas:ent,ocorrencias:oc,catalogo:cat};
    });
  }
  function marcarSnap(d){
    snap={colaboradores:{},entregas:{},ocorrencias:{},catalogo:{}};
    d.colaboradores.forEach(function(x){snap.colaboradores[x.id]=JSON.stringify(x);});
    d.entregas.forEach(function(x){snap.entregas[x.id]=JSON.stringify(x);});
    d.ocorrencias.forEach(function(x){snap.ocorrencias[x.id]=JSON.stringify(x);});
    d.catalogo.forEach(function(x){snap.catalogo[x[0]]=x[1];});
  }
  function carregarPosicoes(){
    return cli().from('ultima_posicao').select('*').then(function(r){
      if(r.error)return;
      pos={};(r.data||[]).forEach(function(p){pos[p.motorista_id]={lat:p.lat,lng:p.lng,prec:p.precisao,em:new Date(p.em).toISOString()};});
    });
  }

  /* envia fotos/assinaturas para o Storage (bucket privado) e troca o data: pelo CAMINHO do arquivo */
  function subir(path,dataUrl){
    return fetch(dataUrl).then(function(r){return r.blob();}).then(function(b){
      return cli().storage.from('evidencias').upload(path,b,{upsert:false,contentType:b.type||'image/jpeg'});
    }).then(function(r){
      falhou(r);
      return path;
    });
  }
  /* o campo foto/assinatura guarda o caminho; registros antigos guardam o link público, de onde tiramos o caminho */
  var urls={}, urlsT=0;
  function caminho(v){
    if(!v)return null;
    v=String(v);
    if(v.indexOf('data:')===0||v==='exemplo')return null;
    var i=v.indexOf('/evidencias/');
    if(/^https?:/.test(v))return i>=0?decodeURIComponent(v.slice(i+12).split('?')[0]):null;
    return v;
  }
  /* pede ao Supabase links temporários (1 hora) para as fotos/assinaturas informadas */
  function assinar(lista){
    if(Date.now()-urlsT>50*60000){urls={};urlsT=Date.now();}
    var ps=lista.map(caminho).filter(function(p,i,a){return p&&!urls[p]&&a.indexOf(p)===i;});
    if(!ps.length)return Promise.resolve();
    return cli().storage.from('evidencias').createSignedUrls(ps,3600).then(function(r){
      (r.data||[]).forEach(function(x){if(x.signedUrl&&x.path)urls[x.path]=x.signedUrl;});
    }).catch(function(){});
  }
  function preparaEvidencias(e){
    var jobs=[];
    if(e.foto&&String(e.foto).indexOf('data:')===0)jobs.push(subir('entrega-'+e.id+'/foto-'+Date.now()+'.jpg',e.foto).then(function(u){e.foto=u;}));
    if(e.assinatura&&String(e.assinatura).indexOf('data:')===0)jobs.push(subir('entrega-'+e.id+'/assinatura-'+Date.now()+'.png',e.assinatura).then(function(u){e.assinatura=u;}));
    return Promise.all(jobs);
  }
  function gravar(tab,lista){
    var chave=tab;
    var tarefas=[];
    lista.forEach(function(o){
      var k=String(o.id),s;
      var pre=tab==='entregas'?preparaEvidencias(o):Promise.resolve();
      tarefas.push(pre.then(function(){
        s=JSON.stringify(o);
        if(snap[chave][k]===s)return;
        var row=toRow(tab,o);
        var q=(snap[chave][k]===undefined)?cli().from(tab).insert(row):cli().from(tab).update(row).eq('id',o.id);
        return q.then(function(r){falhou(r);snap[chave][k]=s;});
      }));
    });
    return Promise.all(tarefas);
  }
  function empurrar(){
    var cats=DB.catalogo.filter(function(p){return snap.catalogo[p[0]]===undefined;});
    var pCat=(SESSION&&SESSION.role==='admin'&&cats.length)?cli().from('catalogo').upsert(cats.map(function(p){return {codigo:p[0],descricao:p[1]};})).then(function(r){falhou(r);cats.forEach(function(p){snap.catalogo[p[0]]=p[1];});}):Promise.resolve();
    var admin=SESSION&&SESSION.role==='admin';
    return Promise.all([
      admin?gravar('colaboradores',DB.colaboradores):Promise.resolve(),
      gravar('entregas',DB.entregas),
      gravar('ocorrencias',DB.ocorrencias),
      pCat
    ]).catch(function(e){toast('Falha ao sincronizar com o banco: '+erro(e));});
  }

  return {
    modo:'online',
    restaurar:function(){
      return cli().auth.getSession().then(function(r){
        var u=r.data&&r.data.session&&r.data.session.user;
        if(!u)return null;
        return perfilDe(u.id);
      }).catch(function(){return null;});
    },
    carregar:function(){
      return buscar().then(function(d){DB=d;marcarSnap(d);return carregarPosicoes();});
    },
    salvar:function(){
      clearTimeout(tmr);
      tmr=setTimeout(function(){fila=fila.then(empurrar);},350);
      return true;
    },
    entrar:function(u,p){
      u=(u||'').trim();
      var email=u.indexOf('@')>0?u:(u.toLowerCase()+'@'+CONFIG.dominioLogin);
      return cli().auth.signInWithPassword({email:email,password:p}).then(function(r){
        if(r.error)return {erro:'Usuário ou senha incorretos.'};
        return perfilDe(r.data.user.id).then(function(s){
          if(!s){return cli().auth.signOut().then(function(){return {erro:'Este usuário não tem perfil de acesso. Fale com o administrador.'};});}
          return {sessao:s};
        });
      }).catch(function(e){return {erro:'Não foi possível entrar: '+erro(e)};});
    },
    sair:function(){return cli().auth.signOut().catch(function(){});},
    atualizar:function(){
      return fila.then(buscar).then(function(d){
        var antes=JSON.stringify([DB.entregas,DB.ocorrencias,DB.colaboradores]);
        var mudou=antes!==JSON.stringify([d.entregas,d.ocorrencias,d.colaboradores]);
        DB=d;marcarSnap(d);
        return carregarPosicoes().then(function(){return mudou;});
      }).catch(function(){return false;});
    },
    /* cria o login do colaborador sem derrubar a sessão do administrador */
    criarAcesso:function(c,senha){
      var tmp=window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'despacho-tmp'}});
      var email=c.usuario.toLowerCase()+'@'+CONFIG.dominioLogin;
      return tmp.auth.signUp({email:email,password:senha}).then(function(r){
        if(r.error)throw r.error;
        if(!r.data.user)throw new Error('o Supabase não devolveu o usuário (confirmação de e-mail ligada?)');
        c.authId=r.data.user.id;
        return cli().from('colaboradores').insert(toRow('colaboradores',c)).then(function(x){
          falhou(x);snap.colaboradores[c.id]=JSON.stringify(c);
          return cli().from('perfis').insert({auth_id:c.authId,papel:'motorista',colaborador_id:c.id});
        }).then(falhou).then(function(){return c;});
      });
    },
    assinar:assinar,
    urlEvid:function(v){var p=caminho(v);return p===null?v:(urls[p]||null);},
    posicoes:function(){return pos;},
    enviarPosicao:function(motoristaId,lat,lng,prec){
      return cli().from('posicoes').insert({motorista_id:motoristaId,lat:lat,lng:lng,precisao:prec==null?null:Math.round(prec)}).then(function(){});
    }
  };
})();
