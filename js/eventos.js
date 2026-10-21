'use strict';
/* ============ eventos ============ */
document.addEventListener('click',function(ev){
  if(ev.target===ov){closeModal();return;}
  var pm=ev.target.closest('#pickmap');if(pm){pickPos(pm,ev);return;}
  var t=ev.target.closest('[data-act]');if(!t)return;
  var a=t.dataset.act,id=t.dataset.id,n=id&&/^\d+$/.test(id)?+id:id;
  switch(a){
    case 'close':closeModal();break;
    case 'nav':UI.view=t.dataset.v;renderApp();window.scrollTo(0,0);break;
    case 'logout':closeModal();logout();break;
    case 'login-demo':doLogin(t.dataset.u,t.dataset.p);break;
    case 'map-modo':UI.mapa=t.dataset.p;MR.view=null;renderApp();break;
    case 'gps-on':gpsLigar();break;
    case 'gps-off':gpsDesligar();renderApp();break;
    case 'geo-buscar':mrBuscarEndereco();break;
    case 'ent-loc':openLocalizarEntrega(n);break;
    case 'geo-pick':escolherGeo(n);break;
    case 'map-tipo':UI.mapTipo=t.dataset.p;UI.mapSel=null;renderApp();break;
    case 'map-sel':UI.mapSel=(UI.mapSel===id?null:id);renderApp();break;
    case 'map-stop':UI.drv.hl=n;renderApp();break;
    case 'drv-map':{UI.drv.hl=n;renderApp();var mp=$('#drv-map');if(mp&&mp.scrollIntoView)mp.scrollIntoView({block:'start'});break;}
    case 'periodo':UI.periodo=t.dataset.p;renderApp();break;
    case 'dados':openDados();break;
    case 'ask':{var b=$('#ask-'+t.dataset.t);if(b)b.hidden=false;break;}
    case 'do-reset':DB=seed();save();closeModal();renderApp();toast('Dados de exemplo restaurados');break;
    case 'do-clear':DB.entregas=[];DB.ocorrencias=[];DB.seq.ent=1000;DB.seq.oc=0;DB.demo=false;save();closeModal();renderApp();toast('Entregas e ocorrências apagadas');break;
    case 'drv-stats':openDrvStats(id);break;
    case 'vei-new':openVeicForm(null);break;
    case 'vei-edit':openVeicForm(n);break;
    case 'ab-open':openAbastecimento(n);break;
    case 'abast-novo':UI.drv={screen:'abast',id:null};renderApp();window.scrollTo(0,0);break;
    case 'open-ent':openEntrega(n);break;
    case 'nova-ent':openNovaEntrega();break;
    case 'add-item':{var box=$('#itens');var d=document.createElement('div');d.innerHTML=itemRow();box.appendChild(d.firstChild);break;}
    case 'rm-item':{var rows=document.querySelectorAll('#itens .item-row');if(rows.length>1)t.closest('.item-row').remove();break;}
    case 'oc-new':openOcForm(n);break;
    case 'adm-saida':{var e1=entById(n);e1.status='em_rota';e1.saidaEm=nowIso();afterChange(n);toast('Saída registrada');break;}
    case 'adm-entregue':{var e2=entById(n);e2.status='entregue';e2.concluidoEm=nowIso();afterChange(n);toast('Entrega marcada como entregue');break;}
    case 'adm-devolvido':{var e3=entById(n),t3=nowIso();e3.status='devolvido';e3.concluidoEm=t3;e3.itens.forEach(function(i){i.qtdEntregue=0;});DB.ocorrencias.push({id:++DB.seq.oc,entregaId:n,dia:e3.dia,tipo:'devolvido',codigo:'',motivo:'Registrado pela administração',em:t3,motoristaId:e3.motoristaId});afterChange(n);toast('Entrega marcada como devolvida');break;}
    case 'adm-retorno':{entById(n).retornoEm=nowIso();afterChange(n);toast('Retorno registrado');break;}
    case 'col-new':openColabForm(null);break;
    case 'col-edit':openColabForm(id);break;
    case 'col-link':openLink(id);break;
    case 'col-open':{SESSION={role:'driver',id:id,via:'login'};UI.drv={screen:'home',id:null};saveSession();closeModal();renderApp();window.scrollTo(0,0);break;}
    case 'col-regen':{colab(id).token=randToken();save();openLink(id);toast('Novo link gerado. O anterior deixou de funcionar.');break;}
    case 'copy-link':{var inp=$('#lk');(navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(inp.value):Promise.reject()).then(function(){toast('Link copiado');}).catch(function(){inp.select();toast('Selecione o texto e copie manualmente');});break;}
    case 'drv-saida':{var e5=entById(n);e5.status='em_rota';e5.saidaEm=nowIso();save();renderApp();toast('Saída registrada');break;}
    case 'drv-saida-all':{var k=0,ts=nowIso();DB.entregas.forEach(function(e){if(e.motoristaId===SESSION.id&&e.status==='separado'){e.status='em_rota';e.saidaEm=ts;k++;}});save();renderApp();toast(k+' entregas em rota');break;}
    case 'drv-confirm':UI.drv={screen:'confirm',id:n};renderApp();window.scrollTo(0,0);break;
    case 'drv-back':UI.drv={screen:'home',id:null};renderApp();break;
    case 'drv-voltei':{var ts2=nowIso();DB.entregas.forEach(function(e){if(e.motoristaId===SESSION.id&&isConcl(e)&&!e.retornoEm)e.retornoEm=ts2;});save();renderApp();toast('Retorno registrado');break;}
    case 'sig-clear':{var cv=$('#sig');if(cv&&sigCtx){var r=cv.getBoundingClientRect();sigCtx.fillStyle='#fff';sigCtx.fillRect(0,0,r.width,r.height);UI.signed=false;}break;}
  }
});
document.addEventListener('input',function(ev){
  var t=ev.target;
  if(t.dataset&&t.dataset.bind){var p=t.dataset.bind.split('.');UI[p[0]][p[1]]=t.value;fillLista();return;}
  if(t.list&&t.name==='codigo'){var p2=DB.catalogo.find(function(x){return x[0]===t.value.trim();});if(p2){var ds=t.closest('.item-row').querySelector('[name=desc]');if(!ds.value)ds.value=p2[1];}}
  if(t.id==='cf-tipo'){$('#cf-emp').hidden=(t.value!=='Terceirizado');}
  if(t.id==='ab-v')dicaKm();
  if(t.name==='res')syncConf();
});
document.addEventListener('change',function(ev){
  var t=ev.target;
  if((t.id==='ab-od-in'||t.id==='ab-nt-in')&&t.files&&t.files[0]){
    var od=(t.id==='ab-od-in'),pv=$(od?'#ab-od-prev':'#ab-nt-prev'),lb=$(od?'#ab-od-lbl':'#ab-nt-lbl');
    readImage(t.files[0]).then(function(u){if(od)UI.fotoOd=u;else UI.fotoNt=u;pv.src=u;pv.hidden=false;lb.textContent='Trocar foto';}).catch(function(){toast('Não foi possível ler a foto. Tente outra.');});
  }
  if(t.id==='foto-in'&&t.files&&t.files[0]){
    readImage(t.files[0]).then(function(u){UI.foto=u;var p=$('#foto-prev');p.src=u;p.hidden=false;$('#foto-lbl').textContent='Trocar foto';}).catch(function(){toast('Não foi possível ler a foto. Tente outra.');});
  }
});
document.addEventListener('submit',function(ev){
  var f=ev.target;ev.preventDefault();
  if(f.id==='f-login')doLogin(fv(f,'u'),fv(f,'p'));
  else if(f.id==='f-ent')saveEntrega(f,(ev.submitter&&ev.submitter.dataset.mode)||'sep');
  else if(f.id==='f-loc')saveLocalizarEntrega(f);
  else if(f.id==='f-col')saveColab(f);
  else if(f.id==='f-oc')saveOc(f);
  else if(f.id==='f-conf')finishConf(f);
  else if(f.id==='f-abast')saveAbast(f);
  else if(f.id==='f-vei')saveVeic(f);
});
document.addEventListener('keydown',function(ev){
  if(ev.key==='Escape'&&!ov.hidden)closeModal();
  var t=ev.target;if((ev.key==='Enter'||ev.key===' ')&&t.getAttribute&&t.getAttribute('role')==='button'&&t.dataset.act){ev.preventDefault();t.click();}
});
/* assinatura */
document.addEventListener('pointerdown',function(ev){if(ev.target.id!=='sig'||!sigCtx)return;sigDraw=true;ev.target.setPointerCapture(ev.pointerId);var p=sigPos(ev);sigCtx.beginPath();sigCtx.moveTo(p[0],p[1]);sigCtx.lineTo(p[0]+0.1,p[1]+0.1);sigCtx.stroke();UI.signed=true;ev.preventDefault();});
document.addEventListener('pointermove',function(ev){if(!sigDraw||ev.target.id!=='sig')return;var p=sigPos(ev);sigCtx.lineTo(p[0],p[1]);sigCtx.stroke();});
document.addEventListener('pointerup',function(){sigDraw=false;});
window.addEventListener('resize',function(){var cv=$('#sig');if(cv&&!UI.signed){cv.dataset.ready='0';initSign();}});
window.addEventListener('hashchange',function(){boot();});
