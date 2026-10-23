'use strict';
/* Histórico: baixar o período filtrado em Excel (.xlsx) ou PDF.
   O .xlsx é montado aqui mesmo (sem bibliotecas): um arquivo zip com as planilhas Resumo, Entregas, Ocorrências e Abastecimentos.
   O PDF usa a impressão do celular/computador ("Salvar como PDF"). */

/* ---------- zip simples (sem compressão) ---------- */
var CRC_T=null;
function crc32(b){
  if(!CRC_T){CRC_T=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;CRC_T[n]=c>>>0;}}
  var x=0xFFFFFFFF;for(var i=0;i<b.length;i++)x=CRC_T[(x^b[i])&0xFF]^(x>>>8);return (x^0xFFFFFFFF)>>>0;
}
function zipSimples(arqs){
  var enc=new TextEncoder(),partes=[],central=[],pos=0;
  function u16(v){return [v&255,(v>>8)&255];}
  function u32(v){return [v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];}
  function cat(){var l=[];for(var i=0;i<arguments.length;i++){var p=arguments[i];for(var j=0;j<p.length;j++)l.push(p[j]);}return new Uint8Array(l);}
  arqs.forEach(function(f){
    var nome=enc.encode(f.nome),dados=enc.encode(f.texto),crc=crc32(dados);
    var loc=cat(u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0x21),u32(crc),u32(dados.length),u32(dados.length),u16(nome.length),u16(0),nome);
    partes.push(loc,dados);
    central.push(cat(u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0x21),u32(crc),u32(dados.length),u32(dados.length),u16(nome.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(pos),nome));
    pos+=loc.length+dados.length;
  });
  var tamC=0;central.forEach(function(c){tamC+=c.length;});
  var fim=cat(u32(0x06054b50),u16(0),u16(0),u16(arqs.length),u16(arqs.length),u32(tamC),u32(pos),u16(0));
  return new Blob(partes.concat(central,[fim]),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
/* ---------- xlsx ---------- */
function xe(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');}
function colL(i){var s='';i++;while(i>0){var m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;}
/* célula: valor simples, ou {v:valor,b:true} para negrito. Números ficam como números. */
function planilhaXml(rows,larg){
  var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
  if(larg&&larg.length)x+='<cols>'+larg.map(function(w,i){return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>';}).join('')+'</cols>';
  x+='<sheetData>';
  rows.forEach(function(r,ri){
    x+='<row r="'+(ri+1)+'">';
    r.forEach(function(c,ci){
      var v=c,b=false;if(c&&typeof c==='object'){v=c.v;b=!!c.b;}
      if(v===null||v===undefined||v==='')return;
      var ref=colL(ci)+(ri+1),s=b?' s="1"':'';
      if(typeof v==='number'&&isFinite(v))x+='<c r="'+ref+'"'+s+'><v>'+v+'</v></c>';
      else x+='<c r="'+ref+'"'+s+' t="inlineStr"><is><t xml:space="preserve">'+xe(v)+'</t></is></c>';
    });
    x+='</row>';
  });
  return x+'</sheetData></worksheet>';
}
function xlsxBlob(folhas){
  var f=[],n=folhas.length,i;
  f.push({nome:'[Content_Types].xml',texto:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+folhas.map(function(_,k){return '<Override PartName="/xl/worksheets/sheet'+(k+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';}).join('')+'</Types>'});
  f.push({nome:'_rels/.rels',texto:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});
  f.push({nome:'xl/workbook.xml',texto:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+folhas.map(function(s,k){return '<sheet name="'+xe(s.nome)+'" sheetId="'+(k+1)+'" r:id="rId'+(k+1)+'"/>';}).join('')+'</sheets></workbook>'});
  var rel='';for(i=0;i<n;i++)rel+='<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>';
  rel+='<Relationship Id="rId'+(n+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
  f.push({nome:'xl/_rels/workbook.xml.rels',texto:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rel+'</Relationships>'});
  f.push({nome:'xl/styles.xml',texto:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE9F7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'});
  folhas.forEach(function(s,k){f.push({nome:'xl/worksheets/sheet'+(k+1)+'.xml',texto:planilhaXml(s.rows,s.larg)});});
  return zipSimples(f);
}

/* ---------- dados do relatório ---------- */
function xDT(iso){if(!iso)return '';var d=new Date(iso);if(isNaN(d))return '';return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes());}
function xD(k){return k?fmtDia(k):'';}
function nomeMot(id){var c=colab(id);return c?c.nome:(id||'');}
function relatorio(){
  var h=UI.h,f=histFiltrar(),ent=f.ent.slice().sort(function(a,b){return (a.dia+(a.saidaEm||a.criadoEm||'')).localeCompare(b.dia+(b.saidaEm||b.criadoEm||''))||a.id-b.id;});
  var s=calc(ent),nCol=ent.filter(ehColeta).length;
  var filtros=[];
  filtros.push('Tipo: '+(h.op==='coleta'?'só coletas':h.op==='entrega'?'só entregas':'entregas e coletas'));
  filtros.push('Motorista: '+(h.mot?nomeMot(h.mot):'todos'));
  filtros.push('Vínculo: '+(h.vin?h.vin.toLowerCase()+'s':'efetivados e terceirizados'));
  var resumo=[['Pedidos',s.total],['Entregas',ent.length-nCol],['Coletas',nCol],['Concluídos',s.concl],['No prazo',fmtPct(s.noPrazoPct)],['Rota média',fmtDur(s.rota)],['Atrasados',s.atras],['Devolvidos',s.dev],['Defeito/avaria/falta',s.prob],['Enviados errados',s.err]];
  var porMot={};ent.forEach(function(e){(porMot[e.motoristaId]=porMot[e.motoristaId]||[]).push(e);});
  var mot=Object.keys(porMot).map(function(id){var l=porMot[id],c=colab(id),q=calc(l),cc=l.filter(ehColeta).length;
    return {nome:nomeMot(id),vinculo:c?c.tipo:'',empresa:c?c.empresa||'':'',ent:l.length-cc,col:cc,concl:q.concl,prazo:fmtPct(q.noPrazoPct),rota:fmtDur(q.rota),atras:q.atras,dev:q.dev};
  }).sort(function(a,b){return b.concl-a.concl;});
  var ents=ent.map(function(e){var c=colab(e.motoristaId);
    return [e.id,opDe(e)==='coleta'?'Coleta':'Entrega',xD(e.dia),e.cliente,e.endereco||'',nomeMot(e.motoristaId),c?c.tipo:'',c?c.empresa||'':'',stL(e),xDT(e.prazo),xDT(e.saidaEm),xDT(e.concluidoEm),xDT(e.retornoEm),
      (e.saidaEm&&e.concluidoEm)?Math.round(mins(e.saidaEm,e.concluidoEm)):'',
      (e.itens||[]).map(function(i){return i.codigo+' x'+i.qtd+(i.qtdEntregue!==i.qtd?' (conf. '+i.qtdEntregue+')':'');}).join(' | '),e.recebedor||'',e.obs||''];});
  var ids={};ent.forEach(function(e){ids[e.id]=1;});
  var ocs=f.oc.slice().sort(function(a,b){return (a.em||a.dia||'').localeCompare(b.em||b.dia||'');}).map(function(o){
    return [xD(o.dia),o.entregaId||'',(typeof TIPOS_OC!=='undefined'&&TIPOS_OC[o.tipo])||o.tipo||'',o.codigo||'',o.motivo||'',nomeMot(o.motoristaId)];});
  var abs=f.ab.slice().sort(function(a,b){return String(a.em).localeCompare(String(b.em));}).map(function(a){var v=(typeof veic==='function')?veic(a.veiculoId):null;
    return [xDT(a.em),nomeMot(a.motoristaId),v?v.placa:a.veiculoId,a.km,a.litros,a.valor,a.cheio?'Sim':'Não',a.obs||''];});
  return {de:h.de,ate:h.ate,filtros:filtros,resumo:resumo,mot:mot,ents:ents,ocs:ocs,abs:abs};
}
var CAB_ENT=['Nº','Tipo','Dia','Cliente','Endereço','Motorista','Vínculo','Empresa','Situação','Prazo','Saída','Conclusão','Retorno','Rota (min)','Itens','Quem recebeu','Observações'];
var CAB_OC=['Dia','Pedido','Tipo','Código','Motivo','Motorista'];
var CAB_AB=['Data e hora','Motorista','Veículo','Km','Litros','Valor (R$)','Tanque cheio','Observação'];
function bold(l){return l.map(function(t){return {v:t,b:true};});}
function xlsxDoRelatorio(r){
  var res=[[{v:'ArcosRotas · Relatório de entregas e coletas',b:true}],['Período',fmtDia(r.de)+' a '+fmtDia(r.ate)],['Filtros',r.filtros.join(' · ')],['Gerado em',xDT(new Date().toISOString())],[],bold(['Indicador','Valor'])]
    .concat(r.resumo,[[],bold(['Motorista','Vínculo','Empresa','Entregas','Coletas','Concluídos','No prazo','Rota média','Atrasados','Devolvidos'])],
      r.mot.map(function(m){return [m.nome,m.vinculo,m.empresa,m.ent,m.col,m.concl,m.prazo,m.rota,m.atras,m.dev];}));
  return xlsxBlob([
    {nome:'Resumo',rows:res,larg:[26,22,22,10,10,12,10,12,10,11]},
    {nome:'Entregas e coletas',rows:[bold(CAB_ENT)].concat(r.ents),larg:[8,9,11,26,34,22,13,18,20,17,17,17,17,10,40,20,30]},
    {nome:'Ocorrências',rows:[bold(CAB_OC)].concat(r.ocs),larg:[11,9,22,12,40,22]},
    {nome:'Abastecimentos',rows:[bold(CAB_AB)].concat(r.abs),larg:[17,22,11,9,9,11,12,30]}
  ]);
}
function baixarBlob(nome,blob){
  var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=nome;document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove();URL.revokeObjectURL(url);},1500);
}
function nomeRel(ext){var h=UI.h;return 'arcorota-relatorio_'+h.de+(h.de===h.ate?'':'_a_'+h.ate)+'.'+ext;}

/* ---------- PDF (impressão) ---------- */
function pdfHtml(r){
  function tb(cab,linhas,vazio){return '<table><thead><tr>'+cab.map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'</tr></thead><tbody>'+(linhas.length?linhas.map(function(l){return '<tr>'+l.map(function(c){return '<td>'+esc(c==null?'':c)+'</td>';}).join('')+'</tr>';}).join(''):'<tr><td colspan="'+cab.length+'" class="v">'+vazio+'</td></tr>')+'</tbody></table>';}
  var logo=''; try{logo=new URL('marca/logo.png',location.href).href;}catch(e){}
  var entsCurto=r.ents.map(function(l){return [l[0],l[1],l[2],l[3],l[5],l[8],l[9]&&l[9].slice(11),l[10]&&l[10].slice(11),l[11]&&l[11].slice(11),l[13]];});
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+esc(nomeRel('pdf').replace('.pdf',''))+'</title><style>'+
    '@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:11px/1.35 Arial,Helvetica,sans-serif;color:#111;margin:0}'+
    'header{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0B6BB8;padding-bottom:8px;margin-bottom:10px}header img{height:46px}'+
    'h1{font-size:18px;margin:0}h2{font-size:13px;margin:16px 0 6px;color:#0B6BB8}.sub{color:#444}'+
    '.kpis{display:flex;flex-wrap:wrap;gap:8px}.k{border:1px solid #bbb;border-radius:6px;padding:6px 10px;min-width:110px}.k b{display:block;font-size:16px}.k span{color:#555;font-size:10px}'+
    'table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #ccc;padding:3px 5px;text-align:left;vertical-align:top}th{background:#E4EEF8}tr{page-break-inside:avoid}.v{text-align:center;color:#777}'+
    'footer{margin-top:14px;color:#666;font-size:10px}</style></head><body>'+
    '<header>'+(logo?'<img src="'+esc(logo)+'" alt="">':'')+'<div><h1>ArcosRotas · Relatório de entregas e coletas</h1><div class="sub">Período: <b>'+fmtDia(r.de)+' a '+fmtDia(r.ate)+'</b> · '+esc(r.filtros.join(' · '))+'</div><div class="sub">Gerado em '+xDT(new Date().toISOString())+'</div></div></header>'+
    '<div class="kpis">'+r.resumo.map(function(x){return '<div class="k"><b>'+esc(x[1])+'</b><span>'+esc(x[0])+'</span></div>';}).join('')+'</div>'+
    '<h2>Desempenho por motorista</h2>'+tb(['Motorista','Vínculo','Entregas','Coletas','Concluídos','No prazo','Rota média','Atrasados','Devolvidos'],r.mot.map(function(m){return [m.nome,m.vinculo+(m.empresa?' · '+m.empresa:''),m.ent,m.col,m.concl,m.prazo,m.rota,m.atras,m.dev];}),'Sem pedidos no período')+
    '<h2>Entregas e coletas ('+r.ents.length+')</h2>'+tb(['Nº','Tipo','Dia','Cliente','Motorista','Situação','Prazo','Saída','Conclusão','Rota (min)'],entsCurto,'Sem pedidos no período')+
    (r.ocs.length?'<h2>Ocorrências ('+r.ocs.length+')</h2>'+tb(CAB_OC,r.ocs,''):'')+
    (r.abs.length?'<h2>Abastecimentos ('+r.abs.length+')</h2>'+tb(CAB_AB,r.abs,''):'')+
    '<footer>ArcosRotas · Desenvolvido por Arcos Jobim · Automação &amp; Software</footer></body></html>';
}
function imprimirRelatorio(r){
  var fr=document.createElement('iframe');fr.setAttribute('aria-hidden','true');fr.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(fr);
  var doc=fr.contentWindow.document;doc.open();doc.write(pdfHtml(r));doc.close();
  setTimeout(function(){try{fr.contentWindow.focus();fr.contentWindow.print();}catch(e){toast('Não foi possível abrir a impressão neste aparelho.');}setTimeout(function(){fr.remove();},60000);},500);
}
function exportarAcao(a){
  if(a!=='h-xlsx'&&a!=='h-pdf')return false;
  var h=UI.h;
  if(!h||!h.dados||h.carregando){toast('Aguarde o histórico carregar.');return true;}
  var r=relatorio();
  if(a==='h-xlsx'){baixarBlob(nomeRel('xlsx'),xlsxDoRelatorio(r));toast('Planilha baixada');}
  else{imprimirRelatorio(r);toast('Na janela de impressão, escolha "Salvar como PDF".');}
  return true;
}
