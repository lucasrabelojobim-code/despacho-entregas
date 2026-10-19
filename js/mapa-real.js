'use strict';
/* Mapa real (OpenStreetMap + Leaflet) e GPS do celular do motorista. */
var MR={adm:null,drv:null,pick:null,voce:null,view:null,marcaPick:null};
var GPS={ativo:false,watch:null,pos:null,ultimoEnvio:0,erro:''};

function usaReal(){return UI.mapa==='real'&&!!window.L;}
/* o mapa esquemático de exemplo é desenhado sobre uma área de Manaus */
function toLL(p){return [-3.08-p.y/520*0.07,-60.06+p.x/800*0.08];}
function fromLL(lat,lng){return {x:Math.max(0,Math.min(800,(lng+60.06)/0.08*800)),y:Math.max(0,Math.min(520,(-3.08-lat)/0.07*520))};}
function llOf(e){return (e.lat!=null&&e.lng!=null)?[e.lat,e.lng]:toLL(pos(e));}
function corHex(c){
  var v=getComputedStyle(document.documentElement).getPropertyValue('--d'+((Math.max(0,DB.colaboradores.indexOf(c))%8)+1)).trim();
  return v||'#0B6BB8';
}
function novoMapa(id,centro,zoom){
  var m=L.map(id,{zoomControl:true,attributionControl:true}).setView(centro,zoom);
  var t=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(m);
  t.on('tileerror',function(){var n=document.getElementById('mr-aviso');if(n)n.hidden=false;});
  return m;
}
function matar(k){if(MR[k]){try{MR[k].remove();}catch(e){}MR[k]=null;}}
function icone(html,cls,tam){return L.divIcon({className:cls||'',html:html,iconSize:[tam,tam],iconAnchor:[tam/2,tam/2]});}
function ini2(c){return ini(c);}
function ageMin(iso){return Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));}

/* ---- administrador ---- */
function mrAdmin(rs){
  var el=document.getElementById('rmap');if(!el)return;
  matar('adm');
  var m=novoMapa('rmap',MR.view?MR.view.c:toLL(EMP),MR.view?MR.view.z:13);
  MR.adm=m;
  var gp=Dados.posicoes(),b=[];
  var emp=toLL(EMP);b.push(emp);
  L.marker(emp,{icon:icone('<div class="mk-emp">E</div>','',26),title:'Empresa'}).addTo(m).bindPopup('<b>Empresa</b><br>Ponto de saída');
  rs.forEach(function(r){
    var cor=corHex(r.c),dim=UI.mapSel&&UI.mapSel!==r.c.id,op=dim?0.25:1;
    var pts=[emp].concat(r.stops.map(llOf));
    L.polyline(pts,{color:cor,weight:4,opacity:op*0.8,dashArray:'8 8'}).addTo(m);
    r.stops.forEach(function(e,i){
      var done=isConcl(e),p=llOf(e);b.push(p);
      L.marker(p,{icon:icone('<div class="mk-stop'+(done?' done':'')+'" style="--c:'+cor+'">'+(i+1)+'</div>','',24),opacity:op}).addTo(m)
        .bindPopup('<b>Parada '+(i+1)+': '+esc(e.cliente)+'</b><br>'+esc(e.endereco)+'<br>'+STATUS[e.status].l+' · prazo '+hhmm(e.prazo));
    });
    var g=gp[r.c.id],vivo=g&&ageMin(g.em)<=10,p2=vivo?[g.lat,g.lng]:toLL(r.pos);b.push(p2);
    L.marker(p2,{icon:icone('<div class="mk-drv'+(r.c.tipo==='Terceirizado'?' ter':'')+(vivo?'':' sim')+'" style="--c:'+cor+'">'+esc(ini2(r.c))+'</div>','',34),opacity:op,zIndexOffset:1000}).addTo(m)
      .bindPopup('<b>'+esc(r.c.nome)+'</b> ('+esc(r.c.tipo)+')<br>'+(vivo?'GPS do celular · há '+ageMin(g.em)+' min':'Posição simulada (sem GPS ativo)'))
      .on('click',function(){UI.mapSel=(UI.mapSel===r.c.id?null:r.c.id);});
  });
  if(!MR.view&&b.length>1)m.fitBounds(b,{padding:[30,30],maxZoom:15});
  m.on('moveend',function(){MR.view={c:m.getCenter(),z:m.getZoom()};});
}
function mrPrecisaReset(){MR.view=null;}

/* ---- motorista ---- */
function mrDriver(){
  var el=document.getElementById('rmap-drv');if(!el)return;
  var c=colab(SESSION.id),r=routeOf(c,'driver');if(!r)return;
  matar('drv');MR.voce=null;
  var emp=toLL(EMP),m=novoMapa('rmap-drv',emp,13),b=[emp];
  MR.drv=m;
  L.marker(emp,{icon:icone('<div class="mk-emp">E</div>','',26)}).addTo(m).bindPopup('<b>Empresa</b>');
  var cor=r.color?corHex(c):'#0B6BB8';
  L.polyline([emp].concat(r.stops.map(llOf)),{color:cor,weight:4,opacity:.8,dashArray:'8 8'}).addTo(m);
  r.stops.forEach(function(e,i){
    var p=llOf(e);b.push(p);
    var mk=L.marker(p,{icon:icone('<div class="mk-stop'+(isConcl(e)?' done':'')+(UI.drv.hl===e.id?' hl':'')+'" style="--c:'+cor+'">'+(i+1)+'</div>','',24)}).addTo(m);
    mk.bindPopup('<b>Parada '+(i+1)+': '+esc(e.cliente)+'</b><br>'+esc(e.endereco)+'<br>Prazo '+hhmm(e.prazo)+
      '<br><a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination='+p[0]+','+p[1]+'">Abrir rota no GPS do celular</a>');
    if(UI.drv.hl===e.id)mk.openPopup();
  });
  var vp=GPS.pos?[GPS.pos.lat,GPS.pos.lng]:toLL(r.pos);b.push(vp);
  MR.voce=L.marker(vp,{icon:icone('<div class="mk-drv" style="--c:'+cor+'">Eu</div>','',34),zIndexOffset:1000}).addTo(m);
  m.fitBounds(b,{padding:[24,24],maxZoom:16});
}
function mrAtualizaVoce(){if(MR.voce&&GPS.pos)MR.voce.setLatLng([GPS.pos.lat,GPS.pos.lng]);}

/* ---- escolher o local da entrega (formulário Nova entrega) ---- */
function mrPick(){
  var el=document.getElementById('pickreal');if(!el)return;
  matar('pick');MR.marcaPick=null;
  var m=novoMapa('pickreal',toLL(EMP),12);MR.pick=m;
  function marca(ll){
    if(MR.marcaPick)MR.marcaPick.setLatLng(ll);else MR.marcaPick=L.marker(ll).addTo(m);
    document.getElementById('ne-lat').value=ll[0].toFixed(6);document.getElementById('ne-lng').value=ll[1].toFixed(6);
    document.getElementById('pick-note').textContent='Local marcado ('+ll[0].toFixed(5)+', '+ll[1].toFixed(5)+'). Clique em outro ponto para mudar.';
  }
  m.on('click',function(ev){marca([ev.latlng.lat,ev.latlng.lng]);});
  MR.marcarPick=marca;
  setTimeout(function(){m.invalidateSize();},200);
}
function mrBuscarEndereco(){
  var q=(document.getElementById('ne-e').value+' '+document.getElementById('ne-c').value).trim();
  if(!q){toast('Digite o endereço primeiro.');return;}
  fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q='+encodeURIComponent(q+', Manaus'),{headers:{'Accept':'application/json'}})
    .then(function(r){return r.json();}).then(function(a){
      if(!a.length){toast('Endereço não encontrado. Clique no mapa para marcar.');return;}
      var ll=[parseFloat(a[0].lat),parseFloat(a[0].lon)];MR.pick.setView(ll,16);MR.marcarPick(ll);
    }).catch(function(){toast('Não foi possível buscar o endereço agora. Clique no mapa para marcar.');});
}

/* ---- GPS do celular ---- */
function gpsDisponivel(){return CONFIG.gps!==false&&!!navigator.geolocation;}
function gpsLigar(){
  if(!gpsDisponivel()){GPS.erro='Este aparelho não oferece localização.';renderApp();return;}
  GPS.erro='';
  GPS.watch=navigator.geolocation.watchPosition(function(p){
    GPS.ativo=true;GPS.erro='';
    GPS.pos={lat:p.coords.latitude,lng:p.coords.longitude,prec:p.coords.accuracy};
    mrAtualizaVoce();
    var el=document.getElementById('gps-info');if(el)el.textContent='Precisão de '+Math.round(GPS.pos.prec)+' m';
    var agora=Date.now();
    if(SESSION&&SESSION.role==='driver'&&agora-GPS.ultimoEnvio>=(CONFIG.gpsIntervaloSeg||20)*1000){
      var c=colab(SESSION.id);
      /* só envia a posição enquanto houver entrega em rota */
      if(c&&DB.entregas.some(function(e){return e.motoristaId===c.id&&e.status==='em_rota';})){
        GPS.ultimoEnvio=agora;Dados.enviarPosicao(c.id,GPS.pos.lat,GPS.pos.lng,GPS.pos.prec);
      }
    }
  },function(err){
    GPS.ativo=false;GPS.watch=null;
    GPS.erro=err&&err.code===1?'Permissão negada. Libere a localização nas configurações do navegador.':'Não foi possível obter a localização.';
    renderApp();
  },{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
  GPS.ativo=true;renderApp();
}
function gpsDesligar(){
  if(GPS.watch!=null&&navigator.geolocation)navigator.geolocation.clearWatch(GPS.watch);
  GPS.watch=null;GPS.ativo=false;GPS.pos=null;GPS.ultimoEnvio=0;
}
function gpsCard(){
  if(!gpsDisponivel())return '';
  if(GPS.ativo){
    return '<section class="dcard"><div class="row" style="justify-content:space-between"><b>Localização ativa</b><span class="pill p-good"><i></i>GPS</span></div><span class="note" id="gps-info">'+(GPS.pos?'Precisão de '+Math.round(GPS.pos.prec)+' m':'Procurando sinal…')+'</span><span class="note">A empresa vê sua posição só enquanto você tem entregas em rota e esta tela está aberta.</span><button class="btn btn-sm" style="align-self:flex-start" data-act="gps-off">Desativar</button></section>';
  }
  return '<section class="dcard"><b>Localização</b><span class="muted">Ative para a empresa acompanhar sua rota no mapa. O celular vai pedir permissão. A posição é enviada somente enquanto você tem entregas em rota e esta tela está aberta.</span>'+(GPS.erro?'<span class="err">'+esc(GPS.erro)+'</span>':'')+'<button class="btn btn-primary" data-act="gps-on">Ativar localização</button></section>';
}
