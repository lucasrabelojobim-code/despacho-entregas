'use strict';
/* Plano da empresa (teste grátis de 3 dias / Full com código): tela de bloqueio, aviso de dias restantes
   e ativação por código. A regra de verdade fica no banco (banco/02-planos-desenvolvedor.sql):
   com o plano vencido o banco recusa os dados, mesmo que alguém altere esta tela. */
var LIC=null;   /* situação do plano para o usuário logado; veja Dados.statusAcesso() */

function planoNome(p){return p==='full'?'Full':p==='teste'?'Teste grátis':p==='bloqueado'?'Bloqueado':'—';}
function restanteTxt(ate){
  var ms=ate-Date.now();
  if(ms<=0)return 'menos de 1 hora';
  if(ms>=86400000){var d=Math.ceil(ms/86400000);return d+(d===1?' dia':' dias');}
  var h=Math.max(1,Math.ceil(ms/3600000));
  return h+(h===1?' hora':' horas');
}

/* faixa no topo: aviso do teste grátis (todos) ou lembrete do plano (desenvolvedor) */
function bannerPlano(){
  if(!LIC||LIC.semPlanos||LIC.local||Dados.modo!=='online')return '';
  var admin=SESSION&&SESSION.role==='admin';
  if(LIC.dev){
    if(LIC.plano==='full')return '';
    return '<div class="plan-bar plan-dev"><span>Modo desenvolvedor · plano da empresa: <b>'+planoNome(LIC.plano)+'</b></span></div>';
  }
  if(LIC.plano==='teste'&&LIC.liberado!==false){
    return '<div class="plan-bar"><span>Teste grátis · restam <b>'+(LIC.ate?restanteTxt(LIC.ate):LIC.testeDias+' dias')+'</b></span>'+
      (admin?'<button class="btn btn-sm" type="button" data-act="abrir-codigo">Inserir código do plano Full</button>':'')+'</div>';
  }
  return '';
}

function formCodigoHtml(){
  return '<form id="f-codigo" autocomplete="off" class="dlg-b" style="padding:0">'+
    '<div class="field"><label for="cd-c">Código de acesso</label><input id="cd-c" name="codigo" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" required autofocus></div>'+
    '<div class="err" id="cd-err" role="alert"></div>'+
    '<button class="btn btn-primary btn-lg" type="submit">Ativar plano Full</button></form>';
}

/* tela que substitui o sistema quando o plano venceu ou foi bloqueado */
function viewBloqueio(){
  var m=(LIC&&LIC.motivo)||'bloqueado';
  var pode=(m==='teste_expirado'||m==='bloqueado');
  var tit=m==='teste_expirado'?'O teste grátis terminou':m==='usuario_bloqueado'?'Seu acesso foi bloqueado':m==='sem_perfil'?'Usuário sem acesso':'Acesso bloqueado';
  var txt=m==='teste_expirado'?'Os '+((LIC&&LIC.testeDias)||3)+' dias do teste grátis acabaram. Para continuar usando, ative o plano Full com um código de acesso.':
    m==='usuario_bloqueado'?'O acesso deste usuário foi bloqueado. Fale com o administrador do sistema.':
    m==='sem_perfil'?'Este usuário não tem permissão de acesso. Fale com o administrador do sistema.':
    'O acesso a este sistema está bloqueado. Para liberar, ative o plano Full com um código de acesso.';
  return '<div class="login">'+
    '<section class="login-side"><img class="logo-login" src="marca/logo.svg" alt="Arcos Jobim · Automação &amp; Software"><div class="prod">Despacho de Entregas</div>'+
    '<h1>'+esc(tit)+'.</h1><p class="dim">O sistema e o aplicativo ficam indisponíveis até a ativação do plano Full.</p></section>'+
    '<section class="login-form"><h2>'+esc(tit)+'</h2><p>'+esc(txt)+'</p>'+
    (pode?formCodigoHtml():'')+
    '<p class="note">'+(pode?'Não tem um código? Fale com a Arcos Jobim · Automação &amp; Software.':'')+'</p>'+
    '<button class="btn" type="button" data-act="logout">Sair</button></section></div>';
}

function abrirCodigo(){
  openModal(mh('Plano Full','Digite o código de acesso recebido da Arcos Jobim.')+'<div class="dlg-b">'+formCodigoHtml()+'</div>',true);
}

function enviarCodigo(form){
  var err=$('#cd-err'),btn=form.querySelector('button[type=submit]'),c=fv(form,'codigo').trim();
  if(!c){err.textContent='Digite o código.';return;}
  btn.disabled=true;err.textContent='';
  Dados.resgatarCodigo(c).then(function(r){
    if(!r.ok){err.textContent=r.erro||'Código inválido.';btn.disabled=false;return null;}
    return Dados.statusAcesso().then(function(st){LIC=st;return Dados.carregar();}).then(function(){
      closeModal();renderApp();toast('Plano Full ativado.');
    });
  }).catch(function(e){err.textContent='Não foi possível validar o código: '+((e&&e.message)||e);btn.disabled=false;});
}
