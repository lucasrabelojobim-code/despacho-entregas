'use strict';
/* Administrador: gerar o link de acompanhamento que o cliente abre no celular, sem login.
   O cliente vê só a situação, o tempo até chegar e a posição do motorista enquanto a entrega está em rota. */
function linkCopiar(url){
  function velho(){var i=$('#lk-url');if(!i)return;i.focus();i.select();try{document.execCommand('copy');toast('Link copiado');}catch(e){toast('Selecione o link e copie.');}}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){toast('Link copiado');},velho);}else velho();
}
function clienteAcao(a,t,id){
  if(a==='link-copiar'){var i=$('#lk-url');if(i)linkCopiar(i.value);return true;}
  if(a!=='link-cli')return false;
  if(!(SESSION&&SESSION.role==='admin'))return true;
  id=/^\d+$/.test(String(id))?+id:id;
  var e=entById(id);if(!e)return true;
  if(t)t.disabled=true;
  Dados.linkAcompanhamento(id).then(function(url){
    var col=ehColeta(e);
    var msg='Olá! Acompanhe '+(col?'a coleta':'a sua entrega')+' em tempo real: '+url;
    openModal(mh('Link para o cliente','#'+e.id+' · '+esc(e.cliente))+
      '<div class="dlg-b"><div class="field"><label for="lk-url">Link de acompanhamento</label><input id="lk-url" readonly value="'+esc(url)+'"></div>'+
      '<p class="note">Quem tiver este link vê o andamento desta '+(col?'coleta':'entrega')+', o tempo estimado e o motorista no mapa, sem precisar de login. O link encerra 24 horas depois de concluída.</p>'+
      '<div class="dlg-f" style="justify-content:flex-start"><button class="btn btn-primary" type="button" data-act="link-copiar">Copiar link</button>'+
      '<a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text='+encodeURIComponent(msg)+'">Enviar por WhatsApp</a>'+
      '<button class="btn" type="button" data-act="close">Fechar</button></div></div>');
  }).catch(function(err){if(t)t.disabled=false;toast('Não foi possível gerar o link: '+msgErro(err));});
  return true;
}
