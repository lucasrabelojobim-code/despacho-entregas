'use strict';
/* ============ admin: casca ============ */
function adminShell(){
  var tabs=[['dashboard','Painel'],['mapa','Mapa'],['entregas','Entregas'],['colaboradores','Colaboradores'],['ocorrencias','Ocorrências'],['veiculos','Veículos'],['abastecimentos','Abastecimentos'],['historico','Histórico']];
  if(SESSION.dev&&Dados.modo==='online')tabs.push(['desenvolvedor','Desenvolvedor']);
  return '<div class="band top"><div class="band-in"><div class="top-row"><div class="brand sm">'+mark()+'<span>ArcoRota</span></div>'+
  '<nav class="tabs" aria-label="Seções">'+tabs.map(function(t){return '<button class="tab" data-act="nav" data-v="'+t[0]+'"'+(UI.view===t[0]?' aria-current="page"':'')+'>'+t[1]+'</button>';}).join('')+'</nav>'+
  '<div class="top-r">'+(DB.demo?'<span class="pill p-neutral">Dados de exemplo</span>':'')+'<button class="btn btn-sm" data-act="dados">Dados</button><button class="btn btn-sm" data-act="logout">Sair</button></div></div></div></div><main class="main" id="main"></main>';
}
function mountAdmin(){
  var m=$('#main');
  if(UI.view==='desenvolvedor'&&!(SESSION.dev&&Dados.modo==='online'))UI.view='dashboard';
  if(UI.view==='desenvolvedor'){m.innerHTML=viewDev();fillDev();}
  else if(UI.view==='dashboard')m.innerHTML=viewDashboard();
  else if(UI.view==='mapa'){m.innerHTML=viewMapa();var rsm=rotasMapa();if(usaReal())mrAdmin(rsm);mrEtas(rsm);}
  else if(UI.view==='entregas'){m.innerHTML=viewEntregas();fillEntregas();}
  else if(UI.view==='colaboradores'){m.innerHTML=viewColabs();fillColabs();}
  else if(UI.view==='veiculos'){m.innerHTML=viewVeiculos();fillVeiculos();}
  else if(UI.view==='abastecimentos'){m.innerHTML=viewAbastecimentos();fillAbastecimentos();}
  else if(UI.view==='historico'){m.innerHTML=viewHist();histIniciar();}
  else{m.innerHTML=viewOcs();fillOcs();}
}
function fillLista(){if(UI.view==='entregas')fillEntregas();else if(UI.view==='colaboradores')fillColabs();else if(UI.view==='ocorrencias')fillOcs();else if(UI.view==='veiculos')fillVeiculos();else if(UI.view==='abastecimentos')fillAbastecimentos();else if(UI.view==='historico')histDesenhar();}

/* ============ admin: painel ============ */
function kpi(l,v,s,t){return '<div class="kpi'+(t?' t-'+t:'')+'"><span class="k-l">'+l+'</span><span class="k-v">'+v+'</span><span class="k-s">'+s+'</span></div>';}
function viewDashboard(){
  var list=DB.entregas.filter(function(e){return inPeriod(e,UI.periodo);});
  var s=calc(list);
  var ruaAll=DB.entregas.filter(function(e){return e.status==='em_rota';});
  var porMot={};ruaAll.forEach(function(e){(porMot[e.motoristaId]=porMot[e.motoristaId]||[]).push(e);});
  var rua=Object.keys(porMot).map(function(id){var l=porMot[id];return {c:colab(id),n:l.length,desde:l.map(function(e){return e.saidaEm;}).sort()[0],atr:l.filter(late).length};}).filter(function(r){return r.c;}).sort(function(a,b){return a.desde.localeCompare(b.desde);});
  var hoje=DB.entregas.filter(function(e){return e.dia===todayKey();});
  var aguardMap={};
  hoje.forEach(function(e){if(isConcl(e)&&!e.retornoEm&&!porMot[e.motoristaId]){var a=aguardMap[e.motoristaId]=aguardMap[e.motoristaId]||{n:0,desde:''};a.n++;if(e.concluidoEm>a.desde)a.desde=e.concluidoEm;}});
  var aguard=Object.keys(aguardMap).map(function(id){return {c:colab(id),n:aguardMap[id].n,desde:aguardMap[id].desde};}).filter(function(r){return r.c;});
  var rows=DB.colaboradores.map(function(c){return {c:c,s:calc(list.filter(function(e){return e.motoristaId===c.id;}))};}).filter(function(r){return r.s.total>0;}).sort(function(a,b){return b.s.total-a.s.total;});
  var h='<div class="page-h"><div><h1>Painel</h1><p>'+(UI.periodo==='hoje'?fmtLong(new Date()):'Últimos 7 dias')+'</p></div><div class="row">'+
    '<div class="seg" role="group" aria-label="Período"><button data-act="periodo" data-p="hoje" aria-pressed="'+(UI.periodo==='hoje')+'">Hoje</button><button data-act="periodo" data-p="7d" aria-pressed="'+(UI.periodo==='7d')+'">7 dias</button></div>'+
    '<button class="btn btn-primary" data-act="nova-ent">Nova entrega ou coleta</button></div></div>';
  var nCol=list.filter(ehColeta).length;
  h+='<div class="kpis">'+
    kpi(nCol?'Entregas e coletas':'Entregas',s.total,s.sep+' separadas, '+s.desp+' despachadas'+(nCol?' · '+nCol+(nCol===1?' coleta':' coletas'):''))+
    kpi('Na rua',s.emRota,rua.length+(rua.length===1?' motorista fora':' motoristas fora'),'acc')+
    kpi('Entregues',s.ok+s.prob,fmtPct(s.noPrazoPct)+' no prazo','good')+
    kpi('Atrasadas',s.atras,s.atrasAbertas+' ainda em aberto',s.atras?'warn':'')+
    kpi('Devolvidas',s.dev,fmtPct(s.devPct)+' das despachadas',s.dev?'bad':'')+
    kpi('Com problema',s.prob+s.err,s.prob+' defeito/avaria/falta, '+s.err+' enviadas erradas',(s.prob+s.err)?'warn':'')+'</div>';

  /* tabela por motorista */
  var tb='<div class="scroll"><table class="tbl"><thead><tr><th>Motorista</th><th class="r">Entregas</th><th class="r">Concluídas</th><th style="min-width:150px">No prazo</th><th class="r">Rota média</th><th class="r">Devol.</th><th class="r">Env. errado</th></tr></thead><tbody>'+
    (rows.length?rows.map(function(r){var s2=r.s;return '<tr data-act="drv-stats" data-id="'+r.c.id+'"><td><b>'+esc(r.c.nome)+'</b> '+tagTipo(r.c)+(r.c.tipo==='Terceirizado'?'<span class="sub">'+esc(r.c.empresa)+'</span>':'')+'</td><td class="r num">'+s2.total+'</td><td class="r num">'+s2.concl+'</td><td><div class="pct"><div class="meter '+meterCls(s2.noPrazoPct)+'"><i style="width:'+(s2.noPrazoPct||0)+'%"></i></div><b>'+fmtPct(s2.noPrazoPct)+'</b></div></td><td class="r num">'+fmtDur(s2.rota)+'</td><td class="r num">'+s2.dev+'</td><td class="r num">'+s2.err+'</td></tr>';}).join(''):'<tr><td colspan="7" class="empty">Nenhuma entrega no período.</td></tr>')+'</tbody></table></div>';

  /* na rua */
  var nr='<div class="list"><div class="li-h">Na rua agora</div>'+(rua.length?rua.map(function(r){return '<div class="li"><div><b>'+esc(r.c.nome)+'</b> '+tagTipo(r.c)+'<span class="sub">'+r.n+(r.n===1?' entrega':' entregas')+' · saiu às '+hhmm(r.desde)+' ('+fmtDur(mins(r.desde,new Date()))+')</span></div>'+(r.atr?'<span class="late">'+r.atr+' atrasada'+(r.atr>1?'s':'')+'</span>':'<span class="pill p-accent"><i></i>Em rota</span>')+'</div>';}).join(''):'<div class="empty">Ninguém em rota agora.</div>')+
    '<div class="li-h">Aguardando retorno</div>'+(aguard.length?aguard.map(function(r){return '<div class="li"><div><b>'+esc(r.c.nome)+'</b> '+tagTipo(r.c)+'<span class="sub">'+r.n+' concluída'+(r.n>1?'s':'')+', última às '+hhmm(r.desde)+'</span></div><span class="pill p-neutral"><i></i>Fora</span></div>';}).join(''):'<div class="empty">Todos retornaram.</div>')+'</div>';
  h+='<div class="grid-2"><section class="panel"><div class="panel-h"><h2>Por motorista</h2><span class="note">Clique para ver os indicadores</span></div>'+tb+'</section><section class="panel">'+'<div class="panel-h"><h2>Operação agora</h2></div>'+nr+'</section></div>';

  /* comparativo */
  var ef=calc(list.filter(function(e){var c=colab(e.motoristaId);return c&&c.tipo!=='Terceirizado';}));
  var te=calc(list.filter(function(e){var c=colab(e.motoristaId);return c&&c.tipo==='Terceirizado';}));
  function cmp(label,a,b,unit,max){
    var mx=max||Math.max(a||0,b||0,1)*1.15;
    function line(v,k){return '<div class="cmp-line"><div class="meter m-'+k+'"><i style="width:'+(v==null?0:Math.min(100,Math.round(v*100/mx)))+'%"></i></div><b>'+(v==null?'—':v+unit)+'</b></div>';}
    return '<div class="cmp-row"><div class="cmp-l">'+label+'</div><div>'+line(a,'ef')+line(b,'te')+'</div></div>';
  }
  var cp='<div class="panel-b"><div class="cmp-key"><span><i class="dot ef"></i>Efetivados ('+ef.total+' entregas)</span><span><i class="dot te"></i>Terceirizados ('+te.total+' entregas)</span></div>'+
    cmp('No prazo',ef.noPrazoPct,te.noPrazoPct,'%',100)+cmp('Devolução',ef.devPct,te.devPct,'%')+cmp('Enviado errado',ef.errPct,te.errPct,'%')+cmp('Com problema',ef.probPct,te.probPct,'%')+cmp('Rota média',ef.rota,te.rota,' min')+'</div>';
  /* ocorrências por tipo */
  var oc=DB.ocorrencias.filter(function(o){return inPeriod(o,UI.periodo);});
  var cnt={};oc.forEach(function(o){cnt[o.tipo]=(cnt[o.tipo]||0)+1;});
  var mxo=Math.max(1,Math.max.apply(null,Object.keys(TIPOS_OC).map(function(k){return cnt[k]||0;})));
  var ob='<div class="panel-b">'+Object.keys(TIPOS_OC).map(function(k){var v=cnt[k]||0;return '<div class="hb"><span>'+TIPOS_OC[k]+'</span><div class="meter m-bad"><i style="width:'+Math.round(v*100/mxo)+'%"></i></div><b>'+v+'</b></div>';}).join('')+'<p class="note" style="margin-top:8px">'+oc.length+' ocorrências no período</p></div>';
  h+='<div class="grid-eq"><section class="panel"><div class="panel-h"><h2>Efetivado × Terceirizado</h2></div>'+cp+'</section><section class="panel"><div class="panel-h"><h2>Ocorrências por tipo</h2></div>'+ob+'</section></div>';
  h+='<section class="panel"><div class="panel-h"><h2>Entregas por dia</h2><span class="note">Últimos 7 dias</span></div><div class="panel-b">'+chartDias()+'</div></section>';
  return h;
}
function chartDias(){
  var days=[],i;
  for(i=6;i>=0;i--){var d=new Date(Date.now()-i*86400000);var k=dayKey(d);var l=DB.entregas.filter(function(e){return e.dia===k;});
    days.push({k:k,lbl:i===0?'hoje':ddmm(d),ok:l.filter(function(e){return e.status==='entregue';}).length,prob:l.filter(function(e){return e.status==='entregue_problema';}).length,bad:l.filter(function(e){return e.status==='devolvido'||e.status==='enviado_errado';}).length,open:l.filter(function(e){return !isConcl(e);}).length});}
  var mx=Math.max(1,Math.max.apply(null,days.map(function(d){return d.ok+d.prob+d.bad+d.open;})));
  var top=Math.ceil(mx/20)*20;
  var W=620,H=230,ml=34,mr=8,mt=20,mb=26,pw=W-ml-mr,ph=H-mt-mb,band=pw/7,bw=Math.min(54,band*0.56);
  function y(v){return mt+ph-(v/top)*ph;}
  var s='<div class="legend"><span><i class="dot g"></i>Entregue</span><span><i class="dot w"></i>Com problema</span><span><i class="dot b"></i>Devolvida / enviada errada</span><span><i class="dot o"></i>Em aberto</span></div><div class="scroll"><svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Entregas por dia nos últimos 7 dias">';
  for(i=0;i<=4;i++){var v=top*i/4;s+='<line class="ax" x1="'+ml+'" x2="'+(W-mr)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="'+(ml-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+v+'</text>';}
  days.forEach(function(d,idx){
    var x=ml+band*idx+(band-bw)/2,acc=0;
    [['ok','c-good'],['prob','c-warn'],['bad','c-bad'],['open','c-open']].forEach(function(p){var v2=d[p[0]];if(!v2)return;var y1=y(acc+v2),hh=y(acc)-y1;s+='<rect class="'+p[1]+'" x="'+x+'" y="'+y1+'" width="'+bw+'" height="'+hh+'"/>';acc+=v2;});
    s+='<text class="tot" x="'+(x+bw/2)+'" y="'+(y(acc)-5)+'" text-anchor="middle">'+acc+'</text><text x="'+(x+bw/2)+'" y="'+(H-8)+'" text-anchor="middle">'+d.lbl+'</text>';
  });
  return s+'</svg></div>';
}

/* ============ indicadores do motorista (reuso) ============ */
function statsHtml(c){
  var all=DB.entregas.filter(function(e){return e.motoristaId===c.id;});
  var l7=all.filter(function(e){return inPeriod(e,'7d');});
  var s=calc(l7);
  var bars='',i,max=1,arr=[];
  for(i=6;i>=0;i--){var d=new Date(Date.now()-i*86400000),k=dayKey(d);arr.push({lbl:i===0?'hoje':ddmm(d),n:all.filter(function(e){return e.dia===k;}).length,today:i===0});}
  arr.forEach(function(a){if(a.n>max)max=a.n;});
  bars='<div class="mini" role="img" aria-label="Entregas por dia">'+arr.map(function(a){return '<div'+(a.today?' class="today"':'')+'><em>'+a.n+'</em><b style="height:'+Math.max(3,Math.round(a.n*100/max*0.55))+'px"></b><span>'+a.lbl+'</span></div>';}).join('')+'</div>';
  return '<div class="sgrid"><div><span>Entregas · 7 dias</span><b>'+s.total+'</b></div><div><span>No prazo</span><b>'+fmtPct(s.noPrazoPct)+'</b></div><div><span>Rota média</span><b>'+fmtDur(s.rota)+'</b></div><div><span>Devol. + erros</span><b>'+(s.dev+s.err)+'</b></div></div>'+bars;
}
function openDrvStats(id){
  var c=colab(id);if(!c)return;
  var hoje=DB.entregas.filter(function(e){return e.motoristaId===id&&e.dia===todayKey();});
  openModal(mh(esc(c.nome)+' '+tagTipo(c),esc(c.tipo==='Terceirizado'?c.empresa+' · ':'')+esc(c.veiculo)+' · <span class="mono">'+esc(c.placa)+'</span>')+
    '<div class="dlg-b">'+statsHtml(c)+'<div><div class="lbl" style="margin-bottom:6px">Entregas de hoje</div>'+entTable(hoje.sort(function(a,b){return b.id-a.id;}),true)+'</div></div>');
}

/* ============ admin: entregas ============ */
function entTable(list,compact){
  if(!list.length)return '<div class="empty">Nenhuma entrega encontrada.</div>';
  return '<div class="scroll"><table class="tbl"><thead><tr><th>#</th><th>Cliente</th>'+(compact?'':'<th>Motorista</th>')+'<th>Status</th><th>Saída</th><th>Conclusão</th><th>Retorno</th><th>Prazo</th></tr></thead><tbody>'+
  list.slice(0,100).map(function(e){var m=colab(e.motoristaId);return '<tr data-act="open-ent" data-id="'+e.id+'"><td class="mono">'+e.id+'</td><td><b>'+esc(e.cliente)+'</b> '+tagOp(e)+'<span class="sub">'+e.itens.length+(e.itens.length===1?' item':' itens')+' · '+totalUn(e)+' un</span></td>'+
    (compact?'':'<td>'+(m?esc(m.nome)+' '+tagTipo(m):'—')+'</td>')+'<td>'+pill(e.status,e.tipo)+'</td><td class="mono">'+hhmm(e.saidaEm)+'</td><td class="mono">'+hhmm(e.concluidoEm)+'</td><td class="mono">'+hhmm(e.retornoEm)+'</td><td class="mono">'+hhmm(e.prazo)+(late(e)?' <span class="late">atrasada</span>':'')+'</td></tr>';}).join('')+
  '</tbody></table></div>'+(list.length>100?'<p class="note" style="padding:8px 16px">Mostrando 100 de '+list.length+'. Refine os filtros.</p>':'');
}
function viewEntregas(){
  var f=UI.f;
  return '<div class="page-h"><div><h1>Entregas e coletas</h1><p>Acompanhe saída, entrega ou coleta e retorno de cada pedido.</p></div><button class="btn btn-primary" data-act="nova-ent">Nova entrega ou coleta</button></div>'+
  '<div class="filters"><input type="search" aria-label="Buscar" data-bind="f.q" placeholder="Buscar cliente, número ou código" value="'+esc(f.q)+'">'+
  '<select aria-label="Tipo" data-bind="f.op">'+opts([['','Entregas e coletas'],['entrega','Só entregas'],['coleta','Só coletas']],f.op)+'</select>'+
  '<select aria-label="Período" data-bind="f.dia">'+opts([['hoje','Hoje'],['7d','7 dias'],['todos','Todas']],f.dia)+'</select>'+
  '<select aria-label="Status" data-bind="f.status">'+opts([['','Todos os status']].concat(Object.keys(STATUS).map(function(k){return [k,STATUS[k].l];})),f.status)+'</select>'+
  '<select aria-label="Motorista" data-bind="f.mot">'+opts([['','Todos os motoristas']].concat(DB.colaboradores.map(function(c){return [c.id,c.nome];})),f.mot)+'</select>'+
  '<select aria-label="Vínculo" data-bind="f.tipo">'+opts([['','Todos os vínculos'],['Efetivado','Efetivados'],['Terceirizado','Terceirizados']],f.tipo)+'</select></div>'+
  '<section class="panel" id="lista"></section>';
}
function filtroEntregas(){
  var f=UI.f,q=f.q.trim().toLowerCase();
  return DB.entregas.filter(function(e){
    if(!inPeriod(e,f.dia))return false;
    if(f.op&&opDe(e)!==f.op)return false;
    if(f.status&&e.status!==f.status)return false;
    if(f.mot&&e.motoristaId!==f.mot)return false;
    if(f.tipo){var m=colab(e.motoristaId);if(!m||m.tipo!==f.tipo)return false;}
    if(q){var hay=(e.id+' '+e.cliente+' '+e.endereco+' '+e.itens.map(function(i){return i.codigo+' '+i.desc;}).join(' ')).toLowerCase();if(hay.indexOf(q)<0)return false;}
    return true;
  }).sort(function(a,b){return b.id-a.id;});
}
function fillEntregas(){var el=$('#lista');if(el)el.innerHTML=entTable(filtroEntregas(),false);}

/* antes de abrir, pede os links temporários da foto e da assinatura (bucket privado) */
function openEntrega(id){
  var e0=entById(id);if(!e0)return;
  Dados.assinar([e0.foto,e0.assinatura]).then(function(){openEntregaView(id);});
}
function openEntregaView(id){
  var e=entById(id);if(!e)return;
  var col=ehColeta(e),editavel=naBase(e);
  var m=colab(e.motoristaId),ocs=DB.ocorrencias.filter(function(o){return o.entregaId===id;});
  var c=isConcl(e),fl=c?stL(e):(col?'Coleta':'Entrega');
  var tone=e.status==='devolvido'?'bad':e.status==='entregue_problema'?'warn':e.status==='enviado_errado'?'mag':'';
  function st(l,t,cls){return '<div class="st'+(t?' done '+(cls||''):'')+'"><b>'+l+'</b><span>'+(t?hhmm(t):'pendente')+'</span></div>';}
  var tl='<div class="tl">'+st('Separado',e.criadoEm)+st(col?'Saiu para coleta':'Saiu para entrega',e.saidaEm)+st(fl,e.concluidoEm,tone)+st('Motorista retornou',e.retornoEm)+'</div>';
  var dur=[];if(e.saidaEm&&e.concluidoEm)dur.push('Rota: '+fmtDur(mins(e.saidaEm,e.concluidoEm)));if(e.concluidoEm&&e.retornoEm)dur.push('Volta: '+fmtDur(mins(e.concluidoEm,e.retornoEm)));
  var it='<div class="scroll"><table class="tbl" style="min-width:420px"><thead><tr><th>Código</th><th>Descrição</th><th class="r">'+(col?'Previsto':'Enviado')+'</th><th class="r">'+(col?'Coletado':'Entregue')+'</th></tr></thead><tbody>'+e.itens.map(function(i){var dif=c&&i.qtdEntregue!==i.qtd;return '<tr><td class="mono">'+esc(i.codigo)+'</td><td>'+esc(i.desc)+'</td><td class="r num">'+i.qtd+'</td><td class="r num"'+(dif?' style="color:var(--bad);font-weight:600"':'')+'>'+(c?i.qtdEntregue:'—')+'</td></tr>';}).join('')+'</tbody></table></div>';
  function ev(v,img){v=v?Dados.urlEvid(v):v;if(v&&String(v).indexOf('data:')===0)return '<img class="ev" alt="'+img+'" src="'+v+'">';if(v&&/^https:\/\//.test(String(v)))return '<a href="'+esc(v)+'" target="_blank" rel="noopener"><img class="ev" alt="'+img+'" src="'+esc(v)+'"></a>';if(v==='exemplo')return '<div class="ph">'+img+' registrada (exemplo)</div>';return '<div class="ph">Sem '+img.toLowerCase()+'</div>';}
  var ocH=ocs.length?'<div><div class="lbl" style="margin-bottom:6px">Ocorrências</div>'+ocs.map(function(o){return '<div class="li" style="padding:8px 0"><div><span class="pill p-'+(o.tipo==='devolvido'?'bad':o.tipo==='enviado_errado'?'mag':'warn')+'"><i></i>'+TIPOS_OC[o.tipo]+'</span><span class="sub">'+(o.codigo?esc(o.codigo)+' · ':'')+esc(o.motivo)+'</span></div><span class="mono muted">'+hhmm(o.em)+'</span></div>';}).join('')+'</div>':'';
  var act='';
  if(!editavel){}
  else{
  if(e.status==='separado')act+='<button class="btn" data-act="adm-saida" data-id="'+id+'">Registrar saída agora</button>';
  if(e.status==='em_rota')act+='<button class="btn" data-act="adm-entregue" data-id="'+id+'">'+(col?'Marcar coletada':'Marcar entregue')+'</button><button class="btn btn-danger" data-act="adm-devolvido" data-id="'+id+'">Marcar devolvido</button>';
  if(c&&!e.retornoEm)act+='<button class="btn" data-act="adm-retorno" data-id="'+id+'">Registrar retorno do motorista</button>';
  if(e.status!=='separado')act+='<button class="btn" data-act="oc-new" data-id="'+id+'">Registrar ocorrência</button>';
  if(usaReal()&&!temLocal(e))act+='<button class="btn" data-act="ent-loc" data-id="'+id+'">Localizar no mapa</button>';
  }
  openModal(mh('#'+e.id+' · '+esc(e.cliente),tagOp(e)+' '+pill(e.status,e.tipo)+(late(e)?' <span class="late">atrasada</span>':''))+
  '<div class="dlg-b"><div class="kv"><div><span>Motorista</span>'+(m?esc(m.nome)+' '+tagTipo(m)+'<div class="sub">'+esc(m.tipo==='Terceirizado'?m.empresa+' · ':'')+esc(m.veiculo)+' '+esc(m.placa)+'</div>':'—')+'</div><div><span>Endereço</span>'+esc(e.endereco)+'</div><div><span>Dia</span>'+esc(e.dia.split('-').reverse().join('/'))+'</div><div><span>Prazo</span><span class="mono" style="font-size:14px;letter-spacing:0;text-transform:none;color:inherit;font-weight:400">'+hhmm(e.prazo)+'</span></div>'+(e.recebedor?'<div><span>Recebido por</span>'+esc(e.recebedor)+'</div>':'')+'</div>'+
  tl+(dur.length?'<p class="note">'+dur.join(' · ')+'</p>':'')+it+
  (c?'<div class="evs"><div><div class="lbl" style="margin-bottom:6px">Foto da '+(col?'coleta':'entrega')+'</div>'+ev(e.foto,'Foto')+'</div><div><div class="lbl" style="margin-bottom:6px">Assinatura do cliente</div>'+ev(e.assinatura,'Assinatura')+'</div></div>':'')+
  ocH+(e.obs?'<div><div class="lbl">Observações</div><p>'+esc(e.obs)+'</p></div>':'')+(act?'<div class="dlg-f" style="justify-content:flex-start">'+act+'</div>':'')+'</div>');
}
function entById(id){return DB.entregas.find(function(x){return x.id===id;})||histEntrega(id);}
function naBase(e){return DB.entregas.indexOf(e)>=0;}
function afterChange(id){save();renderApp();if(id)openEntrega(id);}

function openNovaEntrega(){
  var d=new Date(Date.now()+3*3600000);if(d.getDate()!==new Date().getDate())d=new Date();var pz=pad(d.getHours())+':'+pad(d.getMinutes());
  var ativos=DB.colaboradores.filter(function(c){return c.ativo!==false;});
  function grp(t){return '<optgroup label="'+t+'s">'+ativos.filter(function(c){return c.tipo===t;}).map(function(c){return '<option value="'+c.id+'">'+esc(c.nome)+(c.empresa?' · '+esc(c.empresa):'')+'</option>';}).join('')+'</optgroup>';}
  openModal(mh('Nova entrega ou coleta','Informe os itens por código e quantidade.')+
  '<form id="f-ent" class="dlg-b"><div class="form-grid"><div class="field"><label for="ne-op">Tipo</label><select id="ne-op" name="op"><option value="entrega">Entrega (levar ao cliente)</option><option value="coleta">Coleta (buscar com o cliente)</option></select></div><div class="field"><label for="ne-c">Cliente</label><input id="ne-c" name="cliente" required autofocus></div><div class="field"><label for="ne-e">Endereço</label><input id="ne-e" name="endereco"></div>'+
  '<div class="field"><label for="ne-m">Motorista</label><select id="ne-m" name="mot" required>'+grp('Efetivado')+grp('Terceirizado')+'</select></div><div class="field"><label for="ne-p">Prazo (hoje)</label><input id="ne-p" name="prazo" type="time" value="'+pz+'" required></div></div>'+
  '<div><div class="lbl" style="margin-bottom:6px">Local da entrega no mapa (opcional)</div>'+pickMapHtml()+'<p class="note" id="pick-note">Clique no mapa para marcar o local. Sem marcação, usamos o local do cliente cadastrado.</p><input type="hidden" name="px" id="ne-x"><input type="hidden" name="py" id="ne-y"><input type="hidden" name="plat" id="ne-lat"><input type="hidden" name="plng" id="ne-lng"></div>'+
  '<div><div class="lbl" style="margin-bottom:6px">Itens (código, descrição, quantidade)</div><div id="itens">'+itemRow()+'</div><button type="button" class="btn btn-sm" data-act="add-item">Adicionar item</button></div>'+
  '<div class="field"><label for="ne-o">Observações</label><textarea id="ne-o" name="obs"></textarea></div>'+
  '<datalist id="dl-cat">'+DB.catalogo.map(function(p){return '<option value="'+esc(p[0])+'">'+esc(p[1])+'</option>';}).join('')+'</datalist>'+
  '<div class="err" id="ne-err" role="alert"></div><div class="dlg-f"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn" type="submit" data-mode="sep">Salvar sem despachar</button><button class="btn btn-primary" type="submit" data-mode="rota">Salvar e despachar</button></div></form>');
  if(usaReal())mrPick();
}
function itemRow(){return '<div class="item-row"><input name="codigo" list="dl-cat" placeholder="Código" aria-label="Código"><input name="desc" placeholder="Descrição" aria-label="Descrição"><input name="qtd" type="number" min="1" value="1" aria-label="Quantidade"><button type="button" class="btn" data-act="rm-item" aria-label="Remover item">×</button></div>';}
function saveEntrega(form,mode){
  var err=$('#ne-err');
  var rows=[].slice.call(form.querySelectorAll('.item-row')),itens=[];
  rows.forEach(function(r){var cd=r.querySelector('[name=codigo]').value.trim(),ds=r.querySelector('[name=desc]').value.trim(),q=parseInt(r.querySelector('[name=qtd]').value,10);if(cd&&q>0)itens.push({codigo:cd,desc:ds||cd,qtd:q,qtdEntregue:q});});
  if(!itens.length){err.textContent='Adicione ao menos um item com código e quantidade.';return;}
  var hm=fv(form,'prazo').split(':'),pz=new Date();pz.setHours(+hm[0],+hm[1],0,0);
  itens.forEach(function(i){if(!DB.catalogo.some(function(p){return p[0]===i.codigo;}))DB.catalogo.push([i.codigo,i.desc]);});
  var lat=fv(form,'plat')?+fv(form,'plat'):null,lng=fv(form,'plng')?+fv(form,'plng'):null,px=fv(form,'px')?+fv(form,'px'):null,py=fv(form,'py')?+fv(form,'py'):null;
  /* sem local marcado: tenta achar o endereço sozinho no mapa antes de salvar */
  if(lat==null&&lng==null&&usaReal()&&!form.dataset.geo){
    var end=fv(form,'endereco').trim();
    if(end){
      form.dataset.geo='1';err.textContent='Localizando o endereço no mapa…';
      geocodificar(end).then(function(a){
        if(a.length){$('#ne-lat').value=a[0].lat.toFixed(6);$('#ne-lng').value=a[0].lng.toFixed(6);saveEntrega(form,mode);}
        else{err.textContent='Não encontrei este endereço no mapa. Clique no mapa para marcar o local, ou salve de novo para criar a entrega sem local.';}
      }).catch(function(){err.textContent='Não consegui consultar o mapa agora. Clique no mapa para marcar o local, ou salve de novo para criar a entrega sem local.';});
      return;
    }
  }
  if(lat!=null&&lng!=null){var q=fromLL(lat,lng);px=Math.round(q.x);py=Math.round(q.y);}else{lat=null;lng=null;}
  var id=++DB.seq.ent,n=nowIso();
  var op=fv(form,'op')==='coleta'?'coleta':'entrega';
  DB.entregas.push({id:id,tipo:op,x:px,y:py,lat:lat,lng:lng,dia:todayKey(),cliente:fv(form,'cliente').trim(),endereco:fv(form,'endereco').trim(),motoristaId:fv(form,'mot'),status:mode==='rota'?'em_rota':'separado',prazo:pz.toISOString(),criadoEm:n,saidaEm:mode==='rota'?n:null,concluidoEm:null,retornoEm:null,itens:itens,obs:fv(form,'obs').trim(),recebedor:'',foto:null,assinatura:null});
  save();closeModal();renderApp();toast((op==='coleta'?'Coleta #':'Entrega #')+id+(mode==='rota'?' despachada':' criada'));
}
function openOcForm(id){
  var e=entById(id);if(!e)return;
  openModal(mh('Registrar ocorrência','#'+e.id+' · '+esc(e.cliente))+
  '<form id="f-oc" class="dlg-b" data-id="'+id+'"><div class="field"><label for="oc-t">Tipo</label><select id="oc-t" name="tipo" autofocus>'+opts(Object.keys(TIPOS_OC).map(function(k){return [k,TIPOS_OC[k]];}),'defeito')+'</select></div>'+
  '<div class="field"><label for="oc-i">Item</label><select id="oc-i" name="item">'+opts([['','Geral']].concat(e.itens.map(function(i){return [i.codigo,i.codigo+' · '+i.desc];})),'')+'</select></div>'+
  '<div class="field"><label for="oc-m">Motivo</label><textarea id="oc-m" name="motivo" required></textarea></div>'+
  '<div class="dlg-f"><button class="btn" type="button" data-act="open-ent" data-id="'+id+'">Voltar</button><button class="btn btn-primary" type="submit">Registrar</button></div></form>',true);
}
function saveOc(form){
  var id=+form.dataset.id,e=entById(id),tipo=fv(form,'tipo'),n=nowIso();
  DB.ocorrencias.push({id:++DB.seq.oc,entregaId:id,dia:e.dia,tipo:tipo,codigo:fv(form,'item'),motivo:fv(form,'motivo').trim(),em:n,motoristaId:e.motoristaId});
  if(tipo==='devolvido'||tipo==='enviado_errado'){if(!isConcl(e)){e.concluidoEm=n;}e.status=tipo;}
  else if(e.status==='entregue'||e.status==='em_rota'){if(e.status==='em_rota')e.concluidoEm=n;e.status='entregue_problema';}
  afterChange(id);toast('Ocorrência registrada');
}

/* ============ admin: colaboradores ============ */
function viewColabs(){
  var ef=DB.colaboradores.filter(function(c){return c.tipo==='Efetivado';}).length;
  return '<div class="page-h"><div><h1>Colaboradores</h1><p>'+DB.colaboradores.length+' cadastrados · '+ef+' efetivados · '+(DB.colaboradores.length-ef)+' terceirizados</p></div><button class="btn btn-primary" data-act="col-new">Novo colaborador</button></div>'+
  '<div class="filters"><input type="search" aria-label="Buscar" data-bind="c.q" placeholder="Buscar nome, usuário, empresa ou placa" value="'+esc(UI.c.q)+'"><select aria-label="Vínculo" data-bind="c.tipo">'+opts([['','Todos os vínculos'],['Efetivado','Efetivados'],['Terceirizado','Terceirizados']],UI.c.tipo)+'</select></div>'+
  '<section class="panel" id="lista"></section>';
}
function fillColabs(){
  var q=UI.c.q.trim().toLowerCase(),t=UI.c.tipo;
  var rows=DB.colaboradores.filter(function(c){return (!t||c.tipo===t)&&(!q||(c.nome+' '+(c.usuario||'')+' '+(c.empresa||'')+' '+(c.placa||'')).toLowerCase().indexOf(q)>=0);});
  var el=$('#lista');if(!el)return;
  el.innerHTML='<div class="scroll"><table class="tbl" style="min-width:820px"><thead><tr><th>Nome</th><th>Vínculo</th><th>Veículo</th><th>Telefone</th><th>Usuário</th><th class="r">Hoje</th><th>Situação</th><th></th></tr></thead><tbody>'+
  (rows.length?rows.map(function(c){var n=DB.entregas.filter(function(e){return e.motoristaId===c.id&&e.dia===todayKey();}).length;return '<tr><td><b>'+esc(c.nome)+'</b><span class="sub mono">'+esc(c.matricula||'')+'</span></td><td>'+tagTipo(c)+'<span class="sub">'+esc(c.tipo==='Terceirizado'?c.empresa:'Quadro próprio')+'</span></td><td>'+esc(c.veiculo)+'<span class="sub mono">'+esc(c.placa)+'</span></td><td class="mono">'+esc(c.telefone||'—')+'</td><td class="mono">'+esc(c.usuario||'—')+'</td><td class="r num">'+n+'</td><td>'+(c.ativo===false?'<span class="pill p-neutral"><i></i>Inativo</span>':'<span class="pill p-good"><i></i>Ativo</span>')+'</td><td><div class="row" style="flex-wrap:nowrap"><button class="btn btn-sm" data-act="col-link" data-id="'+c.id+'">Link</button><button class="btn btn-sm" data-act="col-edit" data-id="'+c.id+'">Editar</button></div></td></tr>';}).join(''):'<tr><td colspan="8" class="empty">Nenhum colaborador encontrado.</td></tr>')+'</tbody></table></div>';
}
function openColabForm(id){
  var c=id?colab(id):{nome:'',tipo:'Efetivado',empresa:'',veiculo:'',placa:'',telefone:'',usuario:'',senha:'',cpf:'',matricula:'',ativo:true};
  openModal(mh(id?'Editar colaborador':'Novo colaborador')+
  '<form id="f-col" class="dlg-b" data-id="'+(id||'')+'"><div class="form-grid"><div class="field"><label for="cf-n">Nome</label><input id="cf-n" name="nome" required autofocus value="'+esc(c.nome)+'"></div>'+
  '<div class="field"><label for="cf-tipo">Vínculo</label><select id="cf-tipo" name="tipo">'+opts([['Efetivado','Efetivado (funcionário da empresa)'],['Terceirizado','Terceirizado']],c.tipo)+'</select></div>'+
  '<div class="field" id="cf-emp"'+(c.tipo==='Terceirizado'?'':' hidden')+'><label for="cf-e">Empresa terceirizada</label><input id="cf-e" name="empresa" value="'+esc(c.empresa)+'"></div>'+
  '<div class="field"><label for="cf-mat">Matrícula ou código</label><input id="cf-mat" name="matricula" value="'+esc(c.matricula)+'"></div><div class="field"><label for="cf-cpf">CPF</label><input id="cf-cpf" name="cpf" inputmode="numeric" value="'+esc(c.cpf)+'"></div><div class="field"><label for="cf-tel">Telefone</label><input id="cf-tel" name="telefone" inputmode="tel" value="'+esc(c.telefone)+'"></div>'+
  '<div class="field"><label for="cf-v">Veículo</label><input id="cf-v" name="veiculo" value="'+esc(c.veiculo)+'"></div><div class="field"><label for="cf-pl">Placa</label><input id="cf-pl" name="placa" value="'+esc(c.placa)+'"></div>'+
  '<div class="field"><label for="cf-u">Usuário de acesso</label><input id="cf-u" name="usuario" autocapitalize="none" required value="'+esc(c.usuario)+'"></div><div class="field"><label for="cf-s">Senha</label><input id="cf-s" name="senha" required value="'+esc(c.senha)+'"></div>'+
  '<div class="field"><label for="cf-a">Situação</label><select id="cf-a" name="ativo">'+opts([['1','Ativo'],['0','Inativo']],c.ativo===false?'0':'1')+'</select></div></div>'+
  '<div class="err" id="cf-err" role="alert"></div><div class="dlg-f"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn btn-primary" type="submit">Salvar</button></div></form>');
}
function randToken(){var AL='abcdefghjkmnpqrstuvwxyz23456789',s='';for(var i=0;i<8;i++)s+=AL[Math.floor(Math.random()*AL.length)];return s;}
function saveColab(form){
  var id=form.dataset.id,u=fv(form,'usuario').trim();
  if(u.toLowerCase()==='admin'||DB.colaboradores.some(function(c){return c.id!==id&&c.usuario&&c.usuario.toLowerCase()===u.toLowerCase();})){$('#cf-err').textContent='Este usuário já existe. Escolha outro.';return;}
  var tipo=fv(form,'tipo');
  var d={nome:fv(form,'nome').trim(),tipo:tipo,empresa:tipo==='Terceirizado'?fv(form,'empresa').trim():'',matricula:fv(form,'matricula').trim(),cpf:fv(form,'cpf').trim(),telefone:fv(form,'telefone').trim(),veiculo:fv(form,'veiculo').trim(),placa:fv(form,'placa').trim().toUpperCase(),usuario:u,senha:fv(form,'senha'),ativo:fv(form,'ativo')==='1'};
  if(id){Object.assign(colab(id),d);if(Dados.modo==='online')colab(id).senha='';save();closeModal();renderApp();toast('Colaborador salvo'+(Dados.modo==='online'&&d.senha?'. A senha só muda pelo painel do Supabase.':''));return;}
  d.id='c'+(++DB.seq.col);d.token=randToken();
  if(Dados.modo==='online'){
    if((d.senha||'').length<6){$('#cf-err').textContent='No modo online a senha precisa ter ao menos 6 caracteres.';DB.seq.col--;return;}
    var senha=d.senha;d.senha='';
    Dados.criarAcesso(d,senha).then(function(){DB.colaboradores.push(d);closeModal();renderApp();toast('Colaborador criado, já com acesso');}).catch(function(e){DB.seq.col--;$('#cf-err').textContent='Não foi possível criar o acesso: '+((e&&e.message)||e);});
    return;
  }
  DB.colaboradores.push(d);save();closeModal();renderApp();toast('Colaborador salvo');
}
function linkFor(c){return location.href.split('#')[0]+(Dados.modo==='online'?'#u-'+encodeURIComponent(c.usuario):'#mot-'+c.token);}
function openLink(id){
  var c=colab(id);if(!c)return;
  var on=Dados.modo==='online';
  openModal(mh('Link de '+esc(c.nome),tagTipo(c)+(c.empresa?' '+esc(c.empresa):''))+
  '<div class="dlg-b"><p>'+(on?'O motorista abre este link no celular, o usuário já vem preenchido e ele digita a senha. Ele cai direto na tela das entregas dele, identificado como <b>'+esc(c.tipo)+'</b>.':'O motorista abre este link no celular e cai direto na tela das entregas dele, identificado como <b>'+esc(c.tipo)+'</b>.')+' Cada atualização de status fica registrada com o nome e o vínculo.</p>'+
  '<div class="linkbox"><input id="lk" readonly value="'+esc(linkFor(c))+'" aria-label="Link do motorista"><button class="btn" data-act="copy-link" data-id="'+c.id+'">Copiar</button></div>'+
  (on?'<p class="note">Usuário de acesso: <span class="mono">'+esc(c.usuario)+'</span>. A senha é a definida no cadastro.</p>':'<p class="note">Código de acesso: <span class="mono">mot-'+esc(c.token)+'</span>. No modo local os dados ficam salvos no navegador, então o link só funciona neste mesmo aparelho. Com o banco online, ele funciona em qualquer celular.</p>')+
  '<div class="dlg-f" style="justify-content:flex-start">'+(on?'':'<button class="btn btn-primary" data-act="col-open" data-id="'+c.id+'">Abrir como este motorista</button><button class="btn" data-act="col-regen" data-id="'+c.id+'">Gerar novo link</button>')+'</div></div>',true);
}

/* ============ admin: ocorrências ============ */
function viewOcs(){
  return '<div class="page-h"><div><h1>Ocorrências</h1><p>Devoluções, defeitos, avarias, itens faltando e envios errados.</p></div></div>'+
  '<div class="filters"><select aria-label="Tipo" data-bind="o.tipo">'+opts([['','Todos os tipos']].concat(Object.keys(TIPOS_OC).map(function(k){return [k,TIPOS_OC[k]];})),UI.o.tipo)+'</select>'+
  '<select aria-label="Vínculo" data-bind="o.mt">'+opts([['','Todos os vínculos'],['Efetivado','Efetivados'],['Terceirizado','Terceirizados']],UI.o.mt)+'</select>'+
  '<select aria-label="Período" data-bind="o.dia">'+opts([['hoje','Hoje'],['7d','7 dias'],['todos','Todas']],UI.o.dia)+'</select></div><section class="panel" id="lista"></section>';
}
function fillOcs(){
  var o=UI.o;
  var rows=DB.ocorrencias.filter(function(x){if(!inPeriod(x,o.dia))return false;if(o.tipo&&x.tipo!==o.tipo)return false;if(o.mt){var m=colab(x.motoristaId);if(!m||m.tipo!==o.mt)return false;}return true;}).sort(function(a,b){return b.em.localeCompare(a.em);});
  var el=$('#lista');if(!el)return;
  el.innerHTML=rows.length?'<div class="scroll"><table class="tbl"><thead><tr><th>Quando</th><th>Entrega</th><th>Tipo</th><th>Item</th><th>Motivo</th><th>Motorista</th></tr></thead><tbody>'+rows.slice(0,100).map(function(x){var e=entById(x.entregaId),m=colab(x.motoristaId);return '<tr data-act="open-ent" data-id="'+x.entregaId+'"><td class="mono">'+ddmm(x.em)+' '+hhmm(x.em)+'</td><td><span class="mono">#'+x.entregaId+'</span><span class="sub">'+esc(e?e.cliente:'')+'</span></td><td><span class="pill p-'+(x.tipo==='devolvido'?'bad':x.tipo==='enviado_errado'?'mag':'warn')+'"><i></i>'+TIPOS_OC[x.tipo]+'</span></td><td class="mono">'+esc(x.codigo||'—')+'</td><td>'+esc(x.motivo)+'</td><td>'+(m?esc(m.nome)+' '+tagTipo(m):'—')+'</td></tr>';}).join('')+'</tbody></table></div>'+(rows.length>100?'<p class="note" style="padding:8px 16px">Mostrando 100 de '+rows.length+'.</p>':''):'<div class="empty">Nenhuma ocorrência no período.</div>';
}

/* ============ admin: dados ============ */
function openDados(){
  if(Dados.modo==='online'){
    openModal(mh('Dados')+'<div class="dlg-b"><p>Os dados estão no banco online (Supabase). O painel atualiza sozinho a cada poucos segundos.</p><p class="note">Para apagar ou restaurar dados, use o painel do Supabase (Table Editor).</p></div>',true);
    return;
  }
  openModal(mh('Dados do modo local')+'<div class="dlg-b"><p>Tudo fica salvo neste navegador. Use as opções abaixo para recomeçar.</p>'+
  '<div><button class="btn" data-act="ask" data-t="reset">Restaurar dados de exemplo</button><div id="ask-reset" hidden class="row" style="margin-top:8px"><span class="note">Isso substitui tudo pelos dados de exemplo.</span><button class="btn btn-danger btn-sm" data-act="do-reset">Confirmar</button></div></div>'+
  '<div><button class="btn" data-act="ask" data-t="clear">Apagar entregas e ocorrências</button><div id="ask-clear" hidden class="row" style="margin-top:8px"><span class="note">Os colaboradores continuam cadastrados.</span><button class="btn btn-danger btn-sm" data-act="do-clear">Confirmar</button></div></div></div>',true);
}

/* corrigir o local de uma entrega que ficou sem posição no mapa */
function openLocalizarEntrega(id){
  var e=entById(id);if(!e)return;
  openModal(mh('Localizar no mapa','#'+e.id+' · '+esc(e.cliente))+
  '<form id="f-loc" class="dlg-b" data-id="'+id+'"><div class="field"><label for="ne-e">Endereço</label><input id="ne-e" name="endereco" value="'+esc(e.endereco||'')+'"></div>'+
  '<div><div class="lbl" style="margin-bottom:6px">Local no mapa</div>'+pickMapHtml()+'<p class="note" id="pick-note">Clique em "Localizar pelo endereço" ou clique no mapa para marcar o local.</p><input type="hidden" id="ne-lat"><input type="hidden" id="ne-lng"></div>'+
  '<div class="err" id="ne-err" role="alert"></div><div class="dlg-f"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn btn-primary" type="submit">Salvar local</button></div></form>');
  mrPick();
}
function saveLocalizarEntrega(form){
  var e=entById(+form.dataset.id)||entById(form.dataset.id);if(!e)return;
  var lat=parseFloat($('#ne-lat').value),lng=parseFloat($('#ne-lng').value);
  if(isNaN(lat)||isNaN(lng)){$('#ne-err').textContent='Marque o local no mapa antes de salvar.';return;}
  e.endereco=fv(form,'endereco');e.lat=lat;e.lng=lng;
  var q=fromLL(lat,lng);e.x=Math.round(q.x);e.y=Math.round(q.y);
  GEO_TENTOU[e.id]=1;
  save();closeModal();renderApp();toast('Local salvo. A rota será traçada pelas ruas.');
}
