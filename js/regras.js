'use strict';
/* regras e indicadores */
/* ============ regras e indicadores ============ */
function colab(id){return DB.colaboradores.find(function(c){return c.id===id;});}
function isConcl(e){return CONCL.indexOf(e.status)>=0;}
function late(e){return isConcl(e)?(!!e.concluidoEm&&new Date(e.concluidoEm)>new Date(e.prazo)):new Date()>new Date(e.prazo);}
function inPeriod(e,p){if(p==='hoje')return e.dia===todayKey();if(p==='todos')return true;return e.dia>=dayKey(Date.now()-6*86400000);}
function totalUn(e){return sum(e.itens.map(function(i){return i.qtd;}));}
function calc(list){
  var desp=list.filter(function(e){return e.status!=='separado';});
  var concl=list.filter(isConcl);
  var cnt=function(s){return list.filter(function(e){return e.status===s;}).length;};
  var noPrazo=concl.filter(function(e){return !late(e);}).length;
  var tr=concl.filter(function(e){return e.saidaEm&&e.concluidoEm;}).map(function(e){return mins(e.saidaEm,e.concluidoEm);});
  var s={total:list.length,desp:desp.length,concl:concl.length,ok:cnt('entregue'),prob:cnt('entregue_problema'),dev:cnt('devolvido'),err:cnt('enviado_errado'),emRota:cnt('em_rota'),sep:cnt('separado')};
  s.atras=list.filter(late).length;
  s.atrasAbertas=list.filter(function(e){return !isConcl(e)&&late(e);}).length;
  s.noPrazo=noPrazo;s.noPrazoPct=pct(noPrazo,concl.length);
  s.rota=tr.length?Math.round(sum(tr)/tr.length):null;
  s.devPct=pct(s.dev,desp.length);s.errPct=pct(s.err,desp.length);s.probPct=pct(s.prob,desp.length);
  return s;
}
/* garante as listas do módulo de combustível em dados antigos (modo local) */
function garantirCombustivel(d){
  d.veiculos=d.veiculos||[];d.abastecimentos=d.abastecimentos||[];d.seq=d.seq||{};
  if(!d.seq.vei)d.seq.vei=d.veiculos.reduce(function(m,v){return v.id>m?v.id:m;},0);
}
function pill(st){var s=STATUS[st];return '<span class="pill p-'+s.c+'"><i></i>'+s.l+'</span>';}
function tagTipo(c){return '<span class="tag '+(c.tipo==='Terceirizado'?'tag-ter':'tag-ef')+'">'+esc(c.tipo)+'</span>';}
function meterCls(v){return v==null?'':v>=85?'':v>=70?'m-warn':'m-bad';}
