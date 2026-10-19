'use strict';
/* dados de exemplo (modo local) */
/* ============ dados de exemplo ============ */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function at(day,min){return new Date(day.getFullYear(),day.getMonth(),day.getDate(),0,min,0,0);}
function addMin(d,m){return new Date(d.getTime()+m*60000);}

function seed(){
  var rnd=mulberry32(19102026);
  function ri(a,b){return a+Math.floor(rnd()*(b-a+1));}
  function pick(a){return a[Math.floor(rnd()*a.length)];}
  var AL='abcdefghjkmnpqrstuvwxyz23456789';
  function tk(){var s='';for(var i=0;i<8;i++)s+=AL[Math.floor(rnd()*AL.length)];return s;}
  var now=new Date();
  var colaboradores=EQUIPE.map(function(r,i){return {id:'c'+(i+1),nome:r[0],tipo:r[1],empresa:r[2],veiculo:r[3],placa:r[4],telefone:r[5],usuario:r[6],senha:'1234',cpf:'',matricula:(r[1]==='Efetivado'?'EF-0':'TC-0')+(101+i),ativo:true,token:tk()};});
  var ef=colaboradores.filter(function(c){return c.tipo==='Efetivado';});
  var te=colaboradores.filter(function(c){return c.tipo==='Terceirizado';});
  var pool=ef.concat(ef,te);
  var raw=[];
  function mkItens(){var n=ri(1,4),used={},it=[];while(it.length<n){var p=pick(CATALOGO);if(used[p[0]])continue;used[p[0]]=1;var q=ri(1,12);it.push({codigo:p[0],desc:p[1],qtd:q,qtdEntregue:q});}return it;}
  function baseE(day,m){var c=pick(CLIENTES);return {dia:dayKey(day),cliente:c[0],endereco:c[1],motoristaId:m.id,itens:mkItens(),obs:'',recebedor:'',foto:null,assinatura:null,saidaEm:null,concluidoEm:null,retornoEm:null,criadoEm:at(day,7*60).toISOString()};}
  function rollStatus(ter){var r=rnd(),p=ter?[0.78,0.87,0.94]:[0.88,0.94,0.97];return r<p[0]?'entregue':r<p[1]?'entregue_problema':r<p[2]?'devolvido':'enviado_errado';}
  function fechar(e,status,saida,dur,gap){
    var concl=addMin(saida,dur);
    e.saidaEm=saida.toISOString();e.concluidoEm=concl.toISOString();e.prazo=addMin(saida,gap).toISOString();e.status=status;
    e.foto='exemplo';
    if(status==='entregue'||status==='entregue_problema'){e.assinatura='exemplo';e.recebedor=pick(RECEB);}
    if(status==='entregue_problema')e._oc=pick(['defeito','defeito','avaria','falta']);
    if(status==='devolvido'){e._oc='devolvido';e.itens.forEach(function(i){i.qtdEntregue=0;});}
    if(status==='enviado_errado')e._oc='enviado_errado';
    return concl;
  }
  var d,i;
  for(d=6;d>=1;d--){
    var day=new Date(now.getFullYear(),now.getMonth(),now.getDate()-d);
    var n=ri(38,52);
    for(i=0;i<n;i++){
      var m=pick(pool),ter=m.tipo==='Terceirizado';
      var e=baseE(day,m);
      var saida=at(day,7*60+30+ri(0,7*60+30));
      var dur=ter?ri(35,100):ri(25,75);
      var concl=fechar(e,rollStatus(ter),saida,dur,ri(55,85));
      e.retornoEm=addMin(concl,ri(12,40)).toISOString();
      raw.push(e);
    }
  }
  var day0=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  var anchor=new Date(now);
  if(anchor.getHours()<10||anchor.getHours()>=20)anchor=at(day0,14*60+10);
  var aMin=anchor.getHours()*60+anchor.getMinutes(),sMin=7*60+30;
  for(i=0;i<29;i++){
    var m2=pick(pool),ter2=m2.tipo==='Terceirizado';
    var e2=baseE(day0,m2);
    var sm=ri(sMin,Math.max(sMin,aMin-80));
    var dur2=ter2?ri(35,100):ri(25,75);
    dur2=Math.min(dur2,Math.max(10,aMin-sm-3));
    var c2=fechar(e2,i===3?'devolvido':i===7?'enviado_errado':rollStatus(ter2),at(day0,sm),dur2,ri(55,85));
    var ret=addMin(c2,ri(12,40));
    if(ret<=anchor)e2.retornoEm=ret.toISOString();
    raw.push(e2);
  }
  var rotaM=[colaboradores[0],colaboradores[2],colaboradores[4],colaboradores[6]];
  for(i=0;i<11;i++){
    var m3=i<4?rotaM[i]:pick(rotaM);
    var e3=baseE(day0,m3);
    e3.saidaEm=at(day0,Math.max(sMin,aMin-ri(10,140))).toISOString();
    e3.prazo=addMin(new Date(e3.saidaEm),ri(70,130)).toISOString();
    e3.status='em_rota';
    raw.push(e3);
  }
  for(i=0;i<10;i++){
    var e4=baseE(day0,pick(colaboradores));
    e4.status='separado';
    e4.prazo=addMin(anchor,ri(30,260)).toISOString();
    raw.push(e4);
  }
  rotaM.forEach(function(m){var cs=raw.filter(function(e){return e.dia===dayKey(day0)&&e.motoristaId===m.id&&e.concluidoEm;}).sort(function(a,b){return b.concluidoEm.localeCompare(a.concluidoEm);});cs.slice(0,ri(1,2)).forEach(function(e){e.retornoEm=null;});});
  raw.sort(function(a,b){return a.dia.localeCompare(b.dia)||(a.saidaEm||a.prazo).localeCompare(b.saidaEm||b.prazo);});
  var ocs=[],ocSeq=0;
  raw.forEach(function(e,idx){
    e.id=1001+idx;
    if(e._oc){
      var it=pick(e.itens);
      if(e._oc==='falta')it.qtdEntregue=Math.max(0,it.qtd-ri(1,Math.min(3,it.qtd)));
      ocs.push({id:++ocSeq,entregaId:e.id,dia:e.dia,tipo:e._oc,codigo:it.codigo,motivo:pick(MOT[e._oc]),em:e.concluidoEm,motoristaId:e.motoristaId});
      delete e._oc;
    }
  });
  return {v:1,demo:true,seedDay:todayKey(),seq:{ent:1000+raw.length,oc:ocSeq,col:colaboradores.length},colaboradores:colaboradores,entregas:raw,ocorrencias:ocs,catalogo:CATALOGO.map(function(x){return x.slice();})};
}
