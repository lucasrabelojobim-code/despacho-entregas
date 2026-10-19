'use strict';
/* Início do site: escolhe a camada de dados, monta as telas e atualiza o painel. */
var Dados=(CONFIG.supabaseUrl&&CONFIG.supabaseKey&&window.supabase)?DadosOnline:DadosLocal;

function renderApp(){
  if(!SESSION){app.innerHTML=viewLogin()+rodape();return;}
  if(SESSION.role==='admin'){app.innerHTML=adminShell()+rodape();mountAdmin();}
  else{
    app.innerHTML=driverShell()+rodape();
    if(UI.drv.screen==='confirm')syncConf();else if(usaReal())mrDriver();
  }
}

var tAtualiza=null;
function ocupado(){
  var tag=((document.activeElement||{}).tagName||'');
  return !ov.hidden||UI.drv.screen==='confirm'||/INPUT|TEXTAREA|SELECT/.test(tag);
}
function tick(){
  if(!SESSION)return;
  if(Dados.modo==='online'){
    Dados.atualizar().then(function(mudou){
      if(ocupado())return;
      if(mudou||(SESSION.role==='admin'&&UI.view==='mapa'))renderApp();
    });
  }else if(SESSION.role==='admin'&&UI.view==='mapa'&&!ocupado()){mountAdmin();}
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
    SESSION=s||null;
    if(Dados.modo==='local'&&h.indexOf('#mot-')===0){
      var c=DB.colaboradores.find(function(x){return x.token&&('mot-'+x.token)===h.slice(1);});
      if(c&&c.ativo!==false){SESSION={role:'driver',id:c.id,via:'link'};UI.drv={screen:'home',id:null};}
      else{SESSION=null;UI.loginMsg='Link inválido ou desativado. Entre com usuário e senha.';}
    }
    return (Dados.modo==='local'||SESSION)?Dados.carregar():null;
  }).then(function(){
    renderApp();iniciarAtualizacao();
  }).catch(function(err){
    app.innerHTML='<div style="padding:24px"><b>Não foi possível iniciar.</b><p class="muted">'+esc(err&&err.message)+'</p></div>';
  });
}
boot();
