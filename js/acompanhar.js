'use strict';
/* Página pública do cliente: mostra o andamento de UMA entrega pelo link secreto (sem login).
   Dados vêm da função acompanhar() do banco (banco/07-acompanhamento-cliente.sql), que só devolve o necessário. */
var AC={tok:null,cli:null,map:null,mM:null,mD:null,rota:null,eta:null,timer:null,ultRota:'',viu:false};
function acEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function acHora(iso){if(!iso)return '';var d=new Date(iso);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
function acKm(a,b){var R=6371,t=Math.PI/180,x=(b[0]-a[0])*t,y=(b[1]-a[1])*t,h=Math.sin(x/2)*Math.sin(x/2)+Math.cos(a[0]*t)*Math.cos(b[0]*t)*Math.sin(y/2)*Math.sin(y/2);return 2*R*Math.asin(Math.sqrt(h));}
function acDur(min){min=Math.max(1,Math.round(min));return min<60?min+' min':Math.floor(min/60)+'h'+('0'+(min%60)).slice(-2);}
function acTitulo(r){return r.tipo==='coleta'?'Sua coleta':'Sua entrega';}
function acEstado(r){
  var col=r.tipo==='coleta',s=r.status;
  if(s==='cancelada')return {t:col?'Coleta cancelada':'Pedido cancelado',c:'bad',passo:0};
  if(s==='entregue')return {t:col?'Coletado com sucesso':'Entregue com sucesso',c:'ok',passo:3};
  if(s==='entregue_problema')return {t:col?'Coleta concluída com ocorrência':'Entregue com ocorrência',c:'warn',passo:3};
  if(s==='devolvido')return {t:col?'Não foi possível coletar':'Não foi possível entregar',c:'bad',passo:3};
  if(s==='enviado_errado')return {t:'Houve um problema com o pedido',c:'bad',passo:3};
  if(s==='em_rota')return {t:col?'O motorista está a caminho para coletar':'O motorista está a caminho',c:'',passo:2};
  return {t:col?'Coleta agendada':'Pedido separado, aguardando a saída',c:'',passo:1};
}
function acPassos(r,e){
  var col=r.tipo==='coleta',n=e.passo;
  var nomes=['Separado',col?'A caminho da coleta':'Saiu para entrega',col?'Coletado':'Entregue'];
  return '<div class="steps">'+nomes.map(function(x,i){return '<div class="step'+(i<n?' on':'')+(i===2&&n===3&&e.c==='ok'?' fim':'')+'"><i></i>'+x+'</div>';}).join('')+'</div>';
}
function acPinta(html){document.getElementById('topo').innerHTML=html;}
function acSemMapa(){var b=document.getElementById('mapaBox');if(b)b.innerHTML='';if(AC.map){try{AC.map.remove();}catch(e){}AC.map=null;AC.mM=null;AC.mD=null;AC.rota=null;}}
function acMapa(r){
  var temD=r.destino_lat!=null&&r.destino_lng!=null,temM=r.pos_lat!=null&&r.pos_lng!=null;
  var el=document.getElementById('mapa');
  if(!el||!window.L||!temD){return;}
  var d=[r.destino_lat,r.destino_lng];
  if(!AC.map||AC.map._container!==el){
    AC.map=L.map(el,{zoomControl:true,attributionControl:true}).setView(d,14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(AC.map);
    AC.mM=null;AC.mD=null;AC.rota=null;
  }
  function ic(c,t){return L.divIcon({className:'',html:'<div class="mk '+c+'">'+t+'</div>',iconSize:[30,30],iconAnchor:[15,15]});}
  if(!AC.mD)AC.mD=L.marker(d,{icon:ic('d','Você')}).addTo(AC.map);else AC.mD.setLatLng(d);
  if(temM){
    var m=[r.pos_lat,r.pos_lng];
    if(!AC.mM)AC.mM=L.marker(m,{icon:ic('m','🚚'),zIndexOffset:1000}).addTo(AC.map);else AC.mM.setLatLng(m);
    AC.map.fitBounds([m,d],{padding:[40,40],maxZoom:16});
  }else if(AC.mM){AC.map.removeLayer(AC.mM);AC.mM=null;if(AC.rota){AC.map.removeLayer(AC.rota);AC.rota=null;}AC.map.setView(d,15);}
  setTimeout(function(){try{AC.map.invalidateSize();}catch(e){}},200);
}
/* tempo até chegar: pelas ruas (OSRM); se falhar, linha reta com velocidade média */
function acEta(r){
  if(r.status!=='em_rota'||r.pos_lat==null||r.destino_lat==null){AC.eta=null;acPintaEta();return;}
  var o=[r.pos_lat,r.pos_lng],d=[r.destino_lat,r.destino_lng];
  var reta=Math.round(acKm(o,d)*1.3/25*60);
  AC.eta={min:reta,via:'reta'};acPintaEta();
  var chave=o[0].toFixed(3)+','+o[1].toFixed(3);
  if(chave===AC.ultRota&&AC.etaRuas){AC.eta=AC.etaRuas;acPintaEta();return;}
  AC.ultRota=chave;
  try{
    fetch('https://router.project-osrm.org/route/v1/driving/'+o[1].toFixed(5)+','+o[0].toFixed(5)+';'+d[1].toFixed(5)+','+d[0].toFixed(5)+'?overview=full&geometries=geojson')
    .then(function(x){return x.json();}).then(function(j){
      var rt=j&&j.code==='Ok'&&j.routes&&j.routes[0];if(!rt)return;
      AC.etaRuas={min:Math.round(rt.duration/60),via:'ruas'};AC.eta=AC.etaRuas;acPintaEta();
      if(AC.map&&window.L){if(AC.rota)AC.map.removeLayer(AC.rota);AC.rota=L.polyline(rt.geometry.coordinates.map(function(q){return [q[1],q[0]];}),{color:'#3B8EEA',weight:5,opacity:.85}).addTo(AC.map);}
    }).catch(function(){});
  }catch(e){}
}
function acPintaEta(){
  var el=document.getElementById('eta');if(!el)return;
  el.innerHTML=AC.eta?'Chega em ~'+acDur(AC.eta.min)+'<div class="note">Estimativa'+(AC.eta.via==='reta'?' aproximada':' pelas ruas')+', sem considerar o trânsito.</div>':'';
}
function acTela(r){
  if(!r){acSemMapa();acPinta('<div class="card"><h1>Link inválido</h1><p class="sub">Este link não existe ou foi desativado. Peça um novo link à empresa.</p></div>');return false;}
  if(r.expirado){acSemMapa();acPinta('<div class="card"><h1>Link encerrado</h1><p class="sub">O acompanhamento desta entrega já terminou. Obrigado!</p></div>');return false;}
  var e=acEstado(r),emRota=r.status==='em_rota';
  var h='<h1>'+acEsc(acTitulo(r))+'</h1><p class="sub">'+(r.cliente?acEsc(r.cliente)+' · ':'')+(r.prazo?'previsto até '+acHora(r.prazo):'')+'</p>'+
    '<div class="card"><div class="big '+e.c+'">'+acEsc(e.t)+'</div>'+
    (emRota?'<div class="big" id="eta" style="margin-top:10px;font-size:28px"></div>':'')+
    (r.motorista&&emRota?'<p class="note" style="margin:8px 0 0">Motorista: '+acEsc(r.motorista)+'</p>':'')+
    (r.concluido_em?'<p class="note" style="margin:8px 0 0">'+(r.status==='cancelada'?'Cancelado às ':'Concluído às ')+acHora(r.concluido_em)+'</p>':'')+
    (r.status==='cancelada'?'<p class="note" style="margin:8px 0 0">Em caso de dúvida, fale com a empresa.</p>':acPassos(r,e))+'</div>';
  var querMapa=r.destino_lat!=null&&r.status!=='devolvido'&&r.status!=='enviado_errado'&&!r.concluido_em;
  h+='<p class="note">'+(querMapa?(emRota?(r.pos_lat==null?'Aguardando o sinal do motorista… ':''):'A posição do motorista aparece no mapa quando ele sair. '):'')+'Esta página atualiza sozinha.</p>';
  acPinta(h);
  if(querMapa){var bx=document.getElementById('mapaBox');if(!document.getElementById('mapa'))bx.innerHTML='<div id="mapa"></div>';acMapa(r);}else acSemMapa();
  acEta(r);
  return !r.concluido_em;
}
function acBuscar(){
  AC.cli.rpc('acompanhar',{p_token:AC.tok}).then(function(x){
    if(x.error)throw x.error;
    AC.viu=true;var seguir=acTela(x.data);
    clearTimeout(AC.timer);if(seguir)AC.timer=setTimeout(acBuscar,20000);
  }).catch(function(){
    if(!AC.viu)acPinta('<div class="card"><h1>Sem conexão</h1><p class="sub">Não foi possível carregar agora. Vamos tentar de novo…</p></div>');
    clearTimeout(AC.timer);AC.timer=setTimeout(acBuscar,15000);
  });
}
(function(){
  var m=/[?&]t=([0-9a-f]{32,})/i.exec(location.search);
  if(!m||!window.CONFIG||!CONFIG.supabaseUrl||!window.supabase){acTela(null);return;}
  AC.tok=m[1];
  AC.cli=supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false}});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)acBuscar();});
  acBuscar();
})();
