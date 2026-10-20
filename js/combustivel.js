'use strict';
/* ============ combustível: veículos e abastecimentos ============
   O motorista registra cada abastecimento (km do painel, litros, valor e fotos).
   O sistema calcula km/L e custo por km entre dois abastecimentos de "tanque cheio"
   do mesmo veículo, e avisa o administrador quando algo foge do normal. */
var TIPOS_VEI={moto:'Moto',caminhao:'Caminhão',carro:'Carro'};
var COMBUSTIVEIS=['Gasolina','Etanol','Flex','Diesel'];
var ALERTA_PCT=0.8;     /* alerta quando o km/L fica abaixo de 80% da meta (20% pior) */
var ALERTA_HORAS=6;     /* alerta quando há dois abastecimentos do mesmo veículo em menos de 6 h */

/* ---------- ajudantes ---------- */
function veic(id){return DB.veiculos.find(function(v){return v.id===id;});}
function novoIdAb(){return Date.now()*1000+Math.floor(Math.random()*1000);}
function fmtN(v,d){return (v==null||isNaN(v))?'—':Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});}
function fmtRs(v){return (v==null||isNaN(v))?'—':'R$ '+fmtN(v,2);}
function numIn(s){var n=parseFloat(String(s==null?'':s).replace(',','.'));return isNaN(n)?null:n;}
function nomeVeic(v){return v?v.placa+' · '+(v.modelo||TIPOS_VEI[v.tipo]):'—';}
function periodoAb(a,p){
  if(p==='todos')return true;
  if(p==='hoje')return dayKey(a.em)===todayKey();
  return dayKey(a.em)>=dayKey(Date.now()-(p==='30d'?29:6)*86400000);
}

/* ---------- cálculo de consumo ---------- */
function abastsDe(vid){
  return DB.abastecimentos.filter(function(a){return a.veiculoId===vid;}).sort(function(a,b){return a.km-b.km||a.em.localeCompare(b.em);});
}
/* km/L só existe entre dois abastecimentos de tanque cheio. Abastecimentos parciais no meio
   entram na soma dos litros. O primeiro registro de cada veículo só serve de ponto de partida. */
function consumoDe(lista){
  var base=null,litros=0,valor=0,trechos=[],porAb={};
  lista.forEach(function(a){
    if(base){litros+=a.litros;valor+=a.valor;}
    if(a.cheio){
      if(base&&a.km>base.km&&litros>0){
        var t={ab:a,km:a.km-base.km,litros:litros,valor:valor,kml:(a.km-base.km)/litros};
        trechos.push(t);porAb[a.id]=t;
      }
      base=a;litros=0;valor=0;
    }
  });
  var km=sum(trechos.map(function(t){return t.km;})),li=sum(trechos.map(function(t){return t.litros;})),va=sum(trechos.map(function(t){return t.valor;}));
  return {abast:lista,trechos:trechos,porAb:porAb,km:km,litros:li,valor:va,
    kml:li?km/li:null,custoKm:km?va/km:null,
    ultimoKml:trechos.length?trechos[trechos.length-1].kml:null,
    ultimoKm:lista.length?lista[lista.length-1].km:null};
}
function consumoVeic(v){return consumoDe(abastsDe(v.id));}
function alertasAb(a,v,cons){
  var out=[],t=cons.porAb[a.id];
  if(v&&t&&v.metaKml&&t.kml<v.metaKml*ALERTA_PCT)out.push('Consumo de '+fmtN(t.kml,1)+' km/L, abaixo de '+Math.round(ALERTA_PCT*100)+'% da meta ('+fmtN(v.metaKml,1)+' km/L)');
  if(v&&v.capacidade&&a.litros>v.capacidade*1.02)out.push('Litros ('+fmtN(a.litros,1)+') acima da capacidade do tanque ('+fmtN(v.capacidade,1)+' L)');
  var ant=cons.abast.filter(function(x){return x.id!==a.id&&x.em<a.em;}).sort(function(x,y){return y.em.localeCompare(x.em);})[0];
  if(ant&&(new Date(a.em)-new Date(ant.em))<ALERTA_HORAS*3600000)out.push('Segundo abastecimento do mesmo veículo em menos de '+ALERTA_HORAS+' h');
  return out;
}
/* alertas de todos os abastecimentos de um período: [{a,v,msgs}] */
function alertasPeriodo(p){
  var res=[];
  DB.veiculos.forEach(function(v){
    var c=consumoVeic(v);
    c.abast.forEach(function(a){if(!periodoAb(a,p))return;var m=alertasAb(a,v,c);if(m.length)res.push({a:a,v:v,msgs:m});});
  });
  return res;
}
function corKml(kml,meta){
  if(kml==null||!meta)return '';
  return kml>=meta*0.95?'p-good':kml>=meta*ALERTA_PCT?'p-warn':'p-bad';
}
function pillKml(kml,meta){return kml==null?'<span class="muted">—</span>':'<span class="pill '+corKml(kml,meta)+'"><i></i>'+fmtN(kml,1)+' km/L</span>';}

/* foto/nota com link temporário (bucket privado) */
function evFoto(v,rot){
  v=v?Dados.urlEvid(v):v;
  if(v&&String(v).indexOf('data:')===0)return '<img class="ev" alt="'+rot+'" src="'+v+'">';
  if(v&&/^https:\/\//.test(String(v)))return '<a href="'+esc(v)+'" target="_blank" rel="noopener"><img class="ev" alt="'+rot+'" src="'+esc(v)+'"></a>';
  if(v==='exemplo')return '<div class="ph">'+rot+' registrada (exemplo)</div>';
  return '<div class="ph">Sem '+rot.toLowerCase()+'</div>';
}

/* ============ admin: veículos ============ */
function viewVeiculos(){
  var al=alertasPeriodo('30d');
  var ult30=DB.abastecimentos.filter(function(a){return periodoAb(a,'30d');});
  return '<div class="page-h"><div><h1>Veículos</h1><p>'+DB.veiculos.length+' cadastrados · consumo calculado entre abastecimentos de tanque cheio.</p></div><button class="btn btn-primary" data-act="vei-new">Novo veículo</button></div>'+
  '<div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:14px">'+
    kpi('Gasto em 30 dias',fmtRs(sum(ult30.map(function(a){return a.valor;}))),'combustível','acc')+
    kpi('Litros em 30 dias',fmtN(sum(ult30.map(function(a){return a.litros;})),0),'todos os veículos','')+
    kpi('Abastecimentos',String(ult30.length),'últimos 30 dias','')+
    kpi('Alertas',String(al.length),'últimos 30 dias',al.length?'warn':'good')+'</div>'+
  '<div class="filters"><input type="search" aria-label="Buscar" data-bind="vei.q" placeholder="Buscar placa ou modelo" value="'+esc(UI.vei.q)+'"><select aria-label="Tipo" data-bind="vei.tipo">'+opts([['','Todos os tipos'],['moto','Motos'],['caminhao','Caminhões'],['carro','Carros']],UI.vei.tipo)+'</select></div>'+
  '<section class="panel" id="lista"></section>';
}
function fillVeiculos(){
  var q=UI.vei.q.trim().toLowerCase(),t=UI.vei.tipo,el=$('#lista');if(!el)return;
  var rows=DB.veiculos.filter(function(v){return (!t||v.tipo===t)&&(!q||(v.placa+' '+v.modelo).toLowerCase().indexOf(q)>=0);});
  var al30=alertasPeriodo('30d');
  el.innerHTML='<div class="scroll"><table class="tbl" style="min-width:860px"><thead><tr><th>Veículo</th><th>Tipo</th><th>Combustível</th><th class="r">Meta</th><th>km/L médio</th><th class="r">Custo/km</th><th class="r">Último km</th><th class="r">Alertas 30d</th><th>Situação</th><th></th></tr></thead><tbody>'+
  (rows.length?rows.map(function(v){
    var c=consumoVeic(v),na=al30.filter(function(x){return x.v.id===v.id;}).length;
    return '<tr><td><b class="mono">'+esc(v.placa)+'</b><span class="sub">'+esc(v.modelo||'')+'</span></td><td>'+TIPOS_VEI[v.tipo]+'</td><td>'+esc(v.combustivel||'—')+'</td><td class="r num">'+(v.metaKml?fmtN(v.metaKml,1):'—')+'</td><td>'+pillKml(c.kml,v.metaKml)+(c.trechos.length?'<span class="sub">'+c.trechos.length+(c.trechos.length===1?' trecho':' trechos')+'</span>':'')+'</td><td class="r num">'+(c.custoKm==null?'—':fmtRs(c.custoKm))+'</td><td class="r num">'+(c.ultimoKm==null?fmtN(v.kmInicial,0):fmtN(c.ultimoKm,0))+'</td><td class="r num">'+(na?'<span class="late">'+na+'</span>':'0')+'</td><td>'+(v.ativo===false?'<span class="pill p-neutral"><i></i>Inativo</span>':'<span class="pill p-good"><i></i>Ativo</span>')+'</td><td><button class="btn btn-sm" data-act="vei-edit" data-id="'+v.id+'">Editar</button></td></tr>';
  }).join(''):'<tr><td colspan="10" class="empty">Nenhum veículo cadastrado.</td></tr>')+'</tbody></table></div>';
}
function openVeicForm(id){
  var v=id?veic(id):{placa:'',tipo:'carro',modelo:'',combustivel:'Flex',capacidade:null,kmInicial:0,metaKml:null,ativo:true};
  openModal(mh(id?'Editar veículo':'Novo veículo')+
  '<form id="f-vei" class="dlg-b" data-id="'+(id||'')+'"><div class="form-grid">'+
  '<div class="field"><label for="vf-p">Placa</label><input id="vf-p" name="placa" required autofocus autocapitalize="characters" value="'+esc(v.placa)+'"></div>'+
  '<div class="field"><label for="vf-t">Tipo</label><select id="vf-t" name="tipo">'+opts([['moto','Moto'],['caminhao','Caminhão'],['carro','Carro de passeio']],v.tipo)+'</select></div>'+
  '<div class="field"><label for="vf-m">Modelo</label><input id="vf-m" name="modelo" value="'+esc(v.modelo)+'"></div>'+
  '<div class="field"><label for="vf-c">Combustível</label><select id="vf-c" name="combustivel">'+opts(COMBUSTIVEIS.map(function(x){return [x,x];}),v.combustivel)+'</select></div>'+
  '<div class="field"><label for="vf-k">Km atual do painel</label><input id="vf-k" name="kmInicial" type="number" min="0" step="0.1" inputmode="decimal" required value="'+(v.kmInicial==null?'':v.kmInicial)+'"></div>'+
  '<div class="field"><label for="vf-meta">Meta de consumo (km/L)</label><input id="vf-meta" name="metaKml" type="number" min="0" step="0.1" inputmode="decimal" value="'+(v.metaKml==null?'':v.metaKml)+'"></div>'+
  '<div class="field"><label for="vf-cap">Capacidade do tanque (litros)</label><input id="vf-cap" name="capacidade" type="number" min="0" step="0.1" inputmode="decimal" value="'+(v.capacidade==null?'':v.capacidade)+'"></div>'+
  '<div class="field"><label for="vf-a">Situação</label><select id="vf-a" name="ativo">'+opts([['1','Ativo'],['0','Inativo']],v.ativo===false?'0':'1')+'</select></div></div>'+
  '<p class="note">A meta e a capacidade são opcionais, mas sem elas o sistema não consegue gerar os alertas de consumo e de litros.</p>'+
  '<div class="err" id="vf-err" role="alert"></div><div class="dlg-f"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn btn-primary" type="submit">Salvar</button></div></form>');
}
function saveVeic(form){
  var id=form.dataset.id?+form.dataset.id:null,err=$('#vf-err');
  var placa=fv(form,'placa').trim().toUpperCase().replace(/\s+/g,'');
  if(!placa){err.textContent='Informe a placa.';return;}
  if(DB.veiculos.some(function(v){return v.id!==id&&v.placa===placa;})){err.textContent='Já existe um veículo com esta placa.';return;}
  var km=numIn(fv(form,'kmInicial'));
  if(km==null||km<0){err.textContent='Informe o km atual do painel.';return;}
  var d={placa:placa,tipo:fv(form,'tipo'),modelo:fv(form,'modelo').trim(),combustivel:fv(form,'combustivel'),kmInicial:km,metaKml:numIn(fv(form,'metaKml')),capacidade:numIn(fv(form,'capacidade')),ativo:fv(form,'ativo')==='1'};
  if(id){Object.assign(veic(id),d);}
  else{d.id=(DB.seq.vei=(DB.seq.vei||0)+1);DB.veiculos.push(d);}
  save();closeModal();renderApp();toast('Veículo salvo');
}

/* ============ admin: abastecimentos ============ */
function viewAbastecimentos(){
  var f=UI.ab;
  return '<div class="page-h"><div><h1>Abastecimentos</h1><p>Registros feitos pelos motoristas, com km, litros, valor e fotos.</p></div></div>'+
  '<div class="filters"><select aria-label="Veículo" data-bind="ab.vei">'+opts([['','Todos os veículos']].concat(DB.veiculos.map(function(v){return [v.id,nomeVeic(v)];})),f.vei)+'</select>'+
  '<select aria-label="Motorista" data-bind="ab.mot">'+opts([['','Todos os motoristas']].concat(DB.colaboradores.map(function(c){return [c.id,c.nome];})),f.mot)+'</select>'+
  '<select aria-label="Período" data-bind="ab.dia">'+opts([['hoje','Hoje'],['7d','7 dias'],['30d','30 dias'],['todos','Todos']],f.dia)+'</select>'+
  '<select aria-label="Situação" data-bind="ab.alerta">'+opts([['','Todos'],['1','Só com alerta']],f.alerta)+'</select></div>'+
  '<section class="panel" id="lista"></section>';
}
function fillAbastecimentos(){
  var f=UI.ab,el=$('#lista');if(!el)return;
  var cons={};DB.veiculos.forEach(function(v){cons[v.id]=consumoVeic(v);});
  var rows=DB.abastecimentos.filter(function(a){
    if(!periodoAb(a,f.dia))return false;
    if(f.vei&&String(a.veiculoId)!==String(f.vei))return false;
    if(f.mot&&a.motoristaId!==f.mot)return false;
    return true;
  }).map(function(a){var v=veic(a.veiculoId),c=cons[a.veiculoId];return {a:a,v:v,c:c,msgs:(v&&c)?alertasAb(a,v,c):[]};})
    .filter(function(r){return !f.alerta||r.msgs.length;})
    .sort(function(x,y){return y.a.em.localeCompare(x.a.em);});
  el.innerHTML=rows.length?'<div class="scroll"><table class="tbl" style="min-width:900px"><thead><tr><th>Quando</th><th>Veículo</th><th>Motorista</th><th class="r">Km</th><th class="r">Litros</th><th class="r">Valor</th><th class="r">R$/L</th><th>km/L</th><th>Situação</th></tr></thead><tbody>'+
  rows.slice(0,150).map(function(r){
    var a=r.a,t=r.c&&r.c.porAb[a.id],m=colab(a.motoristaId);
    return '<tr data-act="ab-open" data-id="'+a.id+'"><td class="mono">'+ddmm(a.em)+' '+hhmm(a.em)+'</td><td><b class="mono">'+esc(r.v?r.v.placa:'—')+'</b><span class="sub">'+esc(r.v?r.v.modelo:'')+'</span></td><td>'+(m?esc(m.nome):'—')+'</td><td class="r num">'+fmtN(a.km,0)+'</td><td class="r num">'+fmtN(a.litros,1)+(a.cheio?'':'<span class="sub">parcial</span>')+'</td><td class="r num">'+fmtRs(a.valor)+'</td><td class="r num">'+fmtN(a.valor/a.litros,2)+'</td><td>'+(t?pillKml(t.kml,r.v&&r.v.metaKml):'<span class="muted">—</span>')+'</td><td>'+(r.msgs.length?'<span class="pill p-warn"><i></i>'+r.msgs.length+(r.msgs.length===1?' alerta':' alertas')+'</span>':'<span class="pill p-good"><i></i>Normal</span>')+'</td></tr>';
  }).join('')+'</tbody></table></div>'+(rows.length>150?'<p class="note" style="padding:8px 16px">Mostrando 150 de '+rows.length+'. Refine os filtros.</p>':''):'<div class="empty">Nenhum abastecimento no período.</div>';
}
function openAbastecimento(id){
  var a0=DB.abastecimentos.find(function(x){return x.id===id;});if(!a0)return;
  Dados.assinar([a0.fotoOdometro,a0.fotoNota]).then(function(){openAbastecimentoView(id);});
}
function openAbastecimentoView(id){
  var a=DB.abastecimentos.find(function(x){return x.id===id;});if(!a)return;
  var v=veic(a.veiculoId),m=colab(a.motoristaId),c=v?consumoVeic(v):null,t=c&&c.porAb[a.id],msgs=(v&&c)?alertasAb(a,v,c):[];
  openModal(mh(esc(nomeVeic(v)),ddmm(a.em)+' às '+hhmm(a.em)+(a.cheio?' · tanque cheio':' · abastecimento parcial'))+
  '<div class="dlg-b"><div class="kv"><div><span>Motorista</span>'+(m?esc(m.nome):'—')+'</div><div><span>Km do painel</span>'+fmtN(a.km,0)+'</div><div><span>Litros</span>'+fmtN(a.litros,2)+'</div><div><span>Valor</span>'+fmtRs(a.valor)+'</div><div><span>Preço por litro</span>'+fmtRs(a.valor/a.litros)+'</div><div><span>Posto</span>'+esc(a.posto||'—')+'</div></div>'+
  (t?'<p>Desde o abastecimento anterior de tanque cheio: <b>'+fmtN(t.km,0)+' km</b> com <b>'+fmtN(t.litros,1)+' L</b> · '+pillKml(t.kml,v&&v.metaKml)+' · custo de <b>'+fmtRs(t.valor/t.km)+'</b> por km.</p>':'<p class="note">O consumo deste abastecimento aparece quando houver o próximo de tanque cheio.</p>')+
  (msgs.length?'<div><div class="lbl">Alertas</div>'+msgs.map(function(x){return '<p><span class="pill p-warn"><i></i>'+esc(x)+'</span></p>';}).join('')+'</div>':'')+
  '<div class="evs"><div><div class="lbl" style="margin-bottom:6px">Foto do odômetro</div>'+evFoto(a.fotoOdometro,'Foto do odômetro')+'</div><div><div class="lbl" style="margin-bottom:6px">Foto da nota ou da bomba</div>'+evFoto(a.fotoNota,'Foto da nota')+'</div></div>'+
  (a.obs?'<div><div class="lbl">Observações</div><p>'+esc(a.obs)+'</p></div>':'')+'</div>');
}

/* ============ motorista: abastecimento ============ */
function ultimoKmDe(v){
  var meus=DB.abastecimentos.filter(function(a){return a.veiculoId===v.id;}).map(function(a){return a.km;});
  return Math.max(v.kmInicial||0,v.ultimoKm||0,meus.length?Math.max.apply(null,meus):0);
}
function abastCard(c){
  var meus=DB.abastecimentos.filter(function(a){return a.motoristaId===c.id;}).sort(function(a,b){return b.em.localeCompare(a.em);}).slice(0,3);
  return '<section class="dcard"><div class="row" style="justify-content:space-between"><b>Combustível</b></div>'+
  '<button class="btn btn-lg" data-act="abast-novo"'+(DB.veiculos.some(function(v){return v.ativo!==false;})?'':' disabled')+'>Registrar abastecimento</button>'+
  (DB.veiculos.some(function(v){return v.ativo!==false;})?'':'<span class="note">Nenhum veículo cadastrado ainda. Peça à administração.</span>')+
  (meus.length?'<div class="itl">'+meus.map(function(a){var v=veic(a.veiculoId);return '<div><span class="mono">'+ddmm(a.em)+'</span><span>'+esc(v?v.placa:'—')+' · '+fmtN(a.litros,1)+' L</span><b style="margin-left:auto">'+fmtRs(a.valor)+'</b></div>';}).join('')+'</div>':'')+'</section>';
}
function viewAbast(c){
  UI.fotoOd=null;UI.fotoNt=null;
  var ativos=DB.veiculos.filter(function(v){return v.ativo!==false;});
  function grp(t){var l=ativos.filter(function(v){return v.tipo===t;});return l.length?'<optgroup label="'+TIPOS_VEI[t]+'s">'+l.map(function(v){return '<option value="'+v.id+'">'+esc(nomeVeic(v))+'</option>';}).join('')+'</optgroup>':'';}
  return '<div class="dwrap"><button class="btn" data-act="drv-back" style="align-self:flex-start">Voltar</button>'+
  '<form id="f-abast" class="dcard"><div><h3>Registrar abastecimento</h3><div class="muted">Preencha com os dados da bomba e do painel do veículo.</div></div>'+
  '<div class="field"><label for="ab-v">Veículo</label><select id="ab-v" name="veiculo" required><option value="">Escolha o veículo</option>'+grp('moto')+grp('caminhao')+grp('carro')+'</select></div>'+
  '<div class="field"><label for="ab-km">Km do painel agora</label><input id="ab-km" name="km" type="number" min="0" step="1" inputmode="numeric" required autocomplete="off"><span class="note" id="ab-km-d"></span></div>'+
  '<div class="field"><label for="ab-l">Litros abastecidos</label><input id="ab-l" name="litros" type="number" min="0" step="0.01" inputmode="decimal" required autocomplete="off"></div>'+
  '<div class="field"><label for="ab-r">Valor total (R$)</label><input id="ab-r" name="valor" type="number" min="0" step="0.01" inputmode="decimal" required autocomplete="off"></div>'+
  '<div class="field"><label for="ab-c">Quanto você abasteceu?</label><select id="ab-c" name="cheio"><option value="1">Completei o tanque</option><option value="0">Abasteci só uma parte</option></select><span class="note">O consumo só é calculado entre abastecimentos com o tanque completo.</span></div>'+
  '<div class="field"><label for="ab-p">Posto (opcional)</label><input id="ab-p" name="posto" autocomplete="off"></div>'+
  '<div class="field"><span class="lbl">Foto do odômetro (obrigatória)</span><label class="pick" for="ab-od-in"><span id="ab-od-lbl">Tirar foto do painel</span></label><input class="vh" id="ab-od-in" type="file" accept="image/*" capture="environment"><img id="ab-od-prev" class="ev" alt="Prévia da foto do odômetro" hidden></div>'+
  '<div class="field"><span class="lbl">Foto da nota ou da bomba (opcional)</span><label class="pick" for="ab-nt-in"><span id="ab-nt-lbl">Tirar foto da nota</span></label><input class="vh" id="ab-nt-in" type="file" accept="image/*" capture="environment"><img id="ab-nt-prev" class="ev" alt="Prévia da foto da nota" hidden></div>'+
  '<div class="field"><label for="ab-o">Observações</label><textarea id="ab-o" name="obs"></textarea></div>'+
  '<div class="err" id="ab-err" role="alert"></div><button class="btn btn-primary btn-lg" type="submit">Salvar abastecimento</button></form></div>';
}
/* mostra o último km do veículo escolhido */
function dicaKm(){
  var sel=$('#ab-v'),d=$('#ab-km-d');if(!sel||!d)return;
  var v=sel.value?veic(+sel.value):null;
  d.textContent=v?'Último km registrado deste veículo: '+fmtN(ultimoKmDe(v),0):'';
}
function saveAbast(form){
  var err=$('#ab-err'),v=fv(form,'veiculo')?veic(+fv(form,'veiculo')):null;
  if(!v){err.textContent='Escolha o veículo.';return;}
  var km=numIn(fv(form,'km')),li=numIn(fv(form,'litros')),va=numIn(fv(form,'valor'));
  if(km==null||km<0){err.textContent='Informe o km do painel.';return;}
  var ult=ultimoKmDe(v);
  if(km<ult){err.textContent='O km informado ('+fmtN(km,0)+') é menor que o último registrado ('+fmtN(ult,0)+'). Confira o painel.';return;}
  if(li==null||li<=0){err.textContent='Informe os litros abastecidos.';return;}
  if(va==null||va<=0){err.textContent='Informe o valor total pago.';return;}
  if(v.capacidade&&li>v.capacidade*1.2){err.textContent='Os litros ('+fmtN(li,1)+') passam muito da capacidade do tanque ('+fmtN(v.capacidade,1)+' L). Confira o valor.';return;}
  if(!UI.fotoOd){err.textContent='Tire a foto do odômetro (painel).';return;}
  DB.abastecimentos.push({id:novoIdAb(),veiculoId:v.id,motoristaId:SESSION.id,em:nowIso(),km:km,litros:li,valor:va,cheio:fv(form,'cheio')==='1',posto:fv(form,'posto').trim(),fotoOdometro:UI.fotoOd,fotoNota:UI.fotoNt||null,obs:fv(form,'obs').trim(),origem:'app'});
  v.ultimoKm=Math.max(v.ultimoKm||0,km);
  if(!save())return;
  UI.drv={screen:'home',id:null};renderApp();window.scrollTo(0,0);toast('Abastecimento registrado');
}
