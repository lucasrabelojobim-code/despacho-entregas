'use strict';
/* Administrador: avisos na tela quando surge uma ocorrência nova (devolução, avaria, falta...) ou uma entrega passa do prazo.
   Funciona enquanto o app estiver aberto (a cada atualização do painel). Som e aviso do celular são opcionais. */
var AL={ini:false,oc:{},at:{},itens:[],som:true,ctx:null};
try{AL.som=localStorage.getItem('arcorota-alerta-som')!=='0';}catch(e){}

function alertasBip(){
  if(!AL.som)return;
  try{
    var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    if(!AL.ctx)AL.ctx=new AC();
    var c=AL.ctx,o=c.createOscillator(),g=c.createGain();
    o.type='sine';o.frequency.value=880;g.gain.value=0.08;o.connect(g);g.connect(c.destination);
    o.start();o.stop(c.currentTime+0.18);
  }catch(e){}
  try{if(navigator.vibrate)navigator.vibrate(120);}catch(e){}
}
function alertasNotifica(titulo,texto){
  try{
    if(!window.Notification||Notification.permission!=='granted'||!document.hidden)return;
    if(navigator.serviceWorker&&navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(function(r){r.showNotification(titulo,{body:texto,icon:'marca/admin-192.png',badge:'marca/admin-192.png',tag:'arcorota-alerta'});}).catch(function(){new Notification(titulo,{body:texto});});
    }else new Notification(titulo,{body:texto});
  }catch(e){}
}
function alertasChecar(){
  if(!(SESSION&&SESSION.role==='admin'&&window.DB))return;
  var novos=[];
  var oc=DB.ocorrencias||[],ent=DB.entregas||[],agora=Date.now();
  oc.forEach(function(o){
    if(AL.oc[o.id])return;AL.oc[o.id]=1;
    if(!AL.ini)return;
    var m=colab(o.motoristaId),tp=(typeof TIPOS_OC!=='undefined'&&TIPOS_OC[o.tipo])||o.tipo;
    novos.push({k:'oc'+o.id,ent:o.entregaId,t:'Ocorrência: '+tp,s:(o.entregaId?'Pedido #'+o.entregaId+' · ':'')+(m?m.nome:'')+(o.motivo?' · '+o.motivo:'')});
  });
  ent.forEach(function(e){
    if(e.status!=='em_rota'&&e.status!=='separado')return;
    if(AL.at[e.id]||!e.prazo||agora<=new Date(e.prazo).getTime())return;
    AL.at[e.id]=1;
    if(!AL.ini)return;
    var m=colab(e.motoristaId);
    novos.push({k:'at'+e.id,ent:e.id,t:(ehColeta(e)?'Coleta':'Entrega')+' atrasada: #'+e.id,s:e.cliente+(m?' · '+m.nome:'')+' · prazo '+hhmm(e.prazo)});
  });
  AL.ini=true;
  if(!novos.length)return;
  novos.forEach(function(n){AL.itens.push(n);});
  if(AL.itens.length>6)AL.itens=AL.itens.slice(-6);
  alertasBip();
  alertasNotifica(novos[0].t,novos[0].s+(novos.length>1?' (+'+(novos.length-1)+')':''));
  alertasDesenhar();
}
function alertasDesenhar(){
  var el=document.getElementById('alertas');
  if(!el){el=document.createElement('div');el.id='alertas';el.className='alertas';el.setAttribute('role','status');document.body.appendChild(el);}
  if(!AL.itens.length){el.innerHTML='';el.hidden=true;return;}
  el.hidden=false;
  var notif=window.Notification&&Notification.permission==='default';
  el.innerHTML=AL.itens.slice().reverse().map(function(n){
    return '<div class="alerta"><button type="button" class="alerta-c" data-act="al-abrir" data-id="'+(n.ent||'')+'" data-k="'+esc(n.k)+'"><b>'+esc(n.t)+'</b><span>'+esc(n.s)+'</span></button><button type="button" class="alerta-x" data-act="al-fechar" data-k="'+esc(n.k)+'" aria-label="Dispensar">×</button></div>';
  }).join('')+
  '<div class="alertas-f"><button type="button" class="btn btn-sm" data-act="al-som">Som: '+(AL.som?'ligado':'desligado')+'</button>'+
  (notif?'<button type="button" class="btn btn-sm" data-act="al-notif">Avisar no celular</button>':'')+
  '<button type="button" class="btn btn-sm" data-act="al-limpar">Limpar tudo</button></div>';
}
function alertasAcao(a,t,id){
  if(a==='al-fechar'){var k=t.dataset.k;AL.itens=AL.itens.filter(function(n){return n.k!==k;});alertasDesenhar();return true;}
  if(a==='al-limpar'){AL.itens=[];alertasDesenhar();return true;}
  if(a==='al-som'){AL.som=!AL.som;try{localStorage.setItem('arcorota-alerta-som',AL.som?'1':'0');}catch(e){}if(AL.som)alertasBip();alertasDesenhar();return true;}
  if(a==='al-notif'){try{Notification.requestPermission().then(function(){alertasDesenhar();});}catch(e){}return true;}
  if(a==='al-abrir'){
    var k2=t.dataset.k;AL.itens=AL.itens.filter(function(n){return n.k!==k2;});alertasDesenhar();
    var n2=/^\d+$/.test(String(id))?+id:null;
    if(n2&&entById(n2))openEntrega(n2);else{UI.view='ocorrencias';renderApp();}
    return true;
  }
  return false;
}
/* ao sair, limpa os avisos */
function alertasZerar(){AL.itens=[];AL.ini=false;AL.oc={};AL.at={};var el=document.getElementById('alertas');if(el){el.innerHTML='';el.hidden=true;}}
