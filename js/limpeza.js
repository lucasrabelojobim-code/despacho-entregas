'use strict';
/* Desenvolvedor > Limpar histórico: apaga registros de um período (calendário), à sua escolha:
   entregas/coletas (com ocorrências), abastecimentos e posições de GPS, e opcionalmente as fotos.
   Antes de apagar o site baixa um backup em CSV. Só o desenvolvedor vê esta tela, e o banco recusa
   qualquer outro usuário (funções dev_contar_limpeza e dev_limpar_historico, banco/06-limpar-historico.sql). */
UI.l={de:null,ate:null,mes:null,pend:null,cont:{},ent:true,ab:false,gps:false,fotos:true,abertos:false,bkp:true,info:null,dados:null,ocupado:false,msg:'',erro:''};
var LSEQ=0;

function limpaPadrao(){var l=UI.l;if(!l.de){l.ate=todayKey();l.de=addDias(l.ate,-6);l.mes=l.ate.slice(0,7);}}
function limpaOpcoes(){var l=UI.l;return {ent:l.ent,ab:l.ab,gps:l.gps,abertos:l.abertos,fotos:l.fotos};}
function limpaPeriodoTxt(){
  var l=UI.l;
  if(l.pend)return 'Clique em outro dia para marcar um período, ou no mesmo dia para só ele.';
  if(l.de==='2000-01-01')return 'Tudo, até '+fmtDia(l.ate);
  return l.de===l.ate?'Dia '+fmtDia(l.de):'De '+fmtDia(l.de)+' até '+fmtDia(l.ate)+' ('+(difDias(l.de,l.ate)+1)+' dias)';
}

function viewLimpar(){
  limpaPadrao();
  var l=UI.l;
  function chk(k,txt,sub){return '<label class="chk"><input type="checkbox" data-lchk="'+k+'"'+(l[k]?' checked':'')+'><span><b>'+txt+'</b>'+(sub?'<span class="note">'+sub+'</span>':'')+'</span></label>';}
  return '<section class="panel"><div class="panel-h"><h2>Limpar histórico</h2></div><div class="panel-b">'+
    '<div class="aviso-bad"><b>Apagar é permanente.</b> Não há como desfazer. Por isso o site baixa um backup do período antes de apagar e pede que você digite APAGAR.</div>'+
    '<div class="hgrid" style="margin:14px 0 0"><div><div class="lbl" style="margin-bottom:6px">1. Escolha o período</div><div id="l-cal">'+histCalHtml(l,'l')+'</div>'+
      '<div class="row" style="margin-top:10px">'+atalhosHtml('l',true)+'</div><p class="note" id="l-per" style="margin-top:8px">'+esc(limpaPeriodoTxt())+'</p></div>'+
    '<div><div class="lbl" style="margin-bottom:6px">2. Escolha o que apagar</div><div style="display:flex;flex-direction:column;gap:10px">'+
      chk('ent','Entregas e coletas','e as ocorrências ligadas a elas')+
      chk('ab','Abastecimentos','registros de combustível do período')+
      chk('gps','Posições de GPS','rastro de localização dos motoristas')+
      chk('fotos','Apagar também as fotos e assinaturas','remove os arquivos do armazenamento, liberando espaço')+
      chk('abertos','Incluir pedidos ainda em aberto','separados ou em rota. Se desmarcado, eles são mantidos')+
      chk('bkp','Baixar o backup (CSV) antes de apagar','recomendado. O backup não inclui fotos nem posições de GPS')+
    '</div><div class="row" style="margin-top:12px"><button class="btn btn-primary" type="button" data-act="l-conferir">3. Conferir o que será apagado</button></div></div></div>'+
    '<div id="l-res" style="margin-top:14px"></div></div></section>';
}
function limpaCal(){var el=$('#l-cal');if(el)el.innerHTML=histCalHtml(UI.l,'l');var t=$('#l-per');if(t)t.textContent=limpaPeriodoTxt();}
function limpaContagem(){
  var l=UI.l,mes=l.mes;if(l.cont[mes])return;
  var p=mes.split('-'),de=mes+'-01',ate=dayKey(new Date(+p[0],+p[1],0));
  Dados.diasComMovimento(de,ate).then(function(m){l.cont[mes]=m;if(UI.l.mes===mes)limpaCal();}).catch(function(){l.cont[mes]={};});
}
function fillLimpar(){limpaContagem();limpaRes();}

/* área de resultado: contagem, confirmação e botões */
function limpaRes(){
  var el=$('#l-res');if(!el)return;
  var l=UI.l,h='';
  if(l.erro)h+='<div class="err" role="alert" style="margin-bottom:8px">'+esc(l.erro)+'</div>';
  if(l.msg)h+='<div class="aviso-ok">'+esc(l.msg)+'</div>';
  if(l.ocupado&&!l.info){el.innerHTML=h+'<div class="empty">Conferindo…</div>';return;}
  var i=l.info;
  if(!i){el.innerHTML=h;return;}
  var linhas=[];
  if(l.ent){linhas.push([i.entregas,'entregas e coletas'],[i.ocorrencias,'ocorrências']);}
  if(l.ab)linhas.push([i.abastecimentos,'abastecimentos']);
  if(l.gps)linhas.push([i.posicoes,'posições de GPS']);
  if(l.fotos&&(l.ent||l.ab))linhas.push([i.arquivos,'fotos e assinaturas (arquivos)']);
  var total=sum(linhas.map(function(x){return x[0];}));
  h+='<div class="kpis kpis-sm">'+linhas.map(function(x){return kpi(x[1],x[0],'no período',x[0]?'warn':'');}).join('')+'</div>'+
    '<p style="margin:10px 0">Período: <b>'+esc(limpaPeriodoTxt())+'</b></p>'+
    (l.ent&&!l.abertos&&i.em_aberto?'<p class="note">'+i.em_aberto+(i.em_aberto===1?' pedido ainda em aberto será mantido':' pedidos ainda em aberto serão mantidos')+'.</p>':'')+
    (total===0?'<div class="empty">Não há nada para apagar com essas escolhas.</div>':
      '<div class="aviso-bad" style="margin-top:10px">Isto vai apagar <b>'+total+(total===1?' registro':' registros')+'</b> para sempre'+(l.bkp?', depois de baixar o backup':', <b>sem backup</b>')+'.</div>'+
      '<div class="row" style="align-items:flex-end;margin-top:10px"><div class="field" style="min-width:240px"><label for="l-conf">Para confirmar, digite APAGAR</label><input id="l-conf" autocomplete="off" autocapitalize="characters" spellcheck="false"></div>'+
      '<button class="btn" type="button" data-act="l-backup">Baixar só o backup</button>'+
      '<button class="btn btn-danger" type="button" id="l-ok" data-act="l-apagar" disabled>Apagar definitivamente</button></div>');
  el.innerHTML=h;
}

/* ---------- backup em CSV (abre no Excel: separador ";" e acentos corretos) ---------- */
function csvCel(v){v=(v==null?'':String(v));return /[";\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function csvBackup(dados,o){
  var cols=['registro','id','dia','tipo','cliente','endereco','motorista','status','prazo','criado_em','saida_em','concluido_em','retorno_em','itens','recebedor','observacoes','ocorrencia','item','motivo','veiculo','litros','valor','km'];
  var rows=[cols],ids={};
  function mot(id){var c=colab(id);return c?c.nome:id||'';}
  if(o.ent){
    dados.entregas.forEach(function(e){
      if(!o.abertos&&(e.status==='separado'||e.status==='em_rota'))return;
      ids[e.id]=1;
      rows.push([ehColeta(e)?'coleta':'entrega',e.id,e.dia,opDe(e),e.cliente,e.endereco,mot(e.motoristaId),stL(e),e.prazo,e.criadoEm,e.saidaEm,e.concluidoEm,e.retornoEm,
        (e.itens||[]).map(function(i){return i.codigo+' x'+i.qtd+(i.qtdEntregue!==i.qtd?' (conf. '+i.qtdEntregue+')':'');}).join(' | '),e.recebedor,e.obs,'','','','','','','']);
    });
    dados.ocorrencias.forEach(function(x){
      if(!ids[x.entregaId])return;
      rows.push(['ocorrencia',x.id,x.dia,'','','',mot(x.motoristaId),'','','','','','','','','',TIPOS_OC[x.tipo]||x.tipo,x.codigo,x.motivo,'','','','']);
    });
  }
  if(o.ab){
    dados.abastecimentos.forEach(function(a){
      var v=(typeof veic==='function')?veic(a.veiculoId):null;
      rows.push(['abastecimento',a.id,dayKey(a.em),'','','',mot(a.motoristaId),'','',a.em,'','','','','',a.obs||'','','','',v?v.placa:a.veiculoId,a.litros,a.valor,a.km]);
    });
  }
  return '﻿'+rows.map(function(r){return r.map(csvCel).join(';');}).join('\r\n');
}
function baixarArquivo(nome,texto){
  var url=URL.createObjectURL(new Blob([texto],{type:'text/csv;charset=utf-8'}));
  var a=document.createElement('a');a.href=url;a.download=nome;document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove();URL.revokeObjectURL(url);},1500);
}
function nomeBackup(){var l=UI.l;return 'backup-historico_'+(l.de==='2000-01-01'?'inicio':l.de)+'_a_'+l.ate+'.csv';}

/* ---------- cliques ---------- */
function limparAcao(a,t,id){
  if(!(SESSION&&SESSION.dev))return false;
  var l=UI.l;
  if(calAcao(l,'l',a,id,function(per,mes){l.info=null;l.msg='';l.erro='';l.dados=null;limpaCal();if(mes)limpaContagem();limpaRes();},null))return true;
  switch(a){
    case 'l-conferir':{
      if(!(l.ent||l.ab||l.gps)){l.erro='Escolha ao menos uma coisa para apagar.';limpaRes();return true;}
      var n=++LSEQ;l.erro='';l.msg='';l.info=null;l.ocupado=true;limpaRes();
      var o=limpaOpcoes();
      Promise.all([Dados.devContarLimpeza(l.de,l.ate,o),Dados.historico(l.de,l.ate)]).then(function(r){
        if(n!==LSEQ)return;
        l.dados=r[1];
        var info=r[0]||{};info.arquivos=(o.fotos?Dados.caminhosArquivos(r[1],o).length:0);
        l.info=info;l.ocupado=false;limpaRes();
      }).catch(function(e){if(n!==LSEQ)return;l.ocupado=false;l.erro='Não foi possível conferir: '+msgErro(e);limpaRes();});
      return true;}
    case 'l-backup':
      if(!l.dados)return true;
      baixarArquivo(nomeBackup(),csvBackup(l.dados,limpaOpcoes()));toast('Backup baixado');return true;
    case 'l-apagar':{
      var c=$('#l-conf');
      if(l.ocupado||!l.info||!c||c.value.trim()!=='APAGAR')return true;
      var o2=limpaOpcoes(),de=l.de,ate=l.ate,dados=l.dados;
      l.ocupado=true;l.erro='';t.disabled=true;
      var passos=Promise.resolve();
      if(l.bkp)passos=passos.then(function(){baixarArquivo(nomeBackup(),csvBackup(dados,o2));});
      var paths=o2.fotos?Dados.caminhosArquivos(dados,o2):[];
      passos.then(function(){return Dados.devLimpar(de,ate,o2);}).then(function(r){
        return (paths.length?Dados.devApagarArquivos(paths):Promise.resolve(null)).then(function(f){
          var txt='Histórico apagado: '+(r.entregas||0)+' entregas/coletas, '+(r.ocorrencias||0)+' ocorrências, '+(r.abastecimentos||0)+' abastecimentos, '+(r.posicoes||0)+' posições de GPS.';
          if(f)txt+=' Arquivos removidos: '+f.ok+(f.falhou?' ('+f.falhou+' não puderam ser removidos)':'')+'.';
          l.msg=txt+(l.bkp?' O backup foi baixado.':'');
        });
      }).then(function(){l.info=null;l.dados=null;l.ocupado=false;l.cont={};return Dados.carregar().catch(function(){});}).then(function(){renderApp();})
      .catch(function(e){l.ocupado=false;l.erro='Não foi possível apagar: '+msgErro(e);limpaRes();});
      return true;}
  }
  return false;
}
