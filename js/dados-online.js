'use strict';
/* Camada de dados ONLINE (Supabase): login, tabelas, fotos/assinaturas e posição GPS.
   Mesma interface da camada local (DadosLocal). Veja banco/schema.sql e o README. */
var DadosOnline=(function(){
  var sb=null, snap={colaboradores:{},entregas:{},ocorrencias:{},catalogo:{},veiculos:{},abastecimentos:{}}, fila=Promise.resolve(), tmr=null, pos={};
  var TS={prazo:1,criadoEm:1,saidaEm:1,concluidoEm:1,retornoEm:1,em:1};
  var STR={empresa:1,veiculo:1,placa:1,telefone:1,cpf:1,matricula:1,obs:1,recebedor:1,endereco:1,codigo:1,motivo:1,usuario:1,modelo:1,combustivel:1,posto:1};
  var MAPA={
    colaboradores:{id:'id',nome:'nome',tipo:'tipo',empresa:'empresa',veiculo:'veiculo',placa:'placa',telefone:'telefone',usuario:'usuario',cpf:'cpf',matricula:'matricula',ativo:'ativo',token:'token',authId:'auth_id'},
    entregas:{id:'id',dia:'dia',cliente:'cliente',endereco:'endereco',motoristaId:'motorista_id',status:'status',prazo:'prazo',criadoEm:'criado_em',saidaEm:'saida_em',concluidoEm:'concluido_em',retornoEm:'retorno_em',tipo:'tipo',itens:'itens',obs:'obs',recebedor:'recebedor',foto:'foto',assinatura:'assinatura',x:'x',y:'y',lat:'lat',lng:'lng'},
    ocorrencias:{id:'id',entregaId:'entrega_id',dia:'dia',tipo:'tipo',codigo:'codigo',motivo:'motivo',em:'em',motoristaId:'motorista_id'},
    veiculos:{id:'id',placa:'placa',tipo:'tipo',modelo:'modelo',combustivel:'combustivel',capacidade:'capacidade',kmInicial:'km_inicial',metaKml:'meta_kml',ativo:'ativo'},
    abastecimentos:{id:'id',veiculoId:'veiculo_id',motoristaId:'motorista_id',em:'em',km:'km',litros:'litros',valor:'valor',cheio:'cheio',posto:'posto',fotoOdometro:'foto_odometro',fotoNota:'foto_nota',obs:'obs',origem:'origem'}
  };
  /* o módulo de combustível não pode derrubar o resto se as tabelas ainda não existirem no banco */
  function tol(p){return p.then(function(r){return (r&&r.error)?{data:[],error:r.error}:r;},function(){return {data:[]};});}
  function num(v){return v==null?v:Number(v);}
  function cli(){
    if(!sb)sb=window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});
    return sb;
  }
  function toRow(tab,o){
    var m=MAPA[tab],r={};Object.keys(m).forEach(function(k){var v=o[k];r[m[k]]=(v===undefined?null:v);});
    /* entrega comum não manda a coluna "tipo": assim o site continua funcionando mesmo antes do arquivo 05 do banco */
    if(tab==='entregas'&&(r.tipo==null||r.tipo==='entrega'))delete r.tipo;
    return r;
  }
  function fromRow(tab,r){
    var m=MAPA[tab],o={};
    Object.keys(m).forEach(function(k){
      var v=r[m[k]];
      if(v!=null&&TS[k])v=new Date(v).toISOString();
      if(v==null&&STR[k])v='';
      o[k]=v;
    });
    if(tab==='colaboradores'){o.senha='';if(o.ativo==null)o.ativo=true;}
    if(tab==='entregas'){if(typeof o.itens==='string')o.itens=JSON.parse(o.itens);o.tipo=o.tipo==='coleta'?'coleta':'entrega';}
    if(tab==='veiculos'){o.capacidade=num(o.capacidade);o.kmInicial=num(o.kmInicial)||0;o.metaKml=num(o.metaKml);}
    if(tab==='abastecimentos'){o.km=num(o.km);o.litros=num(o.litros);o.valor=num(o.valor);o.cheio=o.cheio!==false;}
    return o;
  }
  function erro(e){return (e&&e.message)||String(e);}
  function falhou(r){if(r&&r.error)throw r.error;return r;}

  /* o desenvolvedor entra como administrador (tem tudo dele) com a marca dev:true, que libera a aba "Desenvolvedor" */
  function perfilDe(uid){
    return cli().from('perfis').select('papel,colaborador_id').eq('auth_id',uid).maybeSingle().then(function(r){
      falhou(r);
      if(!r.data)return null;
      if(r.data.papel==='desenvolvedor')return {role:'admin',dev:true};
      return r.data.papel==='admin'?{role:'admin'}:{role:'driver',id:r.data.colaborador_id,via:'login'};
    });
  }
  /* chamada de função do banco (RPC) que devolve o resultado ou lança o erro */
  function rpc(nome,args){return cli().rpc(nome,args||{}).then(function(r){falhou(r);return r.data;});}
  /* cria um login novo sem derrubar a sessão de quem está logado */
  function novoLogin(email,senha){
    var tmp=window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'despacho-tmp'}});
    return tmp.auth.signUp({email:email,password:senha}).then(function(r){
      if(r.error)throw r.error;
      if(!r.data.user)throw new Error('o Supabase não devolveu o usuário (confirmação de e-mail ligada?)');
      return r.data.user.id;
    });
  }
  /* situação do plano da empresa para o usuário logado (veja status_acesso no banco) */
  function lerStatus(d){
    d=d||{};
    var seg=d.segundos_restantes;
    return {liberado:d.liberado!==false,motivo:d.motivo||'ok',plano:d.plano||'full',dev:!!d.dev,papel:d.papel||'',
      testeDias:d.teste_dias||3,ate:(seg==null?null:Date.now()+Number(seg)*1000)};
  }
  /* parâmetros das funções de limpeza: dias e horários no fuso do navegador */
  function parLimpeza(de,ate,o){
    return {p_de:de,p_ate:ate,p_ini:new Date(de+'T00:00:00').toISOString(),p_fim:new Date(ate+'T23:59:59.999').toISOString(),
      p_entregas:!!o.ent,p_abast:!!o.ab,p_gps:!!o.gps,p_abertos:!!o.abertos};
  }
  function maxNum(list,f){return list.reduce(function(m,x){var n=f(x);return n>m?n:m;},0);}

  function buscar(){
    var desde=dayKey(Date.now()-30*86400000);
    var desdeAb=new Date(Date.now()-90*86400000).toISOString();
    return Promise.all([
      cli().from('colaboradores').select('*'),
      cli().from('entregas').select('*').gte('dia',desde).order('id'),
      cli().from('ocorrencias').select('*').gte('dia',desde).order('id'),
      cli().from('catalogo').select('*').order('codigo'),
      tol(cli().from('veiculos').select('*').order('id')),
      tol(cli().from('abastecimentos').select('*').gte('em',desdeAb).order('em')),
      tol(cli().rpc('ultimos_km'))
    ]).then(function(rs){
      rs.slice(0,4).forEach(falhou);
      var col=rs[0].data.map(function(r){return fromRow('colaboradores',r);});
      var ent=rs[1].data.map(function(r){return fromRow('entregas',r);});
      var oc=rs[2].data.map(function(r){return fromRow('ocorrencias',r);});
      var cat=rs[3].data.map(function(r){return [r.codigo,r.descricao||r.codigo];});
      var ve=(rs[4].data||[]).map(function(r){return fromRow('veiculos',r);});
      var ab=(rs[5].data||[]).map(function(r){return fromRow('abastecimentos',r);});
      var uk={};(rs[6].data||[]).forEach(function(r){uk[r.veiculo_id]=num(r.ultimo_km);});
      ve.forEach(function(v){v.ultimoKm=uk[v.id]==null?null:uk[v.id];});
      return {v:1,demo:false,seedDay:todayKey(),
        seq:{ent:Math.max(1000,maxNum(ent,function(e){return e.id;})),oc:maxNum(oc,function(o){return o.id;}),col:maxNum(col,function(c){return parseInt(String(c.id).replace(/\D/g,''),10)||0;}),vei:maxNum(ve,function(v){return v.id;})},
        colaboradores:col,entregas:ent,ocorrencias:oc,catalogo:cat,veiculos:ve,abastecimentos:ab};
    });
  }
  function marcarSnap(d){
    snap={colaboradores:{},entregas:{},ocorrencias:{},catalogo:{},veiculos:{},abastecimentos:{}};
    d.veiculos.forEach(function(x){snap.veiculos[x.id]=JSON.stringify(x);});
    d.abastecimentos.forEach(function(x){snap.abastecimentos[x.id]=JSON.stringify(x);});
    d.colaboradores.forEach(function(x){snap.colaboradores[x.id]=JSON.stringify(x);});
    d.entregas.forEach(function(x){snap.entregas[x.id]=JSON.stringify(x);});
    d.ocorrencias.forEach(function(x){snap.ocorrencias[x.id]=JSON.stringify(x);});
    d.catalogo.forEach(function(x){snap.catalogo[x[0]]=x[1];});
  }
  /* local da empresa (definido pelo desenvolvedor); sem o arquivo 05 no banco, o mapa usa o ponto de exemplo */
  function carregarEmpresa(){
    return cli().rpc('local_empresa').then(function(r){
      if(r.error||!r.data||r.data.lat==null)return;
      EMPRESA={lat:Number(r.data.lat),lng:Number(r.data.lng),endereco:r.data.endereco||''};
    },function(){});
  }
  /* o Supabase devolve no máximo 1000 linhas por pedido: busca em páginas */
  function paginar(mk){
    var tudo=[];
    function pg(i){return mk().range(i,i+999).then(function(r){falhou(r);var d=r.data||[];tudo=tudo.concat(d);return d.length===1000?pg(i+1000):tudo;});}
    return pg(0);
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
  /* fotos do abastecimento ficam na pasta do motorista: abastecimento-<motorista>/<id>-odometro-<hora>.jpg */
  function preparaEvidenciasAb(a){
    var jobs=[],pasta='abastecimento-'+a.motoristaId+'/'+a.id+'-';
    if(a.fotoOdometro&&String(a.fotoOdometro).indexOf('data:')===0)jobs.push(subir(pasta+'odometro-'+Date.now()+'.jpg',a.fotoOdometro).then(function(u){a.fotoOdometro=u;}));
    if(a.fotoNota&&String(a.fotoNota).indexOf('data:')===0)jobs.push(subir(pasta+'nota-'+Date.now()+'.jpg',a.fotoNota).then(function(u){a.fotoNota=u;}));
    return Promise.all(jobs);
  }
  function gravar(tab,lista){
    var chave=tab;
    var tarefas=[];
    lista.forEach(function(o){
      var k=String(o.id),s;
      var pre=tab==='entregas'?preparaEvidencias(o):tab==='abastecimentos'?preparaEvidenciasAb(o):Promise.resolve();
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
      admin?gravar('veiculos',DB.veiculos):Promise.resolve(),
      gravar('entregas',DB.entregas),
      gravar('ocorrencias',DB.ocorrencias),
      gravar('abastecimentos',DB.abastecimentos),
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
      return buscar().then(function(d){DB=d;marcarSnap(d);return Promise.all([carregarPosicoes(),carregarEmpresa()]);});
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
        var antes=JSON.stringify([DB.entregas,DB.ocorrencias,DB.colaboradores,DB.veiculos,DB.abastecimentos]);
        var mudou=antes!==JSON.stringify([d.entregas,d.ocorrencias,d.colaboradores,d.veiculos,d.abastecimentos]);
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
    /* ===== plano da empresa (teste grátis / Full) ===== */
    statusAcesso:function(){
      return cli().rpc('status_acesso').then(function(r){
        if(r.error){
          /* banco ainda sem os planos (arquivo 02 não rodado): nada a bloquear */
          if(r.error.code==='PGRST202'||/could not find the function|schema cache/i.test(r.error.message||''))return {liberado:true,semPlanos:true,motivo:'ok',plano:'full',dev:false};
          throw r.error;
        }
        return lerStatus(r.data);
      });
    },
    resgatarCodigo:function(codigo){return rpc('resgatar_codigo',{p_codigo:codigo}).then(function(d){return d||{ok:false,erro:'Sem resposta do banco.'};});},
    /* ===== só o desenvolvedor (o banco confere de novo em cada chamada) ===== */
    devLicenca:function(){return cli().from('licenca').select('*').eq('id',1).maybeSingle().then(function(r){falhou(r);return r.data;});},
    devCodigos:function(){return cli().from('codigos_acesso').select('id,nota,criado_em,usado_em,cancelado_em').order('id',{ascending:false}).then(function(r){falhou(r);return r.data||[];});},
    devUsuarios:function(){return rpc('dev_listar_usuarios').then(function(d){return d||[];});},
    devPlano:function(plano,dias,agora){return rpc('dev_definir_plano',{p_plano:plano,p_dias:dias||3,p_iniciar_agora:!!agora});},
    devEstender:function(dias){return rpc('dev_estender_teste',{p_dias:dias});},
    devGerarCodigo:function(nota){return rpc('dev_gerar_codigo',{p_nota:nota||''});},
    devCancelarCodigo:function(id){return rpc('dev_cancelar_codigo',{p_id:id});},
    devSenha:function(authId,senha){return rpc('dev_definir_senha',{p_auth_id:authId,p_senha:senha});},
    devBloquear:function(authId,bloquear){return rpc('dev_bloquear_usuario',{p_auth_id:authId,p_bloquear:!!bloquear});},
    devPapel:function(authId,papel,colaboradorId){return rpc('dev_definir_papel',{p_auth_id:authId,p_papel:papel,p_colaborador:colaboradorId||null});},
    devExcluir:function(authId,apagarCadastro){return rpc('dev_excluir_usuario',{p_auth_id:authId,p_apagar_cadastro:!!apagarCadastro});},
    devCriarAdmin:function(usuario,senha){
      var email=usuario.indexOf('@')>0?usuario:usuario.toLowerCase()+'@'+CONFIG.dominioLogin;
      return novoLogin(email,senha).then(function(id){return cli().from('perfis').insert({auth_id:id,papel:'admin'});}).then(falhou);
    },
    /* ===== histórico: busca um período (a tela inicial só traz os últimos 30 dias) ===== */
    historico:function(de,ate){
      var ini=new Date(de+'T00:00:00').toISOString(),fim=new Date(ate+'T23:59:59.999').toISOString();
      return Promise.all([
        paginar(function(){return cli().from('entregas').select('*').gte('dia',de).lte('dia',ate).order('id');}),
        paginar(function(){return cli().from('ocorrencias').select('*').gte('dia',de).lte('dia',ate).order('id');}),
        paginar(function(){return cli().from('abastecimentos').select('*').gte('em',ini).lte('em',fim).order('em');}).catch(function(){return [];})
      ]).then(function(rs){
        return {entregas:rs[0].map(function(r){return fromRow('entregas',r);}),
                ocorrencias:rs[1].map(function(r){return fromRow('ocorrencias',r);}),
                abastecimentos:rs[2].map(function(r){return fromRow('abastecimentos',r);})};
      });
    },
    /* quantos pedidos houve em cada dia (para marcar o calendário) */
    diasComMovimento:function(de,ate){
      return paginar(function(){return cli().from('entregas').select('id,dia').gte('dia',de).lte('dia',ate).order('id');}).then(function(l){
        var m={};l.forEach(function(r){m[r.dia]=(m[r.dia]||0)+1;});return m;
      });
    },
    /* só o desenvolvedor: local da empresa no mapa */
    devLocalEmpresa:function(lat,lng,endereco){
      return rpc('dev_definir_local_empresa',{p_lat:lat,p_lng:lng,p_endereco:endereco||''}).then(function(){EMPRESA={lat:lat,lng:lng,endereco:endereco||''};});
    },
    /* ===== limpar histórico (só o desenvolvedor; o banco confere de novo) ===== */
    /* link do cliente: gera (ou reaproveita) o código secreto da entrega e monta o endereço da página pública */
    linkAcompanhamento:function(id){
      return rpc('gerar_link_acompanhamento',{p_id:id}).then(function(t){
        return location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/,'')+'acompanhar.html?t='+t;
      });
    },
    devContarLimpeza:function(de,ate,o){return rpc('dev_contar_limpeza',parLimpeza(de,ate,o));},
    devLimpar:function(de,ate,o){return rpc('dev_limpar_historico',parLimpeza(de,ate,o));},
    /* caminhos dos arquivos (fotos/assinaturas) dos registros que serão apagados */
    caminhosArquivos:function(dados,o){
      var ps=[];
      if(o.ent)dados.entregas.forEach(function(e){if(!o.abertos&&(e.status==='separado'||e.status==='em_rota'))return;ps.push(caminho(e.foto),caminho(e.assinatura));});
      if(o.ab)dados.abastecimentos.forEach(function(a){ps.push(caminho(a.fotoOdometro),caminho(a.fotoNota));});
      return ps.filter(function(p,i,l){return p&&l.indexOf(p)===i;});
    },
    devApagarArquivos:function(paths){
      var r={ok:0,falhou:0},blocos=[],i;
      for(i=0;i<paths.length;i+=100)blocos.push(paths.slice(i,i+100));
      return blocos.reduce(function(p,b){
        return p.then(function(){return cli().storage.from('evidencias').remove(b);}).then(function(x){
          if(x&&x.error)r.falhou+=b.length;else r.ok+=((x&&x.data)?x.data.length:b.length);
        },function(){r.falhou+=b.length;});
      },Promise.resolve()).then(function(){return r;});
    },
    assinar:assinar,
    urlEvid:function(v){var p=caminho(v);return p===null?v:(urls[p]||null);},
    posicoes:function(){return pos;},
    enviarPosicao:function(motoristaId,lat,lng,prec){
      return cli().from('posicoes').insert({motorista_id:motoristaId,lat:lat,lng:lng,precisao:prec==null?null:Math.round(prec)}).then(function(){});
    }
  };
})();
