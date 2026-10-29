'use strict';
/* ============ leitor de código de barras e QR code (app do motorista) ============
   Usa o leitor nativo do celular (BarcodeDetector) quando existe; senão carrega o ZXing só na hora.
   O código lido é comparado com a OM/pedido cadastrado na entrega pelo admin. */
var LEITOR={stream:null,timer:null,zx:null,ok:false};
var FORMATOS=['code_128','code_39','code_93','codabar','ean_13','ean_8','itf','upc_a','upc_e','qr_code','data_matrix','pdf417'];

function normCod(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
/* entregas do motorista que batem com o código lido: primeiro as exatas, depois a OM mais longa contida no código */
function acharPorCodigo(txt,lista){
  var cod=normCod(txt);if(!cod)return [];
  var exatas=lista.filter(function(e){var om=normCod(e.om);return (om&&(om===cod||om.replace(/^0+/,'')===cod.replace(/^0+/,'')))||String(e.id)===cod;});
  if(exatas.length)return exatas;
  var cont=lista.filter(function(e){var om=normCod(e.om);return om.length>=4&&cod.indexOf(om)>=0;});
  var maior=cont.reduce(function(m,e){return Math.max(m,normCod(e.om).length);},0);
  return cont.filter(function(e){return normCod(e.om).length===maior;});
}

function openLeitor(){
  openModal(mh('Ler código','Aponte a câmera para o código de barras ou QR code da etiqueta.')+
  '<div class="dlg-b"><div class="leitor"><video id="lt-video" playsinline muted autoplay></video><i class="leitor-mira"></i></div>'+
  '<p class="note" id="lt-msg" role="status">Ligando a câmera…</p>'+
  '<form id="f-leitor" class="row" style="flex-wrap:nowrap"><input name="cod" aria-label="Código" placeholder="Ou digite o código / OM" autocomplete="off" style="flex:1;min-width:0"><button class="btn" type="submit">Buscar</button></form></div>',true);
  leitorLigar();
}
function leitorMsg(t){var m=$('#lt-msg');if(m)m.textContent=t;}
function leitorLigar(){
  LEITOR.ok=false;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){leitorMsg('Este aparelho não liberou a câmera para o app. Digite o código abaixo.');return;}
  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false}).then(function(st){
    var v=$('#lt-video');if(!v){st.getTracks().forEach(function(t){t.stop();});return;}
    LEITOR.stream=st;v.srcObject=st;var p=v.play();if(p&&p.catch)p.catch(function(){});
    leitorMsg('Procurando código…');
    leitorMotor().then(function(ler){LEITOR.timer=setTimeout(function laco(){
      if(!LEITOR.stream)return;
      ler(v).then(function(txt){
        if(!LEITOR.stream)return;
        if(txt){leitorAchou(txt);return;}
        LEITOR.timer=setTimeout(laco,250);
      },function(){if(LEITOR.stream)LEITOR.timer=setTimeout(laco,400);});
    },300);}).catch(function(){leitorMsg('Não consegui carregar o leitor. Digite o código abaixo.');});
  }).catch(function(er){
    leitorMsg(er&&er.name==='NotAllowedError'?'A câmera foi bloqueada. Libere a câmera para o app nas configurações do celular, ou digite o código abaixo.':'Não consegui abrir a câmera. Digite o código abaixo.');
  });
}
/* devolve uma função que lê um quadro do vídeo e resolve com o texto (ou vazio) */
function leitorMotor(){
  if('BarcodeDetector' in window&&BarcodeDetector.getSupportedFormats){
    return BarcodeDetector.getSupportedFormats().then(function(sup){
      var f=FORMATOS.filter(function(x){return sup.indexOf(x)>=0;});
      if(f.indexOf('code_128')<0||f.indexOf('qr_code')<0)return leitorZxing();
      var det=new BarcodeDetector({formats:f});
      return function(v){if(v.readyState<2)return Promise.resolve('');return det.detect(v).then(function(r){return r.length?r[0].rawValue:'';});};
    }).catch(leitorZxing);
  }
  return leitorZxing();
}
function leitorZxing(){
  return new Promise(function(res,rej){
    if(window.ZXing)return res();
    var s=document.createElement('script');s.src='js/vendor/zxing.js?v=20261029b';s.onload=res;s.onerror=rej;document.head.appendChild(s);
  }).then(function(){
    var Z=window.ZXing,hints=new Map();
    hints.set(Z.DecodeHintType.TRY_HARDER,true);
    var rd=new Z.MultiFormatReader();rd.setHints(hints);
    var cv=document.createElement('canvas'),ctx=cv.getContext('2d',{willReadFrequently:true});
    return function(v){
      if(v.readyState<2||!v.videoWidth)return Promise.resolve('');
      var sc=Math.min(1,1280/v.videoWidth);cv.width=Math.round(v.videoWidth*sc);cv.height=Math.round(v.videoHeight*sc);
      ctx.drawImage(v,0,0,cv.width,cv.height);
      try{var bmp=new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)));return Promise.resolve(rd.decode(bmp).getText());}
      catch(e){return Promise.resolve('');}
      finally{rd.reset();}
    };
  });
}
function leitorParar(){
  clearTimeout(LEITOR.timer);LEITOR.timer=null;
  if(LEITOR.stream){LEITOR.stream.getTracks().forEach(function(t){t.stop();});LEITOR.stream=null;}
}
/* fechar a janela sempre desliga a câmera */
var _fecharModal=closeModal;
closeModal=function(){leitorParar();_fecharModal();};

function leitorAchou(txt){
  if(LEITOR.ok)return;LEITOR.ok=true;
  leitorParar();
  if(navigator.vibrate)try{navigator.vibrate(120);}catch(e){}
  var c=colab(SESSION.id);if(!c)return;
  var l=acharPorCodigo(txt,drvList(c));
  if(l.length===1){closeModal();leitorAbrir(l[0]);return;}
  var b=ov.querySelector('.dlg-b');if(!b)return;
  if(!l.length){
    b.innerHTML='<div class="dcard" style="background:var(--surface-2)"><span class="lbl">Código lido</span><b class="mono" style="word-break:break-all">'+esc(txt)+'</b></div>'+
    '<p>Nenhuma entrega sua tem esta OM ou pedido. Confira se o admin cadastrou o número da OM na entrega.</p>'+
    '<div class="dlg-f"><button class="btn" type="button" data-act="close">Fechar</button><button class="btn btn-primary" type="button" data-act="ler-codigo">Ler outro</button></div>';
    return;
  }
  b.innerHTML='<p>O código <b class="mono">'+esc(txt)+'</b> bate com mais de uma entrega. Escolha:</p>'+
  l.map(function(e){return '<button class="btn btn-lg" type="button" data-act="ler-abrir" data-id="'+e.id+'" style="justify-content:flex-start;text-align:left">#'+e.id+' · '+esc(e.cliente)+(e.om?' · OM '+esc(e.om):'')+'</button>';}).join('');
}
function leitorAbrir(e){
  if(isConcl(e)){toast((ehColeta(e)?'Coleta #':'Entrega #')+e.id+' já foi concluída');return;}
  if(e.status==='em_rota'){UI.drv={screen:'confirm',id:e.id};renderApp();window.scrollTo(0,0);toast('OM encontrada: '+e.cliente);return;}
  UI.drv={screen:'home',id:null,hl:e.id};renderApp();
  var cd=$('#dc-'+e.id);if(cd){cd.classList.add('dcard-hl');if(cd.scrollIntoView)cd.scrollIntoView({block:'center'});}
  toast('OM encontrada: registre a saída de '+e.cliente);
}
function leitorDigitado(form){
  var t=fv(form,'cod').trim();if(!t)return;
  LEITOR.ok=false;leitorAchou(t);
}
