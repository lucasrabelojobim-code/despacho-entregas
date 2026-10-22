'use strict';
/* Modo sem sinal do motorista: avisa na tela e envia o que ficou pendente quando a internet volta. */
function bannerOffline(){
  if(Dados.modo!=='online'||!SESSION||SESSION.role!=='driver')return '';
  var n=Dados.pendentes(),off=Dados.offline(),falha=Dados.semEnvio();
  if(!off&&!n&&!falha)return '';
  var txt=off?'Sem sinal · o app continua funcionando e envia tudo quando a internet voltar':'Sincronizando com a empresa…';
  if(n)txt+=' ('+n+(n===1?' alteração aguardando envio':' alterações aguardando envio')+')';
  if(Dados.fotosPerdidas())txt+='. Atenção: as fotos desta vez só ficam guardadas se o app permanecer aberto';
  return '<div class="plan-bar offline-bar" role="status"><span>'+esc(txt)+'</span></div>';
}
window.addEventListener('online',function(){
  if(!SESSION||Dados.modo!=='online')return;
  toast('Internet de volta. Enviando…');
  Dados.sincronizar().then(function(){if(!ocupado())renderApp();});
});
window.addEventListener('offline',function(){if(SESSION&&SESSION.role==='driver'&&!ocupado())renderApp();});
