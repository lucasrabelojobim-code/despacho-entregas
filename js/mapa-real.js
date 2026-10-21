'use strict';
/* Mapa real (OpenStreetMap + Leaflet) e GPS do celular do motorista. */
var MR={adm:null,drv:null,pick:null,voce:null,view:null,marcaPick:null,mkMot:{},emp:null};
var GPS={ativo:false,watch:null,pos:null,ultimoEnvio:0,erro:''};

function usaReal(){return UI.mapa==='real'&&!!window.L;}
/* o mapa esquemático de exemplo é desenhado sobre uma área de Manaus */
function toLL(p){return [-3.08-p.y/520*0.07,-60.06+p.x/800*0.08];}
function fromLL(lat,lng){return {x:Math.max(0,Math.min(800,(lng+60.06)/0.08*800)),y:Math.max(0,Math.min(520,(-3.08-lat)/0.07*520))};}
function llOf(e){return (e.lat!=null&&e.lng!=null)?[e.lat,e.lng]:toLL(pos(e));}
function temLocal(e){return e.lat!=null&&e.lng!=null;}
/* ponto de saída: usa o endereço real da empresa se estiver no config.js; senão, o ponto de exemplo */
function empLL(){
  if(EMPRESA)return [EMPRESA.lat,EMPRESA.lng];   /* definido pelo desenvolvedor (aba Desenvolvedor > Empresa) */
  return (CONFIG.empresaLat!=null&&CONFIG.empresaLng!=null)?[CONFIG.empresaLat,CONFIG.empresaLng]:toLL(EMP);
}
function empresaDefinida(){return !!EMPRESA||(CONFIG.empresaLat!=null&&CONFIG.empresaLng!=null);}
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

/* ---- rotas pelas ruas (OSRM, serviço gratuito do OpenStreetMap) ----
   O trajeto é pedido uma vez e guardado; as atualizações do painel reaproveitam o resultado.
   Se o serviço não responder, o mapa mostra a linha reta tracejada, como antes. */
var ROTAS={},filaOsrm=Promise.resolve();
function chaveRota(pts){return pts.map(function(p){return p[0].toFixed(5)+','+p[1].toFixed(5);}).join(';');}
function rotaPorRuas(pts,cb){
  if(pts.length<2){cb(null);return;}
  var k=chaveRota(pts),c=ROTAS[k];
  if(c&&c.pts){cb(c);return;}
  if(c&&c.falhou&&Date.now()-c.falhou<60000){cb(null);return;}
  if(c&&c.pend){c.pend.push(cb);return;}
  var esp=ROTAS[k]={pend:[cb]};
  filaOsrm=filaOsrm.then(function(){
    var url='https://router.project-osrm.org/route/v1/driving/'+pts.map(function(p){return p[1].toFixed(6)+','+p[0].toFixed(6);}).join(';')+'?overview=full&geometries=geojson';
    return fetch(url).then(function(r){return r.json();}).then(function(j){
      var r0=j&&j.code==='Ok'&&j.routes&&j.routes[0];
      if(!r0)throw new Error('sem rota');
      return {pts:r0.geometry.coordinates.map(function(q){return [q[1],q[0]];}),km:r0.distance/1000,min:Math.round(r0.duration/60)};
    }).then(function(res){ROTAS[k]=res;return res;},function(){ROTAS[k]={falhou:Date.now()};return null;})
    .then(function(res){esp.pend.forEach(function(f){try{f(res);}catch(e){}});return esperar(1100);});
  });
}
function fmtRota(rt){return rt.km.toFixed(1).replace('.',',')+' km · cerca de '+(rt.min<60?rt.min+' min':Math.floor(rt.min/60)+'h'+pad(rt.min%60));}
/* desenha a rota: linha reta tracejada na hora e, quando o trajeto pelas ruas chega, troca por ele.
   Só usa as ruas quando todas as paradas têm local real; senão, não finge um caminho. */
function avisoMapa(m,txt){
  var c=L.control({position:'bottomleft'});
  c.onAdd=function(){var d=L.DomUtil.create('div','');d.style.cssText='background:#fff;color:#7A4B00;border:1px solid #E0B050;border-radius:6px;padding:4px 8px;font:12px sans-serif;max-width:260px;margin:0 0 24px 6px';d.textContent=txt;return d;};
  c.addTo(m);
}
function desenhaRota(m,dono,pts,paradas,cor,op,nome){
  var reta=L.polyline(pts,{color:cor,weight:4,opacity:op*0.8,dashArray:'8 8'}).addTo(m);
  var sem=paradas.filter(function(e){return !temLocal(e);});
  if(sem.length&&op>=1)avisoMapa(m,'Rota pelas ruas sem '+sem.map(function(e){return '#'+e.id;}).join(', ')+' (sem local no mapa). Abra a entrega e use "Localizar no mapa".');
  var com=paradas.filter(temLocal);
  if(!com.length)return;
  var ptsReal=[pts[0]].concat(com.map(llOf));
  rotaPorRuas(ptsReal,function(rt){
    if(MR[dono]!==m)return;
    if(!rt){if(op>=1)avisoMapa(m,'Não consegui traçar pelas ruas agora. Mostrando linha reta.');return;}
    try{m.removeLayer(reta);}catch(e){}
    L.polyline(rt.pts,{color:cor,weight:5,opacity:op*0.85,lineJoin:'round'}).addTo(m).bindTooltip((nome?nome+': ':'')+fmtRota(rt),{sticky:true});
  });
}
/* entregas antigas sem local real: o administrador tenta achar o endereço e grava o local */
var GEO_TENTOU={};
function mrCompletarLocais(rs,m){
  var falta=[];
  rs.forEach(function(r){r.stops.forEach(function(e){if(!temLocal(e)&&e.endereco&&!GEO_TENTOU[e.id]&&falta.indexOf(e)<0)falta.push(e);});});
  if(!falta.length)return;
  falta.forEach(function(e){GEO_TENTOU[e.id]=1;});
  var mudou=false;
  falta.reduce(function(p,e){
    return p.then(function(){return geocodificar(e.endereco).then(function(a){
      if(a.length){e.lat=a[0].lat;e.lng=a[0].lng;var q=fromLL(e.lat,e.lng);e.x=Math.round(q.x);e.y=Math.round(q.y);mudou=true;}
    },function(){}).then(function(){return esperar(1100);});});
  },Promise.resolve()).then(function(){
    if(mudou){save();if(MR.adm===m&&UI.view==='mapa'&&!ocupado())mrAdmin(rotasMapa());}
  });
}

/* ---- tempo estimado até a próxima parada (administrador e desenvolvedor) ----
   Mostra quantos minutos faltam para o motorista chegar na próxima parada. A conta é feita pelas ruas
   (OSRM) a partir da posição dele (GPS do celular ou posição simulada). Se o serviço não responder, usa
   a distância em linha reta com velocidade média. Não conta trânsito: é uma estimativa. */
var ETA={};
var VEL_MEDIA_KMH=25,FATOR_RUA=1.3;
function kmReta(a,b){
  var R=6371,t=Math.PI/180,dLa=(b[0]-a[0])*t,dLo=(b[1]-a[1])*t;
  var h=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a[0]*t)*Math.cos(b[0]*t)*Math.sin(dLo/2)*Math.sin(dLo/2);
  return 2*R*Math.asin(Math.sqrt(h));
}
function origemMot(r){var g=Dados.posicoes()[r.c.id];return (g&&ageMin(g.em)<=10)?[g.lat,g.lng]:toLL(r.pos);}
function etaCurto(id){var x=ETA[id];return x&&x.min!=null?'~'+fmtDur(Math.max(1,x.min)):'';}
function etaLinha(id){
  var x=ETA[id];if(!x)return '';
  if(x.min==null)return 'Sem local no mapa para estimar o tempo';
  return 'Chega em '+etaCurto(id)+(x.via==='reta'?' (linha reta)':'')+(x.alvo?' · '+x.alvo:'');
}
function pintaEta(id){
  [].forEach.call(document.querySelectorAll('[data-eta="'+id+'"]'),function(el){el.textContent=etaLinha(id);});
  var mk=MR.mkMot&&MR.mkMot[id];if(!mk)return;
  try{mk.unbindTooltip();}catch(e){}
  var t=etaCurto(id);
  if(t)mk.bindTooltip(t,{permanent:true,direction:'top',offset:[0,-20],className:'eta-tip'});
}
function mrEtas(rs){
  rs.forEach(function(r){
    var nx=r.stops[r.doneN],id=r.c.id;
    if(!nx){delete ETA[id];return;}
    if(!temLocal(nx)){ETA[id]={min:null,alvo:nx.cliente};pintaEta(id);return;}
    var o=origemMot(r),d=llOf(nx);
    var reta=Math.round(kmReta(o,d)*FATOR_RUA/VEL_MEDIA_KMH*60);
    if(!ETA[id]||ETA[id].alvo!==nx.cliente||ETA[id].via!=='ruas')ETA[id]={min:reta,via:'reta',alvo:nx.cliente};
    pintaEta(id);
    var o3=[+o[0].toFixed(3),+o[1].toFixed(3)],d5=[+d[0].toFixed(5),+d[1].toFixed(5)];
    rotaPorRuas([o3,d5],function(rt){
      if(!rt)return;
      ETA[id]={min:rt.min,via:'ruas',alvo:nx.cliente};pintaEta(id);
    });
  });
}

/* ---- mapa para o desenvolvedor definir o local da empresa ---- */
function mrEmpresa(){
  var el=document.getElementById('empmap');if(!el)return;
  matar('emp');MR.emp=null;
  var ini=empLL(),m=novoMapa('empmap',ini,empresaDefinida()?16:13),marca=null;
  MR.emp=m;
  function poe(ll,txt){
    if(marca)marca.setLatLng(ll);else{
      marca=L.marker(ll,{draggable:true,icon:icone('<div class="mk-emp">E</div>','',26)}).addTo(m);
      marca.on('dragend',function(){var p=marca.getLatLng();poe([p.lat,p.lng]);});
    }
    document.getElementById('em-lat').value=ll[0].toFixed(6);document.getElementById('em-lng').value=ll[1].toFixed(6);
    var n=document.getElementById('em-note');if(n)n.textContent=txt||('Local marcado: '+ll[0].toFixed(5)+', '+ll[1].toFixed(5)+'. Arraste o ícone ou clique em outro ponto para ajustar.');
    var b=document.getElementById('em-save');if(b)b.disabled=false;
  }
  if(empresaDefinida())poe(ini,'Local atual da empresa. Clique no mapa, arraste o ícone ou busque um endereço para mudar.');
  m.on('click',function(ev){poe([ev.latlng.lat,ev.latlng.lng]);});
  MR.empPoe=poe;
  setTimeout(function(){m.invalidateSize();},200);
}
function mrBuscarEmpresa(){
  var q=(document.getElementById('em-end').value||'').trim();
  if(!q){toast('Digite o endereço da empresa.');return;}
  var btn=document.querySelector('[data-act="emp-buscar"]'),n=document.getElementById('em-note');
  if(btn)btn.disabled=true;if(n)n.textContent='Procurando no mapa…';
  geocodificar(q).then(function(a){
    if(btn)btn.disabled=false;
    if(!a.length){if(n)n.textContent='Não achei esse endereço. Inclua rua e bairro, ou clique no mapa para marcar o local.';return;}
    MR.emp.setView([a[0].lat,a[0].lng],17);
    MR.empPoe([a[0].lat,a[0].lng],'Encontrado: '+a[0].nome.split(',').slice(0,4).join(',')+'. Confira no mapa e ajuste se precisar antes de salvar.');
  }).catch(function(){if(btn)btn.disabled=false;if(n)n.textContent='Não foi possível buscar agora. Clique no mapa para marcar o local.';});
}

/* ---- administrador ---- */
function mrAdmin(rs){
  var el=document.getElementById('rmap');if(!el)return;
  matar('adm');MR.mkMot={};
  var emp=empLL();
  var m=novoMapa('rmap',MR.view?MR.view.c:emp,MR.view?MR.view.z:13);
  MR.adm=m;
  var gp=Dados.posicoes(),b=[];
  b.push(emp);
  mrCompletarLocais(rs,m);
  L.marker(emp,{icon:icone('<div class="mk-emp">E</div>','',26),title:'Empresa'}).addTo(m).bindPopup('<b>Empresa</b><br>Ponto de saída'+(EMPRESA&&EMPRESA.endereco?'<br>'+esc(EMPRESA.endereco):'')+(empresaDefinida()?'':'<br><span style="color:#B7791F">Local de exemplo.'+(SESSION&&SESSION.dev?' Defina o local em Desenvolvedor &gt; Empresa.':' Peça ao desenvolvedor para definir o local da empresa.')+'</span>'));
  rs.forEach(function(r){
    var cor=corHex(r.c),dim=UI.mapSel&&UI.mapSel!==r.c.id,op=dim?0.25:1;
    var pts=[emp].concat(r.stops.map(llOf));
    desenhaRota(m,'adm',pts,r.stops,cor,op,r.c.nome);
    r.stops.forEach(function(e,i){
      var done=isConcl(e),p=llOf(e);b.push(p);
      L.marker(p,{icon:icone('<div class="mk-stop'+(done?' done':'')+(ehColeta(e)?' col':'')+'" style="--c:'+cor+'">'+(i+1)+'</div>','',24),opacity:op}).addTo(m)
        .bindPopup('<b>Parada '+(i+1)+': '+esc(e.cliente)+'</b><br>'+esc(e.endereco)+'<br>'+(ehColeta(e)?'Coleta · ':'')+stL(e)+' · prazo '+hhmm(e.prazo)+(temLocal(e)?'':'<br><span style="color:#B7791F">Local aproximado: o endereço ainda não foi localizado no mapa.</span>'));
    });
    var g=gp[r.c.id],vivo=g&&ageMin(g.em)<=10,p2=vivo?[g.lat,g.lng]:toLL(r.pos);b.push(p2);
    var mkd=L.marker(p2,{icon:icone('<div class="mk-drv'+(r.c.tipo==='Terceirizado'?' ter':'')+(vivo?'':' sim')+'" style="--c:'+cor+'">'+esc(ini2(r.c))+'</div>','',34),opacity:op,zIndexOffset:1000}).addTo(m)
      .bindPopup('<b>'+esc(r.c.nome)+'</b> ('+esc(r.c.tipo)+')<br>'+(vivo?'GPS do celular · há '+ageMin(g.em)+' min':'Posição simulada (sem GPS ativo)')+(ETA[r.c.id]?'<br>'+esc(etaLinha(r.c.id)):''))
      .on('click',function(){UI.mapSel=(UI.mapSel===r.c.id?null:r.c.id);});
    MR.mkMot[r.c.id]=mkd;pintaEta(r.c.id);
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
  var emp=empLL(),m=novoMapa('rmap-drv',emp,13),b=[emp];
  MR.drv=m;
  L.marker(emp,{icon:icone('<div class="mk-emp">E</div>','',26)}).addTo(m).bindPopup('<b>Empresa</b>');
  var cor=r.color?corHex(c):'#0B6BB8';
  desenhaRota(m,'drv',[emp].concat(r.stops.map(llOf)),r.stops,cor,1,'');
  r.stops.forEach(function(e,i){
    var p=llOf(e);b.push(p);
    var mk=L.marker(p,{icon:icone('<div class="mk-stop'+(isConcl(e)?' done':'')+(ehColeta(e)?' col':'')+(UI.drv.hl===e.id?' hl':'')+'" style="--c:'+cor+'">'+(i+1)+'</div>','',24)}).addTo(m);
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
/* ---- busca de endereço (Nominatim / OpenStreetMap) ----
   Procura só dentro da região de Manaus. Se não achar, tenta sem o número e, por último, sem limite de área. */
var MANAUS_VB='-60.30,-2.90,-59.80,-3.25';   /* esquerda,topo,direita,base */
function esperar(ms){return new Promise(function(r){setTimeout(r,ms);});}
function emManaus(x){return x.lat<-2.6&&x.lat>-3.5&&x.lng>-60.5&&x.lng<-59.6;}
function nominatim(q,limitar){
  var url='https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=pt-BR&limit=5&countrycodes=br&viewbox='+MANAUS_VB+(limitar?'&bounded=1':'')+'&q='+encodeURIComponent(q);
  return fetch(url,{headers:{'Accept':'application/json'}}).then(function(r){if(!r.ok)throw new Error('Nominatim '+r.status);return r.json();}).then(function(a){
    var vistos={};
    return a.map(function(x){return {lat:parseFloat(x.lat),lng:parseFloat(x.lon),nome:x.display_name||''};}).filter(function(x){if(!emManaus(x)||vistos[x.nome])return false;vistos[x.nome]=1;return true;});
  });
}
function geocodificar(txt){
  txt=(txt||'').replace(/\s+/g,' ').trim();
  if(!txt)return Promise.resolve([]);
  var semNum=txt.replace(/\s*[,\-]?\s*(n[º°]?\.?\s*)?\d+.*$/i,'').trim();
  var t=[[txt+', Manaus, Amazonas',true]];
  if(semNum&&semNum!==txt)t.push([semNum+', Manaus, Amazonas',true]);
  t.push([txt+', Manaus, Amazonas, Brasil',false]);
  var i=0;
  function prox(){
    if(i>=t.length)return Promise.resolve([]);
    var q=t[i++];
    return nominatim(q[0],q[1]).then(function(r){return r.length?r:esperar(1100).then(prox);});
  }
  return prox();
}
function escolherGeo(i){
  var x=MR.geoRes&&MR.geoRes[i];if(!x||!MR.pick)return;
  MR.pick.setView([x.lat,x.lng],16);MR.marcarPick([x.lat,x.lng]);
  var n=document.getElementById('pick-note');
  if(n)n.textContent='Local encontrado: '+x.nome.split(',').slice(0,4).join(',')+'. Confira no mapa e, se precisar, clique em outro ponto para ajustar.';
}
function mrBuscarEndereco(){
  var ec=document.getElementById('ne-c'),q=(document.getElementById('ne-e').value.trim())||(ec?ec.value.trim():'');
  if(!q){toast('Digite o endereço primeiro.');return;}
  var box=document.getElementById('geo-res'),btn=document.querySelector('[data-act="geo-buscar"]');
  if(box)box.innerHTML='<span class="note">Procurando no mapa…</span>';
  if(btn)btn.disabled=true;
  geocodificar(q).then(function(a){
    if(btn)btn.disabled=false;
    MR.geoRes=a;
    if(!a.length){if(box)box.innerHTML='';toast('Não achei esse endereço. Inclua rua e bairro, ou clique no mapa para marcar o local.');return;}
    escolherGeo(0);
    if(box)box.innerHTML=a.length>1?'<div class="note" style="margin-top:6px">Achei '+a.length+' resultados. O primeiro já foi marcado. Se não for o certo, escolha:</div>'+a.map(function(x,i){return '<button type="button" class="btn btn-sm" style="margin:4px 4px 0 0;text-align:left" data-act="geo-pick" data-id="'+i+'">'+esc(x.nome.split(',').slice(0,3).join(','))+'</button>';}).join(''):'';
  }).catch(function(){
    if(btn)btn.disabled=false;if(box)box.innerHTML='';
    toast('Não foi possível buscar o endereço agora. Clique no mapa para marcar o local.');
  });
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
