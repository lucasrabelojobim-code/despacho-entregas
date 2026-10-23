'use strict';
/* Bloqueio do app com digital, rosto ou PIN do celular (WebAuthn).
   O login por usuário e senha continua igual. Depois de ativar, o app lembra da sessão e, ao abrir
   (ou voltar depois de alguns minutos), pede a digital/rosto em vez da senha.
   É um bloqueio do aparelho: quem sai do app ("Sair") volta a entrar com usuário e senha. */
var BIO={sup:false,travado:false,saiu:0,CH:'arcorota-bio',MIN:3};
function bioB64(buf){var s='',b=new Uint8Array(buf);for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function bioBuf(t){t=t.replace(/-/g,'+').replace(/_/g,'/');while(t.length%4)t+='=';var s=atob(t),b=new Uint8Array(s.length);for(var i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b.buffer;}
function bioRand(n){var a=new Uint8Array(n);(window.crypto||window.msCrypto).getRandomValues(a);return a;}
function bioUid(){return SESSION?String(SESSION.id||SESSION.role)+(SESSION.dev?':dev':''):'';}
function bioLer(){try{var o=JSON.parse(localStorage.getItem(BIO.CH)||'null');return o&&o.id&&o.uid?o:null;}catch(e){return null;}}
function bioAtivo(){var o=bioLer();return !!(o&&SESSION&&o.uid===bioUid());}
function bioDetectar(){
  try{
    if(!(window.PublicKeyCredential&&navigator.credentials&&PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable))return;
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function(ok){
      BIO.sup=!!ok;
      if(ok&&typeof renderApp==='function'&&SESSION&&!BIO.travado&&!ocupado())renderApp();
    }).catch(function(){});
  }catch(e){}
}
function bioAtivar(){
  return navigator.credentials.create({publicKey:{
    challenge:bioRand(32),rp:{name:'ArcosRotas'},
    user:{id:bioRand(16),name:'arcorota',displayName:'ArcosRotas'},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'discouraged'},
    timeout:60000,attestation:'none'}}).then(function(c){
    if(!c)throw new Error('cancelado');
    localStorage.setItem(BIO.CH,JSON.stringify({id:bioB64(c.rawId),uid:bioUid()}));
  });
}
function bioVerificar(){
  var o=bioLer();if(!o)return Promise.reject(new Error('sem cadastro'));
  return navigator.credentials.get({publicKey:{
    challenge:bioRand(32),allowCredentials:[{type:'public-key',id:bioBuf(o.id),transports:['internal']}],
    userVerification:'required',timeout:60000}}).then(function(c){if(!c)throw new Error('cancelado');return true;});
}
function bioDesativar(){try{localStorage.removeItem(BIO.CH);}catch(e){}}
/* ---- telas ---- */
function bioCard(){
  if(!BIO.sup||!SESSION)return '';
  var on=bioAtivo();
  return '<section class="dcard"><div class="row" style="justify-content:space-between"><b>Digital ou rosto</b>'+(on?'<span class="pill p-good"><i></i>Ativo</span>':'')+'</div>'+
    '<span class="note">'+(on?'O app pede a digital, o rosto ou o PIN do celular ao abrir. Para trocar de usuário, use Sair.':'Ative para abrir o app com a digital, o rosto ou o PIN do celular, sem digitar a senha toda vez.')+'</span>'+
    '<button class="btn btn-sm" style="align-self:flex-start" data-act="'+(on?'bio-desativar':'bio-ativar')+'">'+(on?'Desativar':'Ativar neste aparelho')+'</button></section>';
}
function viewBioLock(){
  return '<div class="login"><section class="login-side"><img class="logo-login" src="marca/logo.svg" alt="Arcos Jobim · Automação &amp; Software"><div class="prod">'+esc(typeof appNome==='function'?appNome():'ArcosRotas')+'</div>'+
    '<h1>App bloqueado.</h1><p class="dim">Use a digital, o rosto ou o PIN do celular para continuar.</p></section>'+
    '<section class="login-form"><h2>Desbloquear</h2><div class="err" id="bio-err" role="alert">'+esc(BIO.erro||'')+'</div>'+
    '<button class="btn btn-primary btn-lg" type="button" data-act="bio-unlock">Desbloquear com digital ou rosto</button>'+
    '<button class="btn" type="button" data-act="bio-sair" style="margin-top:10px">Entrar com outro usuário</button></section></div>';
}
function bioTrava(){
  if(!SESSION||!bioAtivo())return;
  BIO.travado=true;BIO.erro='';renderApp();
  setTimeout(function(){if(BIO.travado)bioPedir(true);},350);
}
function bioPedir(auto){
  bioVerificar().then(function(){BIO.travado=false;BIO.erro='';renderApp();}).catch(function(e){
    if(!BIO.travado)return;
    BIO.erro=auto?'':'Não foi possível confirmar. Tente de novo.';
    var el=document.getElementById('bio-err');if(el)el.textContent=BIO.erro;
  });
}
function bioAcao(a){
  switch(a){
    case 'bio-ativar':
      if(!bioAtivo()){bioAtivar().then(function(){toast('Digital/rosto ativado neste aparelho');renderApp();if(!ov.hidden&&typeof openDados==='function'&&SESSION&&SESSION.role==='admin')openDados();}).catch(function(){toast('Não foi possível ativar. Confira se o celular tem digital, rosto ou PIN configurado.');});}
      return true;
    case 'bio-desativar':bioDesativar();toast('Digital/rosto desativado');renderApp();if(!ov.hidden&&SESSION&&SESSION.role==='admin')openDados();return true;
    case 'bio-unlock':bioPedir(false);return true;
    case 'bio-sair':BIO.travado=false;logout();return true;
  }
  return false;
}
/* travar de novo ao voltar depois de alguns minutos fora do app */
document.addEventListener('visibilitychange',function(){
  if(document.hidden){BIO.saiu=Date.now();return;}
  if(BIO.saiu&&Date.now()-BIO.saiu>BIO.MIN*60000&&SESSION&&!BIO.travado&&bioAtivo())bioTrava();
});
bioDetectar();
