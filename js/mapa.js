'use strict';
/* ============ mapa ============ */
var XS=[80,160,240,320,400,480,560,640,720],YS=[60,140,220,300,380,460],EMP={x:160,y:300},STOPNO={};
function hash(str){var h=0;for(var i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))|0;return Math.abs(h);}
function pos(e){
  if(e.x!=null&&e.y!=null)return {x:e.x,y:e.y};
  if(e.lat!=null&&e.lng!=null)return fromLL(e.lat,e.lng);
  var c=CLIENTES.find(function(k){return k[0]===e.cliente;});
  if(c)return {x:c[2],y:c[3]};
  var h=hash(e.cliente||String(e.id)),x=XS[h%XS.length],y=YS[Math.floor(h/9)%YS.length];
  if(x>=640&&y>=380)x=480;
  return {x:x,y:y};
}
function colorOf(c){return 'var(--d'+((Math.max(0,DB.colaboradores.indexOf(c))%8)+1)+')';}
function ini(c){return c.nome.split(' ').map(function(w){return w[0];}).slice(0,2).join('').toUpperCase();}
function lerpL(a,b,p,hf){
  var dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y),d=p*(dx+dy),sx=b.x>=a.x?1:-1,sy=b.y>=a.y?1:-1;
  if(hf){return d<=dx?{x:a.x+sx*d,y:a.y}:{x:b.x,y:a.y+sy*(d-dx)};}
  return d<=dy?{x:a.x,y:a.y+sy*d}:{x:a.x+sx*(d-dy),y:b.y};
}
function curPos(stops,doneN){
  if(!stops.length)return EMP;
  if(doneN>=stops.length)return pos(stops[stops.length-1]);
  var next=stops[doneN],from=doneN===0?EMP:pos(stops[doneN-1]);
  var t0=doneN===0?stops.filter(function(e){return e.saidaEm;}).map(function(e){return e.saidaEm;}).sort()[0]:stops[doneN-1].concluidoEm;
  if(!t0||next.status==='separado')return from;
  var to=pos(next),dist=Math.abs(to.x-from.x)+Math.abs(to.y-from.y),leg=6+dist/80*4;
  var p=Math.min(0.9,Math.max(0.08,mins(t0,new Date())/leg));
  return lerpL(from,to,p,doneN%2===0);
}
function routeOf(c,mode){
  var all=DB.entregas.filter(function(e){return e.motoristaId===c.id&&(e.dia===todayKey()||!isConcl(e));});
  if(mode==='admin'&&!all.some(function(e){return e.status==='em_rota';}))return null;
  var done=[];  /* o mapa mostra só o que ainda está em rota (entregas já concluídas não aparecem) */
  var pend=all.filter(function(e){return e.status==='em_rota'||(mode==='driver'&&e.status==='separado');}).sort(function(a,b){
    var ra=a.status==='em_rota'?0:1,rb=b.status==='em_rota'?0:1;return ra-rb||a.prazo.localeCompare(b.prazo);});
  if(!done.length&&!pend.length)return null;
  var stops=done.concat(pend);
  return {c:c,color:colorOf(c),stops:stops,doneN:done.length,pos:curPos(stops,done.length)};
}
function cropVb(r){
  var pts=[EMP,r.pos].concat(r.stops.map(pos));
  var x0=Math.min.apply(null,pts.map(function(q){return q.x;})),x1=Math.max.apply(null,pts.map(function(q){return q.x;}));
  var y0=Math.min.apply(null,pts.map(function(q){return q.y;})),y1=Math.max.apply(null,pts.map(function(q){return q.y;}));
  var ar=1.4,pad=70,w=Math.max(x1-x0+2*pad,(y1-y0+2*pad)*ar,300);
  w=Math.min(w,800);var h=w/ar;if(h>520){h=520;w=h*ar;}
  var x=Math.min(Math.max((x0+x1)/2-w/2,0),800-w),y=Math.min(Math.max((y0+y1)/2-h/2,0),520-h);
  return [Math.round(x),Math.round(y),Math.round(w),Math.round(h)];
}
function baseMap(u,labels){
  var s='<rect class="bg" x="-400" y="-300" width="1600" height="1120"/><path class="water" d="M470 520C560 470 640 410 800 350L800 430C720 470 690 500 680 520Z"/>';
  [[246,146],[406,226],[566,66],[86,386],[326,306]].forEach(function(q){s+='<rect class="park" x="'+q[0]+'" y="'+q[1]+'" width="68" height="68" rx="6"/>';});
  XS.forEach(function(x){s+='<line class="st'+(x===400?' av':'')+'" x1="'+x+'" y1="0" x2="'+x+'" y2="520"/>';});
  YS.forEach(function(y){s+='<line class="st'+(y===300?' av':'')+'" x1="0" y1="'+y+'" x2="800" y2="'+y+'"/>';});
  if(labels)s+='<text class="lb" x="408" y="34" font-size="'+10*u+'">Av. Central</text><text class="lb" x="8" y="292" font-size="'+10*u+'">Av. Industrial</text><text class="lb" x="728" y="440" font-size="'+10*u+'">Rio</text>';
  return s;
}
function mapSvg(routes,o){
  o=o||{};
  var vb=o.vb||[0,0,800,520],u=vb[2]/(o.renderW||760),q=11*u;
  var s='<svg class="map" viewBox="'+vb.join(' ')+'" role="img" aria-label="'+esc(o.label||'Mapa de rotas')+'">'+baseMap(u,o.labels!==false);
  s+='<g><rect x="'+(EMP.x-q)+'" y="'+(EMP.y-q)+'" width="'+2*q+'" height="'+2*q+'" rx="'+2*u+'" class="emp"/><text x="'+EMP.x+'" y="'+(EMP.y+q+13*u)+'" text-anchor="middle" font-size="'+11*u+'" class="lbt">Empresa</text></g>';
  var list=routes.slice().sort(function(a,b){return (a.c.id===o.sel?1:0)-(b.c.id===o.sel?1:0);});
  list.forEach(function(r){
    var P=[EMP].concat(r.stops.map(pos)),dim=o.sel&&o.sel!==r.c.id,i;
    var g='<g style="color:'+r.color+'"'+(dim?' opacity=".25"':'')+'>';
    for(i=0;i<r.stops.length;i++){
      var a=P[i],b=P[i+1],done=i<r.doneN;
      var d=i%2===0?'M'+a.x+' '+a.y+'H'+b.x+'V'+b.y:'M'+a.x+' '+a.y+'V'+b.y+'H'+b.x;
      g+='<path d="'+d+'" fill="none" stroke="currentColor" stroke-width="'+(done?4.5:3.5)*u+'" stroke-linejoin="round" stroke-linecap="round"'+(done?'':' stroke-dasharray="'+9*u+' '+7*u+'"')+' opacity="'+(done?'0.95':'0.8')+'"/>';
    }
    var seen={};
    r.stops.forEach(function(e,ix){
      var p=pos(e),k=p.x+','+p.y,n=seen[k]=(seen[k]||0)+1,off=(n-1)*11*u,cx=p.x+off,cy=p.y-off,done=isConcl(e);
      g+='<g'+(o.interactive&&o.stopAct?' data-act="map-stop" data-id="'+e.id+'" style="cursor:pointer"':'')+'><title>Parada '+(ix+1)+': '+esc(e.cliente)+' ('+(ehColeta(e)?'coleta · ':'')+stL(e)+')</title>'+
        (o.hl===e.id?'<circle cx="'+cx+'" cy="'+cy+'" r="'+16*u+'" fill="none" stroke="var(--ink)" stroke-width="'+2.5*u+'"/>':'')+
        (ehColeta(e)?'<rect x="'+(cx-9*u)+'" y="'+(cy-9*u)+'" width="'+18*u+'" height="'+18*u+'" rx="'+3*u+'" fill="'+(done?'currentColor':'var(--surface)')+'" stroke="currentColor" stroke-width="'+2.5*u+'"/>':'<circle cx="'+cx+'" cy="'+cy+'" r="'+9.5*u+'" fill="'+(done?'currentColor':'var(--surface)')+'" stroke="currentColor" stroke-width="'+2.5*u+'"/>')+
        '<text x="'+cx+'" y="'+(cy+3.8*u)+'" text-anchor="middle" font-size="'+11*u+'" font-weight="700" fill="'+(done?'#fff':'currentColor')+'">'+(ix+1)+'</text></g>';
    });
    var ter=r.c.tipo==='Terceirizado',m=r.pos;
    g+='<g'+(o.markerAct?' data-act="map-sel" data-id="'+r.c.id+'" style="cursor:pointer"':'')+'><title>'+esc(r.c.nome)+' ('+esc(r.c.tipo)+')</title>'+
      (ter?'<circle cx="'+m.x+'" cy="'+m.y+'" r="'+19.5*u+'" fill="none" stroke="var(--viol)" stroke-width="'+2.5*u+'" stroke-dasharray="'+4*u+' '+3*u+'"/>':'')+
      '<circle cx="'+m.x+'" cy="'+m.y+'" r="'+14*u+'" fill="currentColor" stroke="var(--surface)" stroke-width="'+3*u+'"/>'+
      '<text x="'+m.x+'" y="'+(m.y+3.6*u)+'" text-anchor="middle" font-size="'+10*u+'" font-weight="700" fill="#fff">'+ini(r.c)+'</text>'+
      ((o.names||o.you)?'<text x="'+m.x+'" y="'+(m.y+30*u)+'" text-anchor="middle" font-size="'+11*u+'" class="lbt">'+(o.you?'Você':esc(r.c.nome.split(' ')[0]))+'</text>':'')+'</g>';
    s+=g+'</g>';
  });
  return s+'</svg>';
}
function mapLegend(ter){
  return '<div class="mlegend"><span><i class="lgd sq"></i>Empresa</span><span><i class="lgd solid"></i>Entregue</span><span><i class="lgd"></i>A entregar</span>'+(ter?'<span><i class="lgd ter"></i>Terceirizado</span>':'')+'<span>Posições simuladas</span></div>';
}
function rotasMapa(){
  return DB.colaboradores.filter(function(c){return c.ativo!==false&&(!UI.mapTipo||c.tipo===UI.mapTipo);}).map(function(c){return routeOf(c,'admin');}).filter(Boolean);
}
function gpsVivo(id){var g=Dados.posicoes()[id];return !!g&&(Date.now()-new Date(g.em).getTime())<=10*60000;}
function seletorMapa(){
  if(!window.L)return '';
  return '<div class="seg" role="group" aria-label="Tipo de mapa"><button data-act="map-modo" data-p="real" aria-pressed="'+(UI.mapa==='real')+'">Mapa real</button><button data-act="map-modo" data-p="esq" aria-pressed="'+(UI.mapa==='esq')+'">Esquemático</button></div>';
}
function viewMapa(){
  var rs=rotasMapa(),real=usaReal();
  var seg=[['','Todos'],['Efetivado','Efetivados'],['Terceirizado','Terceirizados']].map(function(o){return '<button data-act="map-tipo" data-p="'+o[0]+'" aria-pressed="'+(UI.mapTipo===o[0])+'">'+o[1]+'</button>';}).join('');
  var h='<div class="page-h"><div><h1>Mapa</h1><p>'+rs.length+(rs.length===1?' motorista em rota':' motoristas em rota')+' agora. Atualiza a cada 20 segundos.</p></div><div class="row">'+seletorMapa()+'<div class="seg" role="group" aria-label="Vínculo">'+seg+'</div></div></div>';
  var side=rs.length?rs.map(function(r){
    var n=r.stops.length,d=r.doneN,sel=UI.mapSel===r.c.id,nx=r.stops[d];
    return '<div class="mrow" role="button" tabindex="0" data-act="map-sel" data-id="'+r.c.id+'" aria-pressed="'+sel+'"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span><i class="dot" style="background:'+r.color+'"></i><b>'+esc(r.c.nome)+'</b> '+tagTipo(r.c)+(gpsVivo(r.c.id)?' <span class="pill p-good"><i></i>GPS</span>':'')+'</span><span class="num">'+d+'/'+n+'</span></div>'+
      '<span class="sub">'+(nx?'Próxima '+(ehColeta(nx)?'coleta':'entrega')+': '+esc(nx.cliente)+' · prazo '+hhmm(nx.prazo)+(late(nx)?' · atrasada':''):'Todas as paradas concluídas')+'</span>'+(nx?'<span class="sub eta" data-eta="'+esc(r.c.id)+'">'+etaLinha(r.c.id)+'</span>':'')+
      (sel?'<div class="mstops">'+r.stops.map(function(e,i){return '<div><span><span class="n">'+(i+1)+'</span>'+esc(e.cliente)+' '+tagOp(e)+'</span>'+pill(e.status,e.tipo)+'</div>';}).join('')+'</div>':'')+'</div>';
  }).join(''):'<div class="empty">Nenhum motorista em rota agora.</div>';
  var corpo=real?
    '<div id="rmap" class="rmap" role="region" aria-label="Mapa das rotas em andamento"></div><p class="note" id="mr-aviso" hidden>Não foi possível carregar o mapa. Verifique a conexão com a internet.</p><div class="mlegend"><span>Círculo grande: motorista (tracejado roxo = terceirizado)</span><span>Numerado: paradas</span><span>Motorista claro = posição simulada, sólido = GPS do celular</span><span>Redondo = entrega, quadrado = coleta</span><span>Minutos: estimativa pelas ruas até a próxima parada, sem contar trânsito</span></div>':
    '<div class="mapbox">'+mapSvg(rs,{sel:UI.mapSel,interactive:true,markerAct:true,names:true,label:'Mapa das rotas em andamento'})+'</div>'+mapLegend(true)+'<div class="mlegend"><span>Minutos: estimativa em linha reta/ruas até a próxima parada, sem contar trânsito</span></div>';
  h+='<div class="grid-2"><section class="panel"><div class="panel-h"><h2>Rotas em andamento</h2><span class="note">Clique no motorista para isolar a rota</span></div><div class="panel-b">'+corpo+'</div></section>'+
    '<section class="panel"><div class="panel-h"><h2>Em rota agora</h2></div><div class="list">'+side+'</div></section></div>';
  return h;
}
function seletorMini(){
  if(!window.L)return '';
  return UI.mapa==='real'?'<button class="btn btn-sm" data-act="map-modo" data-p="esq">Esquemático</button>':'<button class="btn btn-sm" data-act="map-modo" data-p="real">Mapa real</button>';
}
function driverMapHtml(c,hl,conf){
  var r=routeOf(c,'driver');if(!r)return '';
  if(usaReal()){
    if(conf)return '';
    var idx=hl?r.stops.findIndex(function(e){return e.id===hl;}):-1,sel=idx>=0?r.stops[idx]:null;
    var cap=sel?'<div><b>Parada '+(idx+1)+' · '+esc(sel.cliente)+'</b><div class="muted">'+esc(sel.endereco)+'</div><div class="mono" style="margin-top:2px">Prazo '+hhmm(sel.prazo)+'</div></div>':'<span class="note">Toque numa parada para ver detalhes e abrir a rota no GPS do celular.</span>';
    return '<section class="dcard" id="drv-map"><div class="row" style="justify-content:space-between"><h3>Sua rota</h3><span class="row"><span class="note">'+r.stops.length+(r.stops.length===1?' parada':' paradas')+'</span>'+seletorMini()+'</span></div><div id="rmap-drv" class="rmap"></div><p class="note" id="mr-aviso" hidden>Não foi possível carregar o mapa. Verifique a conexão com a internet.</p>'+cap+linkRotaCompleta(r)+'</section>';
  }
  var svg=mapSvg([r],{vb:cropVb(r),renderW:360,labels:false,hl:hl,interactive:!conf,stopAct:!conf,you:true,label:'Mapa da sua rota'});
  if(conf)return '<div>'+svg+mapLegend(false)+'</div>';
  var idx2=hl?r.stops.findIndex(function(e){return e.id===hl;}):-1,sel2=idx2>=0?r.stops[idx2]:null;
  var cap2=sel2?'<div><b>Parada '+(idx2+1)+' · '+esc(sel2.cliente)+'</b><div class="muted">'+esc(sel2.endereco)+'</div><div class="mono" style="margin-top:2px">Prazo '+hhmm(sel2.prazo)+'</div></div>':'<span class="note">Toque numa parada para ver os detalhes.</span>';
  return '<section class="dcard" id="drv-map"><div class="row" style="justify-content:space-between"><h3>Sua rota</h3><span class="row"><span class="note">'+r.stops.length+(r.stops.length===1?' parada':' paradas')+'</span>'+seletorMini()+'</span></div>'+svg+mapLegend(false)+cap2+'</section>';
}
function pickMapHtml(){
  if(usaReal())return '<div id="pickreal" class="rmap" style="height:260px"></div><div class="row" style="margin-top:6px"><button type="button" class="btn btn-sm" data-act="geo-buscar">Localizar pelo endereço</button></div><div id="geo-res"></div>';
  return '<svg id="pickmap" class="map" viewBox="0 0 800 520" role="img" aria-label="Escolha o local da entrega">'+baseMap(1,true)+'<circle id="pick-mark" cx="0" cy="0" r="12" fill="var(--accent)" stroke="var(--surface)" stroke-width="3" hidden/></svg>';
}
function pickPos(svg,ev){
  var r=svg.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width*800,y=(ev.clientY-r.top)/r.height*520;
  function near(a,v){return a.reduce(function(b,c){return Math.abs(c-v)<Math.abs(b-v)?c:b;});}
  var sx=near(XS,x),sy=near(YS,y),m=$('#pick-mark');
  m.setAttribute('cx',sx);m.setAttribute('cy',sy);m.hidden=false;m.removeAttribute('hidden');
  $('#ne-x').value=sx;$('#ne-y').value=sy;
  $('#pick-note').textContent='Local marcado no cruzamento selecionado. Clique em outro ponto para mudar.';
}
