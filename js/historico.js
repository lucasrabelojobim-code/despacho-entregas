'use strict';
/* Aba "Histórico" (administrador e desenvolvedor): escolha um dia ou um período no calendário e veja
   indicadores, gráficos de rendimento e a linha do tempo de tudo que aconteceu (entregas, coletas,
   ocorrências e abastecimentos). Os dados do período vêm de Dados.historico (o painel inicial só
   carrega os últimos 30 dias). */
UI.h={de:null,ate:null,mes:null,pend:null,mot:'',op:'',vin:'',dados:null,carregando:false,erro:'',lim:200,cont:{}};
var HSEQ=0,MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

/* pedidos já carregados no histórico (para abrir os detalhes de dias antigos) */
function histEntrega(id){var d=UI.h&&UI.h.dados;return d?d.entregas.find(function(x){return x.id===id;}):undefined;}

/* ---------- datas ---------- */
function parseKey(k){var p=String(k).split('-');return new Date(+p[0],+p[1]-1,+p[2]);}
function addDias(k,n){var d=parseKey(k);d.setDate(d.getDate()+n);return dayKey(d);}
function difDias(a,b){return Math.round((parseKey(b)-parseKey(a))/86400000);}
function fmtDia(k){return String(k).split('-').reverse().join('/');}
function histPadrao(){var h=UI.h;if(!h.de){h.ate=todayKey();h.de=addDias(h.ate,-6);h.mes=h.ate.slice(0,7);}}
function periodoTxt(){
  var h=UI.h;
  if(h.pend)return 'Clique em outro dia para marcar um período, ou no mesmo dia para ver só ele.';
  return h.de===h.ate?'Dia '+fmtDia(h.de):'De '+fmtDia(h.de)+' até '+fmtDia(h.ate)+' ('+(difDias(h.de,h.ate)+1)+' dias)';
}

/* ---------- calendário ---------- */
function histCalHtml(h,pf){
  h=h||UI.h;pf=pf||'h';
  var p=h.mes.split('-'),ano=+p[0],mes=+p[1]-1,hoje=todayKey();
  var dias=new Date(ano,mes+1,0).getDate(),ini=new Date(ano,mes,1).getDay(),cont=(h.cont||{})[h.mes]||{},i,d;
  var s='<div class="cal"><div class="cal-h"><button class="btn btn-sm" type="button" data-act="'+pf+'-mes" data-id="-1" aria-label="Mês anterior">‹</button><b>'+MESES[mes]+' de '+ano+'</b><button class="btn btn-sm" type="button" data-act="'+pf+'-mes" data-id="1" aria-label="Próximo mês">›</button></div><div class="cal-g">';
  ['D','S','T','Q','Q','S','S'].forEach(function(x){s+='<span class="cal-w">'+x+'</span>';});
  for(i=0;i<ini;i++)s+='<span></span>';
  for(d=1;d<=dias;d++){
    var k=ano+'-'+pad(mes+1)+'-'+pad(d),dentro=k>=h.de&&k<=h.ate,pontas=(k===h.de||k===h.ate);
    s+='<button type="button" class="cal-d'+(dentro?' in':'')+(pontas?' ext':'')+(k===hoje?' hoje':'')+(cont[k]?' has':'')+'" data-act="'+pf+'-dia" data-id="'+k+'"'+(k>hoje?' disabled':'')+' aria-pressed="'+dentro+'" title="'+(cont[k]?cont[k]+(cont[k]===1?' pedido':' pedidos'):'sem pedidos')+'">'+d+'</button>';
  }
  return s+'</div><div class="cal-leg"><span><i class="cal-pt"></i>dia com pedidos</span></div></div>';
}
function histCal(){var el=$('#h-cal');if(el)el.innerHTML=histCalHtml(UI.h,'h');var t=$('#h-per');if(t)t.textContent=periodoTxt();}
/* atalhos de período (os mesmos no Histórico e em Limpar histórico) */
function atalhosHtml(pf,comTudo){
  var l=[['hoje','Hoje'],['ontem','Ontem'],['7d','7 dias'],['30d','30 dias'],['mes','Este mês'],['mesant','Mês passado']];
  if(comTudo)l.push(['tudo','Tudo']);
  return l.map(function(a){return '<button type="button" class="btn btn-sm" data-act="'+pf+'-atalho" data-id="'+a[0]+'">'+a[1]+'</button>';}).join('');
}
/* cliques do calendário. st = estado {de,ate,mes,pend}; cb(mudouPeriodo, mudouMes). Devolve true se tratou. */
function calAcao(st,pf,a,id,cb,limite){
  if(a===pf+'-dia'){
    if(st.pend){
      var x=st.pend,y=id;st.de=x<y?x:y;st.ate=x<y?y:x;st.pend=null;
      if(limite&&difDias(st.de,st.ate)>limite)st.ate=addDias(st.de,limite);
    }else{st.de=st.ate=id;st.pend=id;}
    cb(true,false);return true;
  }
  if(a===pf+'-mes'){
    var p=st.mes.split('-'),d=new Date(+p[0],+p[1]-1+(+id),1);
    st.mes=d.getFullYear()+'-'+pad(d.getMonth()+1);cb(false,true);return true;
  }
  if(a===pf+'-atalho'){
    var hoje=todayKey(),ini=hoje,fim=hoje,dh=new Date();
    if(id==='ontem'){ini=fim=addDias(hoje,-1);}
    else if(id==='7d'){ini=addDias(hoje,-6);}
    else if(id==='30d'){ini=addDias(hoje,-29);}
    else if(id==='mes'){ini=dayKey(new Date(dh.getFullYear(),dh.getMonth(),1));}
    else if(id==='mesant'){ini=dayKey(new Date(dh.getFullYear(),dh.getMonth()-1,1));fim=dayKey(new Date(dh.getFullYear(),dh.getMonth(),0));}
    else if(id==='tudo'){ini='2000-01-01';}
    st.de=ini;st.ate=fim;st.pend=null;st.mes=fim.slice(0,7);cb(true,true);return true;
  }
  return false;
}

/* ---------- tela ---------- */
function viewHist(){
  histPadrao();
  var h=UI.h;
  return '<div class="page-h"><div><h1>Histórico</h1><p>Escolha um dia ou um período no calendário e veja tudo o que aconteceu.</p></div></div>'+
  '<div class="hgrid"><section class="panel"><div class="panel-h"><h2>Período</h2></div><div class="panel-b"><div id="h-cal">'+histCalHtml(UI.h,'h')+'</div>'+
    '<div class="row" style="margin-top:10px">'+atalhosHtml('h',false)+'</div>'+
    '<p class="note" id="h-per" style="margin-top:8px">'+esc(periodoTxt())+'</p></div></section>'+
  '<section class="panel"><div class="panel-h"><h2>Filtros</h2></div><div class="panel-b" style="display:flex;flex-direction:column;gap:10px">'+
    '<div class="field"><label for="h-op">Tipo</label><select id="h-op" data-bind="h.op">'+opts([['','Entregas e coletas'],['entrega','Só entregas'],['coleta','Só coletas']],h.op)+'</select></div>'+
    '<div class="field"><label for="h-mot">Motorista</label><select id="h-mot" data-bind="h.mot">'+opts([['','Todos os motoristas']].concat(DB.colaboradores.map(function(c){return [c.id,c.nome];})),h.mot)+'</select></div>'+
    '<div class="field"><label for="h-vin">Vínculo</label><select id="h-vin" data-bind="h.vin">'+opts([['','Efetivados e terceirizados'],['Efetivado','Efetivados'],['Terceirizado','Terceirizados']],h.vin)+'</select></div>'+
    '<p class="note">Os gráficos e a lista abaixo respeitam o período e os filtros.</p>'+
    '<div class="row"><button class="btn" type="button" data-act="h-xlsx">Baixar Excel</button><button class="btn" type="button" data-act="h-pdf">Baixar PDF</button></div></div></section></div>'+
  '<div id="h-corpo"><div class="empty">Carregando…</div></div>';
}
function histIniciar(){UI.h.cont={};histCarregar();histContagem();}
function histCarregar(){
  var h=UI.h,n=++HSEQ;h.carregando=true;h.erro='';h.lim=200;
  histDesenhar();
  Dados.historico(h.de,h.ate).then(function(d){
    if(n!==HSEQ)return;h.dados=d;h.carregando=false;histDesenhar();
    /* fotos e assinaturas só são pedidas quando o item é aberto */
  }).catch(function(e){if(n!==HSEQ)return;h.carregando=false;h.erro=(e&&e.message)||String(e);histDesenhar();});
}
function histContagem(){
  var h=UI.h,mes=h.mes;
  if(h.cont[mes])return;
  var p=mes.split('-'),de=mes+'-01',ate=dayKey(new Date(+p[0],+p[1],0));
  Dados.diasComMovimento(de,ate).then(function(m){h.cont[mes]=m;if(UI.h.mes===mes)histCal();}).catch(function(){h.cont[mes]={};});
}

/* ---------- cliques ---------- */
function histAcao(a,t,id){
  var h=UI.h;
  if(calAcao(h,'h',a,id,function(per,mes){histCal();if(mes)histContagem();if(per)histCarregar();},365))return true;
  if(a==='h-mais'){h.lim+=200;histDesenhar();return true;}
  return false;
}

/* ---------- cálculo ---------- */
function histFiltrar(){
  var h=UI.h,d=h.dados;
  function okMot(id){return !h.mot||id===h.mot;}
  function okVin(id){if(!h.vin)return true;var c=colab(id);return !!c&&c.tipo===h.vin;}
  var ent=d.entregas.filter(function(e){return okMot(e.motoristaId)&&okVin(e.motoristaId)&&(!h.op||opDe(e)===h.op);});
  var ids={};ent.forEach(function(e){ids[e.id]=1;});
  var ativo=h.mot||h.vin||h.op;
  var oc=ativo?d.ocorrencias.filter(function(o){return ids[o.entregaId];}):d.ocorrencias;
  var ab=d.abastecimentos.filter(function(a){return okMot(a.motoristaId)&&okVin(a.motoristaId);});
  return {ent:ent,oc:oc,ab:ab};
}
/* dias (até 31 dias), semanas (até ~6 meses) ou meses: para o gráfico não ficar ilegível */
function histBaldes(ent){
  var h=UI.h,n=difDias(h.de,h.ate)+1,modo=n<=31?'d':n<=186?'s':'m',mapa={},ordem=[],k;
  function chave(dia){
    if(modo==='d')return dia;
    if(modo==='m')return dia.slice(0,7);
    var d=parseKey(dia);d.setDate(d.getDate()-((d.getDay()+6)%7));return dayKey(d);
  }
  function rotulo(c){
    if(modo==='d')return c.slice(8)+'/'+c.slice(5,7);
    if(modo==='m')return c.slice(5,7)+'/'+c.slice(2,4);
    return c.slice(8)+'/'+c.slice(5,7);
  }
  for(k=h.de;k<=h.ate;k=addDias(k,1)){var c=chave(k);if(!mapa[c]){mapa[c]={k:c,lbl:rotulo(c),list:[]};ordem.push(c);}}
  ent.forEach(function(e){var c=chave(e.dia);if(mapa[c])mapa[c].list.push(e);});
  return {baldes:ordem.map(function(c){return mapa[c];}),modo:modo};
}
function histBarras(baldes,series,aria){
  var vals=baldes.map(function(b){return series.map(function(sr){return sr[3](b.list);});});
  var mx=1;vals.forEach(function(v){var t=sum(v);if(t>mx)mx=t;});
  var top=Math.max(4,Math.ceil(mx/4)*4),n=baldes.length;
  var W=860,H=250,ml=36,mr=8,mt=20,mb=28,pw=W-ml-mr,ph=H-mt-mb,band=pw/n,bw=Math.min(46,band*0.7),step=Math.max(1,Math.ceil(34/band)),i;
  function y(v){return mt+ph-(v/top)*ph;}
  var s='<div class="legend">'+series.map(function(sr){return '<span><i class="dot" style="background:'+sr[4]+'"></i>'+sr[2]+'</span>';}).join('')+'</div><div class="scroll"><svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(aria)+'">';
  for(i=0;i<=4;i++){var v=top*i/4;s+='<line class="ax" x1="'+ml+'" x2="'+(W-mr)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="'+(ml-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+v+'</text>';}
  baldes.forEach(function(b,ix){
    var x=ml+band*ix+(band-bw)/2,acc=0;
    series.forEach(function(sr,si){var v2=vals[ix][si];if(!v2)return;var y1=y(acc+v2);s+='<rect class="'+sr[1]+'" x="'+x+'" y="'+y1+'" width="'+bw+'" height="'+(y(acc)-y1)+'"><title>'+esc(b.lbl)+' · '+sr[2]+': '+v2+'</title></rect>';acc+=v2;});
    if(acc&&band>=20)s+='<text class="tot" x="'+(x+bw/2)+'" y="'+(y(acc)-5)+'" text-anchor="middle">'+acc+'</text>';
    if(ix%step===0)s+='<text x="'+(x+bw/2)+'" y="'+(H-8)+'" text-anchor="middle">'+b.lbl+'</text>';
  });
  return s+'</svg></div>';
}
function histEventos(f){
  var d=UI.h.dados,ev=[];
  f.ent.forEach(function(e){
    var col=ehColeta(e),m=colab(e.motoristaId),mn=m?m.nome:'—';
    function add(t,txt){if(t)ev.push({t:t,txt:txt,det:'#'+e.id+' · '+e.cliente,eid:e.id,mn:mn,tag:tagOp(e)});}
    add(e.criadoEm,col?'Coleta criada':'Entrega criada');
    add(e.saidaEm,col?'Saiu para coleta':'Saiu para entrega');
    add(e.concluidoEm,stL(e));
    add(e.retornoEm,'Motorista retornou');
  });
  f.oc.forEach(function(o){
    var e=d.entregas.find(function(x){return x.id===o.entregaId;}),m=colab(o.motoristaId);
    ev.push({t:o.em,txt:'Ocorrência: '+(TIPOS_OC[o.tipo]||o.tipo),det:'#'+o.entregaId+(e?' · '+e.cliente:'')+(o.motivo?' · '+o.motivo:''),eid:o.entregaId,mn:m?m.nome:'—',tag:e?tagOp(e):''});
  });
  f.ab.forEach(function(a){
    var m=colab(a.motoristaId),v=(typeof veic==='function')?veic(a.veiculoId):null;
    ev.push({t:a.em,txt:'Abastecimento',det:fmtN(a.litros,1)+' L · '+fmtRs(a.valor)+' · '+fmtN(a.km,0)+' km'+(v?' · '+v.placa:''),eid:null,mn:m?m.nome:'—',tag:''});
  });
  return ev.filter(function(x){return x.t;}).sort(function(a,b){return String(b.t).localeCompare(String(a.t));});
}

/* ---------- desenho ---------- */
function histDesenhar(){
  var el=$('#h-corpo');if(!el)return;
  var h=UI.h;
  if(h.erro){el.innerHTML='<div class="empty">Não foi possível carregar o histórico: '+esc(h.erro)+'</div>';return;}
  if(!h.dados){el.innerHTML='<div class="empty">Carregando…</div>';return;}
  var f=histFiltrar(),ent=f.ent,s=calc(ent);
  var nCol=ent.filter(ehColeta).length,nEnt=ent.length-nCol;
  var corpo=(h.carregando?'<p class="note">Atualizando…</p>':'');

  corpo+='<div class="kpis">'+
    kpi('Pedidos',s.total,nEnt+(nEnt===1?' entrega':' entregas')+' · '+nCol+(nCol===1?' coleta':' coletas'))+
    kpi('Concluídos',s.concl,fmtPct(s.noPrazoPct)+' no prazo','good')+
    kpi('Rota média',fmtDur(s.rota),'da saída à conclusão')+
    kpi('Atrasados',s.atras,s.atrasAbertas+' ainda em aberto',s.atras?'warn':'')+
    kpi('Devolvidos',s.dev,fmtPct(s.devPct)+' dos despachados',s.dev?'bad':'')+
    kpi('Com problema',s.prob+s.err,s.prob+' defeito/avaria/falta, '+s.err+' errados',(s.prob+s.err)?'warn':'')+'</div>';

  /* gráficos por dia */
  var bk=histBaldes(ent),um=bk.modo==='d'?'por dia':bk.modo==='s'?'por semana (início na segunda)':'por mês';
  var sit=[
    ['ok','c-good','Concluído',function(l){return l.filter(function(e){return e.status==='entregue';}).length;},'var(--good)'],
    ['pr','c-warn','Com problema',function(l){return l.filter(function(e){return e.status==='entregue_problema';}).length;},'var(--warn)'],
    ['ru','c-bad','Devolvido / errado',function(l){return l.filter(function(e){return e.status==='devolvido'||e.status==='enviado_errado';}).length;},'var(--bad)'],
    ['ab','c-open','Em aberto',function(l){return l.filter(function(e){return !isConcl(e)&&!cancelada(e);}).length;},'var(--neutral-soft)']
  ];
  var tip=[
    ['en','c-ent','Entregas',function(l){return l.filter(function(e){return !ehColeta(e);}).length;},'var(--accent)'],
    ['co','c-col','Coletas',function(l){return l.filter(ehColeta).length;},'var(--viol)']
  ];
  corpo+='<div class="grid-eq"><section class="panel"><div class="panel-h"><h2>Rendimento '+um+'</h2><span class="note">por situação</span></div><div class="panel-b">'+(ent.length?histBarras(bk.baldes,sit,'Pedidos por situação'):'<div class="empty">Nenhum pedido no período.</div>')+'</div></section>'+
    '<section class="panel"><div class="panel-h"><h2>Entregas e coletas '+um+'</h2></div><div class="panel-b">'+(ent.length?histBarras(bk.baldes,tip,'Entregas e coletas'):'<div class="empty">Nenhum pedido no período.</div>')+'</div></section></div>';

  /* por motorista */
  var porMot={};ent.forEach(function(e){(porMot[e.motoristaId]=porMot[e.motoristaId]||[]).push(e);});
  var rows=Object.keys(porMot).map(function(id){return {c:colab(id),l:porMot[id],s:calc(porMot[id])};}).filter(function(r){return r.c;}).sort(function(a,b){return b.s.concl-a.s.concl||b.s.total-a.s.total;});
  var mxc=Math.max(1,Math.max.apply(null,rows.map(function(r){return r.s.concl;}).concat([1])));
  var tbMot='<div class="scroll"><table class="tbl"><thead><tr><th>Motorista</th><th class="r">Entregas</th><th class="r">Coletas</th><th class="r">Concluídos</th><th style="min-width:140px">No prazo</th><th class="r">Rota média</th><th class="r">Devol.</th><th class="r">Env. errado</th></tr></thead><tbody>'+
    (rows.length?rows.map(function(r){var c2=r.l.filter(ehColeta).length;return '<tr><td><b>'+esc(r.c.nome)+'</b> '+tagTipo(r.c)+'</td><td class="r num">'+(r.l.length-c2)+'</td><td class="r num">'+c2+'</td><td class="r num">'+r.s.concl+'</td><td><div class="pct"><div class="meter '+meterCls(r.s.noPrazoPct)+'"><i style="width:'+(r.s.noPrazoPct||0)+'%"></i></div><b>'+fmtPct(r.s.noPrazoPct)+'</b></div></td><td class="r num">'+fmtDur(r.s.rota)+'</td><td class="r num">'+r.s.dev+'</td><td class="r num">'+r.s.err+'</td></tr>';}).join(''):'<tr><td colspan="8" class="empty">Nenhum pedido no período.</td></tr>')+'</tbody></table></div>';
  var hbMot='<div class="panel-b">'+(rows.length?rows.map(function(r){return '<div class="hb"><span>'+esc(r.c.nome)+'</span><div class="meter m-ef"><i style="width:'+Math.round(r.s.concl*100/mxc)+'%"></i></div><b>'+r.s.concl+'</b></div>';}).join('')+'<p class="note" style="margin-top:8px">Pedidos concluídos por motorista</p>':'<div class="empty">Sem dados.</div>')+'</div>';
  corpo+='<section class="panel"><div class="panel-h"><h2>Desempenho por motorista</h2></div>'+tbMot+'</section>';

  /* ocorrências */
  var cnt={};f.oc.forEach(function(o){cnt[o.tipo]=(cnt[o.tipo]||0)+1;});
  var mxo=Math.max(1,Math.max.apply(null,Object.keys(TIPOS_OC).map(function(k){return cnt[k]||0;})));
  var ocH='<div class="panel-b">'+Object.keys(TIPOS_OC).map(function(k){var v=cnt[k]||0;return '<div class="hb"><span>'+TIPOS_OC[k]+'</span><div class="meter m-bad"><i style="width:'+Math.round(v*100/mxo)+'%"></i></div><b>'+v+'</b></div>';}).join('')+'<p class="note" style="margin-top:8px">'+f.oc.length+(f.oc.length===1?' ocorrência':' ocorrências')+' no período</p></div>';

  /* abastecimento */
  var porV={};f.ab.forEach(function(a){(porV[a.veiculoId]=porV[a.veiculoId]||[]).push(a);});
  var vrows=Object.keys(porV).map(function(id){
    var lista=porV[id].slice().sort(function(a,b){return a.km-b.km||String(a.em).localeCompare(String(b.em));}),v=veic(+id)||veic(id),cons=consumoDe(lista);
    return {v:v,lista:lista,cons:cons,litros:sum(lista.map(function(a){return a.litros;})),valor:sum(lista.map(function(a){return a.valor;}))};
  }).sort(function(a,b){return b.litros-a.litros;});
  var totL=sum(vrows.map(function(r){return r.litros;})),totV=sum(vrows.map(function(r){return r.valor;}));
  var kmT=sum(vrows.map(function(r){return r.cons.km;})),liT=sum(vrows.map(function(r){return r.cons.litros;}));
  var abH='<div class="kpis kpis-sm">'+kpi('Abastecimentos',f.ab.length,vrows.length+(vrows.length===1?' veículo':' veículos'))+kpi('Litros',fmtN(totL,1),'no período')+kpi('Gasto',fmtRs(totV),'no período')+kpi('Consumo médio',liT?fmtN(kmT/liT,1)+' km/L':'—','entre tanques cheios')+'</div>'+
    '<div class="scroll"><table class="tbl"><thead><tr><th>Veículo</th><th class="r">Abast.</th><th class="r">Litros</th><th class="r">Valor</th><th class="r">km rodados</th><th class="r">km/L</th><th class="r">Meta</th><th style="min-width:120px">Rendimento</th></tr></thead><tbody>'+
    (vrows.length?vrows.map(function(r){
      var meta=r.v&&r.v.metaKml,kml=r.cons.kml,pc=(meta&&kml)?Math.round(kml*100/meta):null;
      return '<tr><td>'+esc(nomeVeic(r.v))+'</td><td class="r num">'+r.lista.length+'</td><td class="r num">'+fmtN(r.litros,1)+'</td><td class="r num">'+fmtRs(r.valor)+'</td><td class="r num">'+(r.cons.km?fmtN(r.cons.km,0):'—')+'</td><td class="r num">'+(kml?fmtN(kml,1):'—')+'</td><td class="r num">'+(meta?fmtN(meta,1):'—')+'</td><td>'+(pc==null?'<span class="note">precisa de 2 tanques cheios</span>':'<div class="pct"><div class="meter '+(pc>=ALERTA_PCT*100?'':'m-bad')+'"><i style="width:'+Math.min(100,pc)+'%"></i></div><b>'+pc+'%</b></div>')+'</td></tr>';
    }).join(''):'<tr><td colspan="8" class="empty">Nenhum abastecimento no período.</td></tr>')+'</tbody></table></div>';
  corpo+='<div class="grid-eq"><section class="panel"><div class="panel-h"><h2>Rendimento por motorista</h2></div>'+hbMot+'</section><section class="panel"><div class="panel-h"><h2>Ocorrências por tipo</h2></div>'+ocH+'</section></div>'+
    '<section class="panel"><div class="panel-h"><h2>Abastecimento e consumo</h2></div>'+abH+'</section>';

  /* linha do tempo */
  var ev=histEventos(f),mostra=ev.slice(0,h.lim);
  var tl='<div class="scroll"><table class="tbl" style="min-width:640px"><thead><tr><th>Quando</th><th>O que aconteceu</th><th>Detalhe</th><th>Motorista</th></tr></thead><tbody>'+
    (mostra.length?mostra.map(function(x){
      var d=new Date(x.t);
      return '<tr'+(x.eid?' data-act="open-ent" data-id="'+x.eid+'"':'')+'><td class="mono">'+ddmm(d)+' '+hhmm(x.t)+'</td><td><b>'+esc(x.txt)+'</b> '+(x.tag||'')+'</td><td>'+esc(x.det)+'</td><td>'+esc(x.mn)+'</td></tr>';
    }).join(''):'<tr><td colspan="4" class="empty">Nada registrado neste período.</td></tr>')+'</tbody></table></div>'+
    (ev.length>mostra.length?'<div style="padding:10px 16px"><button class="btn" type="button" data-act="h-mais">Mostrar mais ('+(ev.length-mostra.length)+' restantes)</button></div>':'');
  corpo+='<section class="panel"><div class="panel-h"><h2>Histórico completo</h2><span class="note">'+ev.length+(ev.length===1?' registro':' registros')+' · clique para abrir o pedido</span></div>'+tl+'</section>';
  el.innerHTML=corpo;
}
