'use strict';
/* App instalável (PWA): registra o service worker, oferece "Instalar o app" e avisa quando há versão nova.
   Nada aqui mexe nos dados: é só a casca do app. */
var PWA={prompt:null,instalado:false};
function pwaStandalone(){
  try{return (window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;}catch(e){return false;}
}
function pwaIOS(){
  var ua=navigator.userAgent||'';
  return /iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}
/* qual app está aberto: 'admin', 'colab' ou nada (página geral) */
function appModo(){return window.APP_MODO||'';}
function appNome(){var m=appModo();return m==='admin'?'ArcosRotas Admin':m==='colab'?'ArcosRotas Motorista':'ArcosRotas';}
/* cada app só aceita o seu tipo de usuário (a sessão é compartilhada com o navegador, então confere também ao abrir) */
function modoMsg(s){
  if(!s)return '';
  if(appModo()==='admin'&&s.role!=='admin')return 'Este usuário é de motorista. Use o app ArcosRotas Motorista.';
  if(appModo()==='colab'&&s.role==='admin')return 'Este usuário é administrador. Use o app ArcosRotas Admin.';
  return '';
}
/* APK para Android (gerado pelo GitHub: .github/workflows/apk-motorista.yml) */
var APK_BASE='https://github.com/lucasrabelojobim-code/despacho-entregas/releases/latest/download/';
function apkLink(modo){
  var mot=modo!=='admin';
  return '<a class="btn btn-lg btn-primary" href="'+APK_BASE+(mot?'ArcosRotas-Motorista.apk':'ArcosRotas-Admin.apk')+'">Baixar app '+(mot?'do Motorista':'Admin')+' para Android (APK)</a>';
}
/* bloco da tela de login */
function pwaHtml(){
  if(!appModo())return '<div class="pwa-box"><b>Instalar no celular</b><span class="note">Escolha o app certo:</span><a class="btn btn-lg" href="admin.html">ArcosRotas Admin · administração</a><a class="btn btn-lg" href="colaborador.html">ArcosRotas Motorista · efetivados e terceirizados</a>'+(pwaIOS()?'':apkLink('admin')+apkLink('colab'))+'<a class="note" href="instalar.html">Ver QR codes para instalar</a></div>';
  if(pwaStandalone()||PWA.instalado||apkNativo())return '';   /* dentro do APK já está instalado */
  if(PWA.prompt)return '<div class="pwa-box"><button class="btn btn-lg" type="button" data-act="pwa-instalar">Instalar o '+appNome()+' no celular</button><span class="note">Fica com o ícone na tela, abre em tela cheia e recebe as atualizações sozinho.</span>'+apkLink(appModo())+'<span class="note">O APK é o app completo para Android'+(appModo()==='colab'?', com GPS funcionando mesmo com o Maps aberto':'')+'.</span></div>';
  if(pwaIOS())return '<div class="pwa-box"><b>Instalar no iPhone</b><span class="note">Abra este endereço no <b>Safari</b>, toque em <b>Compartilhar</b> (quadrado com seta) e depois em <b>Adicionar à Tela de Início</b>.</span></div>';
  return '<div class="pwa-box"><b>Instalar no Android</b>'+apkLink(appModo())+'<span class="note">Baixe e toque no arquivo para instalar. Se o celular pedir, permita instalar apps desta fonte.'+(appModo()==='colab'?' Com o APK, o GPS continua funcionando com o Maps aberto ou a tela apagada.':'')+'</span></div>';
}
function pwaAcao(a){
  if(a!=='pwa-instalar')return false;
  var p=PWA.prompt;if(!p)return true;
  PWA.prompt=null;
  try{p.prompt();p.userChoice.then(function(r){if(r&&r.outcome==='accepted')PWA.instalado=true;if(!SESSION)renderApp();});}catch(e){}
  return true;
}
window.addEventListener('beforeinstallprompt',function(ev){ev.preventDefault();PWA.prompt=ev;if(typeof renderApp==='function'&&!SESSION&&!ocupado())renderApp();});
window.addEventListener('appinstalled',function(){PWA.instalado=true;PWA.prompt=null;if(typeof renderApp==='function'&&!SESSION)renderApp();});

/* aviso de versão nova: compara a versão carregada com a do index.html no servidor */
function pwaVersaoAtual(){
  var s=document.querySelector('script[src*="js/app.js"]'),m=s&&/[?&]v=([\w.-]+)/.exec(s.getAttribute('src'));
  return m?m[1]:null;
}
function pwaAviso(){
  if(document.getElementById('pwa-novo'))return;
  var d=document.createElement('div');d.id='pwa-novo';d.className='pwa-novo';d.setAttribute('role','status');
  d.innerHTML='<span>Nova versão disponível.</span><button type="button" class="btn btn-sm btn-primary" id="pwa-novo-ok">Atualizar</button>';
  document.body.appendChild(d);
  document.getElementById('pwa-novo-ok').addEventListener('click',function(){
    try{if(window.caches)caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);}));}).then(function(){location.reload();},function(){location.reload();});else location.reload();}catch(e){location.reload();}
  });
}
function pwaConferir(){
  var atual=pwaVersaoAtual();if(!atual||!window.fetch)return;
  try{
    fetch('index.html?_='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.text():'';}).then(function(t){
      var m=/js\/app\.js\?v=([\w.-]+)/.exec(t||'');
      if(m&&m[1]!==atual)pwaAviso();
    }).catch(function(){});
  }catch(e){}
}
(function(){
  var seguro=location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1';
  if('serviceWorker' in navigator&&seguro){
    window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});
  }
  if(seguro){
    setTimeout(pwaConferir,20000);
    setInterval(pwaConferir,10*60*1000);
    document.addEventListener('visibilitychange',function(){if(!document.hidden)pwaConferir();});
  }
})();
