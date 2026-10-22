'use strict';
/* Início do site: escolhe a camada de dados, monta as telas e atualiza o painel. */
var Dados=(CONFIG.supabaseUrl&&CONFIG.supabaseKey&&window.supabase)?DadosOnline:DadosLocal;

function renderApp(){
  if(!SESSION){app.innerHTML=viewLogin()+rodape();return;}
  /* plano vencido, empresa bloqueada ou usuário bloqueado: só a tela de bloqueio */
  if(LIC&&LIC.liberado===false){closeModal();gpsDesligar();app.innerHTML=viewBloqueio()+rodape();return;}
  if(SESSION.role==='admin'){app.innerHTML=bannerPlano()+adminShell()+rodape();mountAdmin();}
  else{
    app.innerHTML=bannerPlano()+driverShell()+rodape();
    if(UI.drv.screen==='confirm')syncConf();else if(UI.drv.screen==='abast')dicaKm();else if(usaReal())mrDriver();
  }
}

var tAtualiza=null;
function ocupado(){
  var tag=((document.activeElement||{}).tagName||'');
  return !ov.hidden||(UI.view==='historico'&&SESSION&&SESSION.role==='admin')||(UI.view==='desenvolvedor'&&(UI.dev.aba==='empresa'||UI.dev.aba==='limpar'))||UI.drv.screen==='confirm'||UI.drv.screen==='abast'||/INPUT|TEXTAREA|SELECT/.test(tag);
}
function tick(){
  if(!SESSION)return;
  if(Dados.modo==='online'){
    /* confere o plano a cada ciclo: se vencer ou for bloqueado, a tela de bloqueio entra sozinha */
    Dados.statusAcesso().then(function(st){
      var estava=!LIC||LIC.liberado!==false;
      LIC=st;
      if(st.liberado===false){if(estava)renderApp();return null;}
      if(!estava)return Dados.carregar().then(renderApp);
      return Dados.atualizar().then(function(mudou){
        alertasChecar();
        if(ocupado())return;
        if(mudou||(SESSION.role==='admin'&&UI.view==='mapa'))renderApp();
      });
    }).catch(function(){});
  }else{
    alertasChecar();
    if(SESSION.role==='admin'&&UI.view==='mapa'&&!ocupado())mountAdmin();
  }
}
function iniciarAtualizacao(){
  if(tAtualiza)return;
  tAtualiza=setInterval(tick,(Dados.modo==='online'?(CONFIG.atualizarSeg||15):20)*1000);
}

function boot(){
  var h=location.hash||'';
  app.innerHTML='<div class="carregando">Carregando…</div>';
  if(h.indexOf('#u-')===0){try{UI.prefill=decodeURIComponent(h.slice(3));}catch(e){}}
  Dados.restaurar().then(function(s){
    /* link de motorista (#u-usuario): se houver sessão de admin neste navegador, encerra e mostra o login */
    if(Dados.modo==='online'&&h.indexOf('#u-')===0&&s&&s.role==='admin'){
      return Dados.sair().then(function(){return null;});
    }
    return s;
  }).then(function(s){
    var mm=modoMsg(s);if(mm){UI.loginMsg=mm;s=null;}
    SESSION=s||null;
    if(Dados.modo==='local'&&h.indexOf('#mot-')===0){
      var c=DB.colaboradores.find(function(x){return x.token&&('mot-'+x.token)===h.slice(1);});
      if(c&&c.ativo!==false){SESSION={role:'driver',id:c.id,via:'link'};UI.drv={screen:'home',id:null};}
      else{SESSION=null;UI.loginMsg='Link inválido ou desativado. Entre com usuário e senha.';}
    }
    if(!(Dados.modo==='local'||SESSION))return null;
    return Dados.statusAcesso().then(function(st){
      LIC=st;
      return st.liberado===false?null:Dados.carregar();
    });
  }).then(function(){
    renderApp();alertasChecar();iniciarAtualizacao();
  }).catch(function(err){
    app.innerHTML='<div style="padding:24px"><b>Não foi possível iniciar.</b><p class="muted">'+esc(err&&err.message)+'</p></div>';
  });
}
boot();
