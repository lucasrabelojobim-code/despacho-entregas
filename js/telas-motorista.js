'use strict';
/* ============ motorista ============ */
function driverShell(){
  var c=colab(SESSION.id);if(!c){SESSION=null;return viewLogin();}
  var head='<div class="band top dhead"><div class="band-in"><div class="top-row">'+mark()+'<div><b style="font:600 22px/1 var(--font-display)">Olá, '+esc(c.nome.split(' ')[0])+'</b><div class="row" style="margin-top:4px">'+tagTipo(c)+(c.tipo==='Terceirizado'?'<span class="note">'+esc(c.empresa)+'</span>':'')+(SESSION.via==='link'?'<span class="note">acesso por link</span>':'')+'</div></div><div class="top-r"><button class="btn btn-sm" data-act="logout">Sair</button></div></div></div></div>';
  return head+(UI.drv.screen==='confirm'?viewConfirm(c):UI.drv.screen==='abast'?viewAbast(c):viewDrvHome(c));
}
function drvList(c){return DB.entregas.filter(function(e){return e.motoristaId===c.id&&(e.dia===todayKey()||!isConcl(e));}).sort(function(a,b){return a.prazo.localeCompare(b.prazo);});}
function dCard(e){
  var itens='<div class="itl">'+e.itens.map(function(i){return '<div><span class="mono">'+esc(i.codigo)+'</span><span>'+esc(i.desc)+'</span><b style="margin-left:auto">'+i.qtd+'</b></div>';}).join('')+'</div>';
  var col=ehColeta(e);
  var btn=e.status==='separado'?'<button class="btn btn-primary btn-lg" data-act="drv-saida" data-id="'+e.id+'">'+(col?'Saí para coleta':'Saí para entrega')+'</button>':'<button class="btn btn-primary btn-lg" data-act="drv-confirm" data-id="'+e.id+'">'+(col?'Confirmar coleta':'Confirmar entrega')+'</button>';
  return '<article class="dcard"><div class="row" style="justify-content:space-between"><span class="mono muted">'+tagOp(e)+' '+(STOPNO[e.id]?'Parada '+STOPNO[e.id]+' · ':'')+'#'+e.id+'</span><span class="mono">Prazo '+hhmm(e.prazo)+(late(e)?' <span class="late">atrasada</span>':'')+'</span></div><div><h3>'+esc(e.cliente)+'</h3><div class="muted">'+esc(e.endereco)+'</div></div>'+itens+'<button class="btn btn-sm" style="align-self:flex-start" data-act="drv-map" data-id="'+e.id+'">Ver no mapa</button>'+(e.status==='em_rota'?'<div class="note">Saiu às '+hhmm(e.saidaEm)+'</div>':'')+btn+'</article>';
}
function viewDrvHome(c){
  var l=drvList(c),rota=l.filter(function(e){return e.status==='em_rota';}),sep=l.filter(function(e){return e.status==='separado';}),done=l.filter(isConcl);
  var pend=done.filter(function(e){return !e.retornoEm;}).length;
  var tot=l.length,pc=tot?Math.round(done.length*100/tot):0;
  var rt=routeOf(c,'driver');STOPNO={};if(rt)rt.stops.forEach(function(x,i){STOPNO[x.id]=i+1;});
  var h='<div class="dwrap"><section class="dcard"><div class="row" style="justify-content:space-between"><b>Hoje</b><span class="num">'+done.length+' de '+tot+' concluídas</span></div><div class="meter m-ef" role="progressbar" aria-valuenow="'+pc+'" aria-valuemin="0" aria-valuemax="100"><i style="width:'+pc+'%"></i></div></section>'+abastCard(c)+gpsCard()+driverMapHtml(c,UI.drv.hl);
  if(rota.length)h+='<div class="dsec">Em rota ('+rota.length+')</div>'+rota.map(dCard).join('');
  if(sep.length){h+='<div class="dsec">Para sair ('+sep.length+')</div>';if(sep.length>1)h+='<button class="btn btn-lg" data-act="drv-saida-all">Saí com todas ('+sep.length+')</button>';h+=sep.map(dCard).join('');}
  if(!rota.length&&!sep.length)h+='<section class="dcard"><b>Nenhuma entrega pendente.</b><span class="muted">Novas entregas aparecem aqui assim que forem separadas.</span></section>';
  h+='<section class="dcard"><h3>Seus indicadores</h3>'+statsHtml(c)+'</section>';
  if(done.length)h+='<div class="dsec">Concluídas hoje</div><section class="dcard" style="padding:4px 14px">'+done.slice().reverse().map(function(e){return '<div class="li" style="padding:10px 0"><div><b>'+esc(e.cliente)+'</b><span class="sub">'+(ehColeta(e)?'Coleta ':'')+'#'+e.id+' · '+hhmm(e.concluidoEm)+(e.retornoEm?' · voltou '+hhmm(e.retornoEm):'')+'</span></div>'+pill(e.status,e.tipo)+'</div>';}).join('')+'</section>';
  h+='</div>';
  if(pend>0||rota.length){
    h+='<div class="dbar"><div>'+(rota.length?'<button class="btn btn-lg" disabled>Voltei para a empresa</button><span class="note">Finalize as entregas em rota para registrar o retorno.</span>':'<button class="btn btn-primary btn-lg" data-act="drv-voltei">Voltei para a empresa ('+pend+')</button>')+'</div></div>';
  }
  return h;
}
function viewConfirm(c){
  var e=entById(UI.drv.id);if(!e)return '';
  UI.foto=null;UI.signed=false;
  var col=ehColeta(e);
  return '<div class="dwrap"><button class="btn" data-act="drv-back" style="align-self:flex-start">Voltar</button>'+
  '<form id="f-conf" class="dcard" data-id="'+e.id+'"><div><span class="mono muted">'+tagOp(e)+' #'+e.id+'</span><h3>'+esc(e.cliente)+'</h3><div class="muted">'+esc(e.endereco)+'</div></div>'+
  driverMapHtml(c,e.id,true)+'<div class="dsec" style="margin-bottom:0">Confira os itens</div><div>'+e.itens.map(function(i,ix){return '<div class="qrow"><div><span class="mono muted">'+esc(i.codigo)+'</span> '+esc(i.desc)+'<span class="sub">'+(col?'Previsto: ':'Enviado: ')+i.qtd+'</span></div><input name="q'+ix+'" type="number" min="0" max="'+i.qtd+'" value="'+i.qtd+'" aria-label="Quantidade '+(col?'coletada':'entregue')+' de '+esc(i.codigo)+'" inputmode="numeric"></div>';}).join('')+'</div>'+
  '<div class="dsec" style="margin-bottom:0">Resultado</div>'+
  (col?[['entregue','Coletada sem problema','Tudo conferido e retirado com o cliente'],['problema','Coletada com problema','Defeito, avaria ou item faltando'],['devolvido','Não coletada','Cliente sem o material ou ninguém para entregar'],['errado','Coleta errada','Produto ou quantidade diferente do combinado']]:
   [['entregue','Entregue sem problema','Tudo conferido e aceito pelo cliente'],['problema','Entregue com problema','Defeito, avaria ou item faltando'],['devolvido','Devolvido','Cliente não aceitou ou ninguém para receber'],['errado','Enviado errado','Produto ou quantidade diferente do pedido']]).map(function(o,ix){return '<label class="opt'+(ix===0?' sel':'')+'"><input type="radio" name="res" value="'+o[0]+'"'+(ix===0?' checked':'')+'><div><b>'+o[1]+'</b><span>'+o[2]+'</span></div></label>';}).join('')+
  '<div id="blk-prob" hidden class="dcard" style="background:var(--surface-2)"><div class="field" id="blk-tipo"><label for="cf-tp">Tipo do problema</label><select id="cf-tp" name="tipo"><option value="defeito">Produto com defeito</option><option value="avaria">Avaria no transporte</option><option value="falta">Item faltando</option></select></div>'+
  '<div class="field"><label for="cf-it">Item</label><select id="cf-it" name="item"><option value="">Geral</option>'+e.itens.map(function(i){return '<option value="'+esc(i.codigo)+'">'+esc(i.codigo)+' · '+esc(i.desc)+'</option>';}).join('')+'</select></div><div class="field"><label for="cf-mo">O que aconteceu</label><textarea id="cf-mo" name="motivo"></textarea></div></div>'+
  '<div class="field" id="blk-recv"><label for="cf-rc">'+(col?'Quem entregou o material':'Quem recebeu')+'</label><input id="cf-rc" name="recebedor" autocomplete="off"></div>'+
  '<div class="field"><span class="lbl">Foto</span><label class="pick" for="foto-in"><span id="foto-lbl">Tirar foto</span></label><input class="vh" id="foto-in" type="file" accept="image/*" capture="environment"><img id="foto-prev" class="ev" alt="Prévia da foto" hidden></div>'+
  '<div class="field" id="blk-sig"><div class="row" style="justify-content:space-between"><span class="lbl">Assinatura do cliente</span><button type="button" class="btn btn-sm" data-act="sig-clear">Limpar</button></div><canvas id="sig" aria-label="Área de assinatura"></canvas></div>'+
  '<div class="field"><label for="cf-ob">Observações</label><textarea id="cf-ob" name="obs"></textarea></div>'+
  '<div class="err" id="conf-err" role="alert"></div><button class="btn btn-primary btn-lg" type="submit">'+(col?'Finalizar coleta':'Finalizar entrega')+'</button></form></div>';
}
function syncConf(){
  var f=$('#f-conf');if(!f)return;
  var r=fres(f);
  [].forEach.call(f.querySelectorAll('.opt'),function(o){o.classList.toggle('sel',o.querySelector('input').checked);});
  $('#blk-prob').hidden=(r==='entregue');
  $('#blk-tipo').hidden=(r!=='problema');
  var ok=(r==='entregue'||r==='problema');
  $('#blk-recv').hidden=!ok;$('#blk-sig').hidden=!ok;
  if(ok)initSign();
}
var sigCtx=null,sigDraw=false;
function initSign(){
  var cv=$('#sig');if(!cv||cv.dataset.ready==='1'&&cv.width>0&&cv.getBoundingClientRect().width>0&&cv.dataset.w==String(Math.round(cv.getBoundingClientRect().width)))return;
  var r=cv.getBoundingClientRect();if(!r.width)return;
  var dpr=window.devicePixelRatio||1;cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);
  var ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,r.width,r.height);
  ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#111';
  sigCtx=ctx;cv.dataset.ready='1';cv.dataset.w=String(Math.round(r.width));UI.signed=false;
}
function sigPos(ev){var r=$('#sig').getBoundingClientRect();return [ev.clientX-r.left,ev.clientY-r.top];}
function readImage(file){
  return new Promise(function(res,rej){
    var fr=new FileReader();
    fr.onload=function(){var img=new Image();img.onload=function(){var sc=Math.min(1,800/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',0.6));};img.onerror=rej;img.src=fr.result;};
    fr.onerror=rej;fr.readAsDataURL(file);
  });
}
function finishConf(form){
  var e=entById(+form.dataset.id),err=$('#conf-err'),res=fres(form);
  var itens=e.itens.map(function(it,ix){var v=parseInt(fv(form,'q'+ix),10);return {codigo:it.codigo,desc:it.desc,qtd:it.qtd,qtdEntregue:isNaN(v)?0:Math.max(0,Math.min(it.qtd,v))};});
  var ok=(res==='entregue'||res==='problema');
  if(res==='entregue'&&itens.some(function(i){return i.qtdEntregue!==i.qtd;})){err.textContent='A quantidade conferida é diferente da prevista. Escolha a opção "com problema".';return;}
  if(res!=='entregue'&&!fv(form,'motivo').trim()){err.textContent='Descreva o que aconteceu.';return;}
  if(ok&&!fv(form,'recebedor').trim()){err.textContent=ehColeta(e)?'Informe quem entregou o material.':'Informe quem recebeu.';return;}
  if(!UI.foto){err.textContent=ehColeta(e)?'Tire uma foto da coleta.':'Tire uma foto da entrega.';return;}
  if(ok&&!UI.signed){err.textContent='Peça a assinatura do cliente.';return;}
  var n=nowIso();
  e.status={entregue:'entregue',problema:'entregue_problema',devolvido:'devolvido',errado:'enviado_errado'}[res];
  if(res==='devolvido')itens.forEach(function(i){i.qtdEntregue=0;});
  e.itens=itens;e.concluidoEm=n;e.recebedor=ok?fv(form,'recebedor').trim():'';e.foto=UI.foto;e.assinatura=ok?$('#sig').toDataURL('image/png'):null;e.obs=fv(form,'obs').trim();
  if(res!=='entregue'){DB.ocorrencias.push({id:++DB.seq.oc,entregaId:e.id,dia:e.dia,tipo:res==='problema'?fv(form,'tipo'):res==='devolvido'?'devolvido':'enviado_errado',codigo:fv(form,'item'),motivo:fv(form,'motivo').trim(),em:n,motoristaId:e.motoristaId});}
  if(!save()){return;}
  UI.drv={screen:'home',id:null};renderApp();window.scrollTo(0,0);toast((ehColeta(e)?'Coleta #':'Entrega #')+e.id+' registrada');
}
