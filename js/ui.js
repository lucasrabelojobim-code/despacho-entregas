'use strict';
/* ============ interface: estado ============ */
var UI={view:'dashboard',periodo:'hoje',mapTipo:'',mapSel:null,f:{q:'',status:'',mot:'',tipo:'',op:'',dia:'hoje'},c:{q:'',tipo:''},o:{tipo:'',mt:'',dia:'7d'},vei:{q:'',tipo:''},ab:{vei:'',mot:'',dia:'30d',alerta:''},drv:{screen:'home',id:null},foto:null,fotoOd:null,fotoNt:null,signed:false,loginMsg:'',prefill:'',mapa:(CONFIG.mapaReal!==false&&window.L)?'real':'esq'};
var app=$('#app'),ov=$('#ov'),toastEl=$('#toast'),toastT=null;
function toast(t){toastEl.textContent=t;toastEl.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){toastEl.hidden=true;},3200);}
function openModal(html,narrow){ov.innerHTML='<div class="dlg'+(narrow?' narrow':'')+'" role="dialog" aria-modal="true">'+html+'</div>';ov.hidden=false;var f=ov.querySelector('[autofocus]');if(f)f.focus();}
function closeModal(){ov.hidden=true;ov.innerHTML='';}
function mh(title,sub){return '<div class="dlg-h"><div><h2>'+title+'</h2>'+(sub?'<div class="muted" style="margin-top:4px">'+sub+'</div>':'')+'</div><button class="btn btn-sm" data-act="close" type="button">Fechar</button></div>';}
function mark(){return '<span class="mk-badge"><img class="mk" src="marca/icone.png" alt="Arcos Jobim" width="30" height="30"></span>';}
function rodape(){return '<footer class="rodape"><span class="mk-badge mk-sm"><img class="mk" src="marca/icone.png" alt="" width="20" height="20"></span><span>Desenvolvido por <b>Arcos Jobim</b> · Automação &amp; Software</span></footer>';}
function save(){return Dados.salvar();}
/* ============ login ============ */
function viewLogin(){
  return '<div class="login">'+
  '<section class="login-side"><img class="logo-login" src="marca/logo.svg" alt="Arcos Jobim · Automação &amp; Software"><div class="prod">'+appNome()+'</div>'+
  '</section>'+
  '<section class="login-form"><h2>Entrar</h2>'+
  '<form id="f-login" autocomplete="off" class="dlg-b" style="padding:0"><div class="field"><label for="lg-u">Usuário</label><input id="lg-u" name="u" autocapitalize="none" required value="'+esc(UI.prefill)+'"></div>'+
  '<div class="field"><label for="lg-p">Senha</label><input id="lg-p" name="p" type="password" required></div>'+
  '<div class="err" id="lg-err" role="alert">'+esc(UI.loginMsg)+'</div>'+
  '<button class="btn btn-primary btn-lg" type="submit">Entrar</button></form>'+
  (Dados.modo==='local'?'<div class="demo"><span class="lbl">Contas de demonstração</span>'+
  '<button type="button" data-act="login-demo" data-u="admin" data-p="admin123"><span><b>Administrador</b><span class="sub">Painel, entregas, colaboradores</span></span><small>admin / admin123</small></button>'+
  '<button type="button" data-act="login-demo" data-u="joao" data-p="1234"><span><b>João Pereira</b> <span class="tag tag-ef">Efetivado</span><span class="sub">Visão do motorista no celular</span></span><small>joao / 1234</small></button>'+
  '<button type="button" data-act="login-demo" data-u="carlos" data-p="1234"><span><b>Carlos Nogueira</b> <span class="tag tag-ter">Terceirizado</span><span class="sub">Transportes Rio Negro</span></span><small>carlos / 1234</small></button></div>':'<p class="note">Entre com o usuário e a senha fornecidos pela administração.</p>')+
  pwaHtml()+'</section></div>';
}
/* ============ cadastro no 1º acesso ============ */
var CAD={pendente:false,erro:''};
function conferirCadastro(){
  CAD={pendente:false,erro:''};
  if(!SESSION||SESSION.dev||(LIC&&LIC.dev)||!Dados.meuCadastro)return Promise.resolve();
  return Dados.meuCadastro().then(function(c){CAD.pendente=!c;});
}
function viewCadastro(){
  var adm=SESSION.role==='admin';
  return '<div class="login">'+
  '<section class="login-side"><img class="logo-login" src="marca/logo.svg" alt="Arcos Jobim · Automação &amp; Software"><div class="prod">'+appNome()+'</div>'+
  '<p class="dim">Primeiro acesso: preencha seus dados uma única vez para continuar.</p></section>'+
  '<section class="login-form"><h2>Cadastro</h2>'+
  '<form id="f-cad" autocomplete="on" class="dlg-b" style="padding:0">'+
  '<div class="field"><label for="cd-n">Nome completo</label><input id="cd-n" name="nome" autocomplete="name" required minlength="3" maxlength="120"></div>'+
  (adm?'<div class="field"><label for="cd-emp">Nome da empresa</label><input id="cd-emp" name="empresa" autocomplete="organization" required maxlength="120"></div>':'')+
  '<div class="field"><label for="cd-e">Email</label><input id="cd-e" name="email" type="email" autocomplete="email" autocapitalize="none" required maxlength="160"></div>'+
  (adm?'':'<div class="field"><label for="cd-v">Vínculo</label><select id="cd-v" name="vinculo" required>'+opts([['','Escolha…'],['Efetivado','Efetivado (funcionário da empresa)'],['Terceirizado','Terceirizado']],'')+'</select></div>'+
    '<div class="field" id="cd-terc" hidden><label for="cd-et">De qual empresa?</label><input id="cd-et" name="empresa" maxlength="120"></div>')+
  '<div class="err" id="cd-err" role="alert">'+esc(CAD.erro)+'</div>'+
  '<button class="btn btn-primary btn-lg" type="submit">Salvar e continuar</button></form>'+
  '<p class="note">'+(adm?'Esses dados ficam guardados com segurança e só a Arcos Jobim tem acesso.':'Esses dados ficam com a administração da empresa.')+'</p>'+
  '<button class="btn" type="button" data-act="logout">Sair</button></section></div>';
}
function salvarCadastro(f){
  var d={nome:fv(f,'nome').trim(),email:fv(f,'email').trim(),empresa:fv(f,'empresa').trim(),vinculo:fv(f,'vinculo')||null};
  var err=$('#cd-err'),bt=f.querySelector('button[type=submit]');
  function erro(m){if(err)err.textContent=m;if(bt)bt.disabled=false;}
  if(d.nome.split(/\s+/).length<2)return erro('Informe o nome completo (nome e sobrenome).');
  if(d.vinculo==='Terceirizado'&&!d.empresa)return erro('Informe a empresa terceirizada.');
  if(d.vinculo==='Efetivado')d.empresa='';
  if(bt)bt.disabled=true;
  Dados.salvarCadastro(d).then(function(){
    CAD={pendente:false,erro:''};
    return Dados.carregar();
  }).then(function(){renderApp();window.scrollTo(0,0);toast('Cadastro salvo.');})
  .catch(function(e){erro('Não foi possível salvar: '+((e&&e.message)||e));});
}
function doLogin(u,p){
  Dados.entrar(u,p).then(function(r){
    if(r.erro){UI.loginMsg=r.erro;renderApp();return null;}
    var mm=modoMsg(r.sessao);
    if(mm){UI.loginMsg=mm;return Dados.sair().then(function(){renderApp();return null;});}
    SESSION=r.sessao;
    /* plano vencido ou bloqueado: não carrega os dados, o app mostra a tela de bloqueio */
    return Dados.statusAcesso().then(function(st){
      LIC=st;
      return st.liberado===false?null:conferirCadastro().then(function(){return Dados.carregar();});
    }).then(function(){
      UI.loginMsg='';UI.drv={screen:'home',id:null};UI.view='dashboard';saveSession();renderApp();window.scrollTo(0,0);
    });
  }).catch(function(e){SESSION=null;LIC=null;UI.loginMsg='Erro ao entrar: '+((e&&e.message)||e);renderApp();});
}
function logout(){
  gpsDesligar();alertasZerar();
  LIC=null;CAD={pendente:false,erro:''};
  var fim=Dados.sair();
  SESSION=null;saveSession();
  try{if(location.hash)history.replaceState(null,'',location.pathname+location.search);}catch(e){}
  renderApp();window.scrollTo(0,0);
  return fim;
}
