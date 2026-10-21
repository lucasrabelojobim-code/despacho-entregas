'use strict';
/* Aba "Desenvolvedor": plano da empresa, códigos do plano Full e controle de todos os usuários.
   Só aparece para o usuário desenvolvedor. Cada ação é conferida de novo pelo banco (funções dev_* em
   banco/02-planos-desenvolvedor.sql), então esconder a aba não é a proteção: a proteção está no banco. */
var DEV={seq:0,usuarios:[]};
UI.dev={aba:'plano'};

function msgErro(e){return (e&&e.message)||String(e);}
function dtHora(iso){return iso?new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';}

function viewDev(){
  var abas=[['plano','Plano'],['codigos','Códigos'],['usuarios','Usuários'],['empresa','Empresa'],['limpar','Limpar histórico']];
  return '<div class="page-h"><div><h1>Desenvolvedor</h1><p>Área restrita: plano da empresa, códigos de acesso, usuários e local da empresa.</p></div>'+
    '<div class="seg" role="group" aria-label="Seção">'+abas.map(function(a){return '<button data-act="dev-aba" data-p="'+a[0]+'" aria-pressed="'+(UI.dev.aba===a[0])+'">'+a[1]+'</button>';}).join('')+'</div></div>'+
    '<div id="dev-corpo"></div>';
}
function fillDev(){
  var el=$('#dev-corpo');if(!el)return;
  var n=++DEV.seq,aba=UI.dev.aba;
  if(aba==='limpar'){el.innerHTML=viewLimpar();fillLimpar();return;}
  if(aba==='empresa'){el.innerHTML=devEmpresaHtml();if(usaReal())mrEmpresa();return;}
  el.innerHTML='<div class="empty">Carregando…</div>';
  var p=aba==='plano'?Dados.devLicenca().then(devPlanoHtml):
        aba==='codigos'?Dados.devCodigos().then(devCodigosHtml):
        Dados.devUsuarios().then(function(l){DEV.usuarios=l;return devUsuariosHtml(l);});
  p.then(function(h){var e=$('#dev-corpo');if(n===DEV.seq&&e)e.innerHTML=h;})
   .catch(function(e){var x=$('#dev-corpo');if(n===DEV.seq&&x)x.innerHTML='<div class="empty">Não foi possível carregar: '+esc(msgErro(e))+'</div>';});
}

/* ---------- aba Plano ---------- */
function devPlanoHtml(l){
  if(!l)return '<div class="empty">Plano não encontrado. Rode o arquivo banco/02-planos-desenvolvedor.sql no Supabase.</div>';
  var fim=l.teste_fim?new Date(l.teste_fim).getTime():null,sit;
  if(l.plano==='full')sit='<span class="pill p-good"><i></i>Full · sem prazo</span>';
  else if(l.plano==='bloqueado')sit='<span class="pill p-bad"><i></i>Bloqueado</span>';
  else if(!fim)sit='<span class="pill p-accent"><i></i>Teste · começa no primeiro login</span>';
  else if(fim>Date.now())sit='<span class="pill p-accent"><i></i>Teste · restam '+restanteTxt(fim)+'</span>';
  else sit='<span class="pill p-bad"><i></i>Teste terminou · bloqueado</span>';
  var info='<div class="kv"><div><span>Plano da empresa</span>'+esc(planoNome(l.plano))+'</div><div><span>Situação</span>'+sit+'</div>'+
    '<div><span>Teste grátis</span>'+l.teste_dias+' dias</div><div><span>Início do teste</span>'+esc(dtHora(l.teste_inicio))+'</div>'+
    '<div><span>Fim do teste</span>'+esc(dtHora(l.teste_fim))+'</div><div><span>Full desde</span>'+esc(dtHora(l.full_desde))+'</div></div>';
  var est=l.plano==='teste'?'<form id="f-dev-estender" class="row" style="align-items:flex-end"><div class="field" style="width:120px"><label for="de-d">Somar dias</label><input id="de-d" name="dias" type="number" min="1" max="365" value="1" required></div><button class="btn" type="submit">Estender o teste</button></form>':'';
  return '<div class="grid-eq">'+
    '<section class="panel"><div class="panel-h"><h2>Plano atual</h2></div><div class="panel-b">'+info+
      '<p class="note" style="margin-top:12px">O plano vale para a empresa inteira (administrador e motoristas). Você, desenvolvedor, nunca é bloqueado.</p></div></section>'+
    '<section class="panel"><div class="panel-h"><h2>Mudar o plano</h2></div><div class="panel-b" style="display:flex;flex-direction:column;gap:18px">'+
      '<form id="f-dev-teste"><div class="lbl" style="margin-bottom:6px">Teste grátis</div><div class="row" style="align-items:flex-end">'+
        '<div class="field" style="width:120px"><label for="dt-d">Dias</label><input id="dt-d" name="dias" type="number" min="1" max="365" value="3" required></div>'+
        '<button class="btn btn-primary" type="submit">Iniciar teste grátis</button></div>'+
        '<label class="note" style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" name="agora"> Contar a partir de agora (sem marcar, a contagem começa no primeiro login)</label></form>'+
      est+
      '<div><div class="lbl" style="margin-bottom:6px">Plano Full e bloqueio</div><div class="row">'+
        '<button class="btn" type="button" data-act="dev-full">Liberar Full (sem código)</button>'+
        '<button class="btn btn-danger" type="button" data-act="dev-bloquear-tudo">Bloquear tudo agora</button></div>'+
        '<p class="note" style="margin-top:6px">Bloquear tranca todos os usuários da empresa. Para liberar, gere um código na aba Códigos ou libere o Full.</p></div>'+
    '</div></section></div>';
}

/* ---------- aba Empresa: local da empresa no mapa ---------- */
function devEmpresaHtml(){
  var def=empresaDefinida();
  var atual=EMPRESA?'<span class="pill p-good"><i></i>Definido</span> '+esc(EMPRESA.endereco||(EMPRESA.lat.toFixed(5)+', '+EMPRESA.lng.toFixed(5))):
    '<span class="pill p-warn"><i></i>Ainda não definido</span> O mapa está usando um ponto de exemplo em Manaus.';
  return '<section class="panel"><div class="panel-h"><h2>Local da empresa no mapa</h2></div><div class="panel-b">'+
    '<p style="margin-bottom:10px">'+atual+'</p>'+
    '<p class="note" style="margin-bottom:10px">É daqui que as rotas saem e é onde aparece o ícone <b>E</b> no mapa. Só o desenvolvedor altera; administradores e motoristas apenas veem.</p>'+
    (usaReal()?'<form id="f-dev-empresa" autocomplete="off">'+
      '<div class="row" style="align-items:flex-end;margin-bottom:8px"><div class="field" style="flex:1;min-width:220px"><label for="em-end">Endereço da empresa</label><input id="em-end" name="endereco" maxlength="250" placeholder="Rua, número, bairro" value="'+esc(EMPRESA?EMPRESA.endereco:'')+'"></div>'+
      '<button class="btn" type="button" data-act="emp-buscar">Localizar pelo endereço</button></div>'+
      '<div id="empmap" class="rmap" style="height:340px"></div>'+
      '<p class="note" id="em-note" style="margin-top:6px">'+(def?'Local atual da empresa.':'Clique no mapa para marcar o local da empresa, ou busque pelo endereço.')+'</p>'+
      '<input type="hidden" name="lat" id="em-lat"><input type="hidden" name="lng" id="em-lng">'+
      '<div class="err" id="dv-err" role="alert"></div>'+
      '<div class="row" style="margin-top:8px"><button class="btn btn-primary" type="submit" id="em-save" disabled>Salvar local da empresa</button></div></form>':
      '<div class="empty">O mapa real não carregou. Verifique a conexão com a internet e abra esta aba de novo.</div>')+
    '</div></section>';
}

/* ---------- aba Códigos ---------- */
function devCodigosHtml(lista){
  var rows=lista.map(function(c){
    var sit=c.cancelado_em?'<span class="pill p-neutral"><i></i>Cancelado</span>':c.usado_em?'<span class="pill p-good"><i></i>Usado em '+esc(dtHora(c.usado_em))+'</span>':'<span class="pill p-accent"><i></i>Disponível</span>';
    var ac=(!c.usado_em&&!c.cancelado_em)?'<button class="btn btn-sm" type="button" data-act="dev-cancelar-codigo" data-id="'+c.id+'">Cancelar</button>':'';
    return '<tr><td>'+esc(c.nota||'—')+'</td><td class="mono">'+esc(dtHora(c.criado_em))+'</td><td>'+sit+'</td><td>'+ac+'</td></tr>';
  }).join('');
  return '<section class="panel"><div class="panel-h"><h2>Gerar código do plano Full</h2></div><div class="panel-b">'+
    '<form id="f-dev-codigo" class="row" style="align-items:flex-end"><div class="field" style="flex:1;min-width:220px"><label for="dc-n">Para quem é (anotação sua)</label><input id="dc-n" name="nota" maxlength="120" placeholder="Ex.: empresa do cliente"></div><button class="btn btn-primary" type="submit">Gerar código</button></form>'+
    '<p class="note" style="margin-top:8px">O código aparece uma única vez, na hora de gerar (por segurança o sistema guarda só uma impressão digital dele). Cada código vale para um único uso.</p></div></section>'+
    '<section class="panel" style="margin-top:16px"><div class="panel-h"><h2>Códigos gerados</h2></div>'+
    '<div class="scroll"><table class="tbl"><thead><tr><th>Anotação</th><th>Criado</th><th>Situação</th><th></th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="4" class="empty">Nenhum código gerado ainda.</td></tr>')+'</tbody></table></div></section>';
}

/* ---------- aba Usuários ---------- */
function devUsuariosHtml(lista){
  var rows=lista.map(function(u){
    var eu=u.papel==='desenvolvedor';
    var login=String(u.email||'—').replace('@'+CONFIG.dominioLogin,'');
    var papel=eu?'<span class="pill p-mag"><i></i>Desenvolvedor</span>':u.papel==='admin'?'<span class="pill p-accent"><i></i>Administrador</span>':'<span class="pill p-neutral"><i></i>Motorista</span>';
    var sit=u.bloqueado?'<span class="pill p-bad"><i></i>Bloqueado</span>':'<span class="pill p-good"><i></i>Ativo</span>';
    var ac=eu?'<span class="note">Você · protegido</span>':'<div class="row" style="flex-wrap:nowrap">'+
      '<button class="btn btn-sm" type="button" data-act="dev-senha" data-id="'+esc(u.auth_id)+'">Senha</button>'+
      '<button class="btn btn-sm" type="button" data-act="dev-bloq-user" data-id="'+esc(u.auth_id)+'" data-b="'+(u.bloqueado?'0':'1')+'">'+(u.bloqueado?'Liberar':'Bloquear')+'</button>'+
      '<button class="btn btn-sm" type="button" data-act="dev-papel" data-id="'+esc(u.auth_id)+'">Papel</button>'+
      '<button class="btn btn-sm btn-danger" type="button" data-act="dev-excluir" data-id="'+esc(u.auth_id)+'">Excluir</button></div>';
    return '<tr><td><b>'+esc(u.nome||login)+'</b><span class="sub mono">'+esc(login)+'</span></td><td>'+papel+'</td><td>'+sit+'</td><td class="mono">'+esc(dtHora(u.ultimo_login))+'</td><td>'+ac+'</td></tr>';
  }).join('');
  return '<section class="panel"><div class="panel-h"><h2>Todos os usuários</h2><button class="btn btn-primary btn-sm" type="button" data-act="dev-novo-admin">Novo administrador</button></div>'+
    '<div class="scroll"><table class="tbl" style="min-width:760px"><thead><tr><th>Usuário</th><th>Papel</th><th>Situação</th><th>Último acesso</th><th></th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="5" class="empty">Nenhum usuário.</td></tr>')+'</tbody></table></div>'+
    '<p class="note" style="padding:8px 16px 14px">Novos motoristas continuam sendo criados na aba Colaboradores. Bloquear vale na hora. Excluir o acesso mantém o histórico de entregas.</p></section>';
}
function devUsuario(id){return DEV.usuarios.find(function(u){return u.auth_id===id;});}
function devNome(u){return u?(u.nome||String(u.email||'').replace('@'+CONFIG.dominioLogin,'')):'';}

/* depois de qualquer mudança: atualiza o plano e os dados e redesenha a tela */
function devAtualizar(msg){
  return Dados.statusAcesso().then(function(st){LIC=st;}).catch(function(){}).then(function(){return Dados.carregar();}).catch(function(){}).then(function(){
    closeModal();renderApp();if(msg)toast(msg);
  });
}
function devFalha(e,idErro){
  var t=msgErro(e),el=idErro&&$('#'+idErro);
  if(el)el.textContent=t;else toast(t);
}

/* ---------- cliques ---------- */
function devAcao(a,t,id){
  switch(a){
    case 'abrir-codigo':abrirCodigo();break;
    case 'dev-codigo-ok':closeModal();renderApp();break;
    case 'dev-aba':UI.dev.aba=t.dataset.p;renderApp();break;
    case 'emp-buscar':mrBuscarEmpresa();break;
    case 'dev-full':
      if(confirm('Liberar o plano Full para a empresa, sem código?'))Dados.devPlano('full').then(function(){return devAtualizar('Plano Full liberado');}).catch(function(e){devFalha(e);});
      break;
    case 'dev-bloquear-tudo':
      if(confirm('Bloquear TODOS os usuários da empresa agora? Só você continua com acesso.'))Dados.devPlano('bloqueado').then(function(){return devAtualizar('Empresa bloqueada');}).catch(function(e){devFalha(e);});
      break;
    case 'dev-cancelar-codigo':
      if(confirm('Cancelar este código? Ele deixa de funcionar.'))Dados.devCancelarCodigo(+id).then(function(){return devAtualizar('Código cancelado');}).catch(function(e){devFalha(e);});
      break;
    case 'dev-novo-admin':
      openModal(mh('Novo administrador','Terá acesso a tudo, menos à área do desenvolvedor.')+
        '<form id="f-dev-admin" class="dlg-b" autocomplete="off"><div class="field"><label for="da-u">Usuário de acesso</label><input id="da-u" name="usuario" autocapitalize="none" required autofocus></div>'+
        '<div class="field"><label for="da-s">Senha (mínimo 6 caracteres)</label><input id="da-s" name="senha" type="password" minlength="6" required autocomplete="new-password"></div>'+
        '<div class="err" id="dv-err" role="alert"></div><div class="dlg-f"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn btn-primary" type="submit">Criar administrador</button></div></form>',true);
      break;
    case 'dev-senha':{
      var us=devUsuario(id);if(!us)break;
      openModal(mh('Nova senha','Usuário: '+esc(devNome(us)))+
        '<form id="f-dev-senha" class="dlg-b" data-id="'+esc(id)+'" autocomplete="off"><div class="field"><label for="ds-s">Nova senha (mínimo 6 caracteres)</label><input id="ds-s" name="senha" type="password" minlength="6" required autofocus autocomplete="new-password"></div>'+
        '<div class="err" id="dv-err" role="alert"></div><div class="dlg-f"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn btn-primary" type="submit">Salvar senha</button></div></form>',true);
      break;}
    case 'dev-bloq-user':{
      var ub=devUsuario(id),bl=t.dataset.b==='1';if(!ub)break;
      if(confirm((bl?'Bloquear ':'Liberar ')+devNome(ub)+'?'))Dados.devBloquear(id,bl).then(function(){return devAtualizar(bl?'Usuário bloqueado':'Usuário liberado');}).catch(function(e){devFalha(e);});
      break;}
    case 'dev-papel':{
      var up=devUsuario(id);if(!up)break;
      var cols=DB.colaboradores.map(function(c){return [c.id,c.nome+(c.empresa?' · '+c.empresa:'')];});
      openModal(mh('Papel de '+esc(devNome(up)),'Administrador vê tudo. Motorista vê só as entregas dele.')+
        '<form id="f-dev-papel" class="dlg-b" data-id="'+esc(id)+'"><div class="field"><label for="dp-p">Papel</label><select id="dp-p" name="papel">'+opts([['admin','Administrador'],['motorista','Motorista']],up.papel)+'</select></div>'+
        '<div class="field"><label for="dp-c">Colaborador (só para motorista)</label><select id="dp-c" name="colab"><option value="">—</option>'+opts(cols,up.colaborador_id||'')+'</select></div>'+
        '<div class="err" id="dv-err" role="alert"></div><div class="dlg-f"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn btn-primary" type="submit">Salvar</button></div></form>',true);
      break;}
    case 'dev-excluir':{
      var ue=devUsuario(id);if(!ue)break;
      openModal(mh('Excluir '+esc(devNome(ue)))+
        '<div class="dlg-b"><p>O acesso deste usuário será apagado e ele não consegue mais entrar. Isso não pode ser desfeito.</p>'+
        (ue.colaborador_id?'<p class="note">O histórico de entregas, ocorrências e abastecimentos dele é mantido.</p>':'')+
        '<div class="err" id="dv-err" role="alert"></div><div class="dlg-f" style="flex-wrap:wrap"><button class="btn" type="button" data-act="close">Cancelar</button>'+
        '<button class="btn btn-danger" type="button" data-act="dev-excluir-ok" data-id="'+esc(id)+'" data-ap="0">Excluir só o acesso</button>'+
        (ue.colaborador_id?'<button class="btn btn-danger" type="button" data-act="dev-excluir-ok" data-id="'+esc(id)+'" data-ap="1">Excluir acesso e cadastro</button>':'')+'</div></div>',true);
      break;}
    case 'dev-excluir-ok':
      t.disabled=true;
      Dados.devExcluir(id,t.dataset.ap==='1').then(function(){return devAtualizar('Usuário excluído');}).catch(function(e){t.disabled=false;devFalha(e,'dv-err');});
      break;
  }
}

/* ---------- formulários ---------- */
function devEnvio(f){
  var btn=f.querySelector('button[type=submit]');
  function fim(){if(btn)btn.disabled=false;}
  if(btn)btn.disabled=true;
  switch(f.id){
    case 'f-dev-teste':{
      var d=parseInt(fv(f,'dias'),10),agora=!!(f.elements.namedItem('agora')||{}).checked;
      if(!(d>=1&&d<=365)){toast('Informe de 1 a 365 dias.');fim();return;}
      Dados.devPlano('teste',d,agora).then(function(){return devAtualizar('Teste grátis de '+d+(d===1?' dia':' dias')+(agora?' iniciado':' pronto: começa no primeiro login'));}).catch(function(e){fim();devFalha(e);});
      break;}
    case 'f-dev-empresa':{
      var la=parseFloat(fv(f,'lat')),lo=parseFloat(fv(f,'lng'));
      if(isNaN(la)||isNaN(lo)){$('#dv-err').textContent='Marque o local da empresa no mapa antes de salvar.';fim();return;}
      Dados.devLocalEmpresa(la,lo,fv(f,'endereco').trim()).then(function(){MR.view=null;fim();toast('Local da empresa salvo. O mapa já usa o novo ponto.');fillDev();}).catch(function(e){fim();devFalha(e,'dv-err');});
      break;}
    case 'f-dev-estender':{
      var d2=parseInt(fv(f,'dias'),10);
      if(!(d2>=1&&d2<=365)){toast('Informe de 1 a 365 dias.');fim();return;}
      Dados.devEstender(d2).then(function(){return devAtualizar('Teste estendido em '+d2+(d2===1?' dia':' dias'));}).catch(function(e){fim();devFalha(e);});
      break;}
    case 'f-dev-codigo':
      Dados.devGerarCodigo(fv(f,'nota').trim()).then(function(cod){
        fim();
        openModal(mh('Código gerado','Guarde agora: por segurança ele não aparece de novo.')+
          '<div class="dlg-b"><div class="linkbox"><input id="lk" readonly value="'+esc(cod)+'" aria-label="Código do plano Full" style="font:600 22px/1 var(--font-mono,monospace);letter-spacing:.08em"><button class="btn" data-act="copy-link" type="button">Copiar</button></div>'+
          '<p class="note">Entregue este código a quem vai usar. Ele vale para um único uso e ativa o plano Full da empresa.</p>'+
          '<div class="dlg-f"><button class="btn btn-primary" type="button" data-act="dev-codigo-ok">Pronto</button></div></div>',true);
        fillDev();
      }).catch(function(e){fim();devFalha(e);});
      break;
    case 'f-dev-admin':{
      var u=fv(f,'usuario').trim(),s=fv(f,'senha');
      if(!/^[A-Za-z0-9._-]+(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})?$/.test(u)){$('#dv-err').textContent='Use só letras, números, ponto, hífen ou sublinhado no usuário.';fim();return;}
      if(s.length<6){$('#dv-err').textContent='A senha precisa ter ao menos 6 caracteres.';fim();return;}
      Dados.devCriarAdmin(u,s).then(function(){return devAtualizar('Administrador criado');}).catch(function(e){fim();devFalha(e,'dv-err');});
      break;}
    case 'f-dev-senha':{
      var s2=fv(f,'senha');
      if(s2.length<6){$('#dv-err').textContent='A senha precisa ter ao menos 6 caracteres.';fim();return;}
      Dados.devSenha(f.dataset.id,s2).then(function(){return devAtualizar('Senha alterada');}).catch(function(e){fim();devFalha(e,'dv-err');});
      break;}
    case 'f-dev-papel':{
      var papel=fv(f,'papel'),col=fv(f,'colab');
      if(papel==='motorista'&&!col){$('#dv-err').textContent='Escolha o colaborador deste motorista.';fim();return;}
      Dados.devPapel(f.dataset.id,papel,col).then(function(){return devAtualizar('Papel alterado');}).catch(function(e){fim();devFalha(e,'dv-err');});
      break;}
  }
}
