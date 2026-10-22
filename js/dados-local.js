'use strict';
/* Camada de dados LOCAL: tudo fica no navegador (localStorage). */
var LS='despacho-entregas-v1', LSS='despacho-sessao-v1', LSP='despacho-posicoes-v1';
var DB=null, SESSION=null, EMPRESA=null;   /* EMPRESA: local da empresa definido pelo desenvolvedor (modo online) */

function load(){
  try{var raw=localStorage.getItem(LS);if(raw){DB=JSON.parse(raw);if(DB&&DB.v===1&&!(DB.demo&&DB.seedDay!==todayKey())){garantirCombustivel(DB);return;}}}catch(e){}
  DB=seed();DadosLocal.salvar();
}
function saveSession(){try{if(SESSION&&SESSION.via!=='link')localStorage.setItem(LSS,JSON.stringify(SESSION));else localStorage.removeItem(LSS);}catch(e){}}
function restoreSession(){try{var s=JSON.parse(localStorage.getItem(LSS)||'null');if(s&&(s.role==='admin'||colab(s.id)))SESSION=s;}catch(e){}}

var DadosLocal={
  modo:'local',
  restaurar:function(){load();SESSION=null;restoreSession();return Promise.resolve(SESSION);},
  carregar:function(){return Promise.resolve();},
  salvar:function(){
    try{localStorage.setItem(LS,JSON.stringify(DB));return true;}
    catch(e){toast('Não foi possível salvar neste navegador (armazenamento cheio ou bloqueado).');return false;}
  },
  entrar:function(u,p){
    u=(u||'').trim().toLowerCase();
    if(u==='admin'&&p==='admin123')return Promise.resolve({sessao:{role:'admin'}});
    var c=DB.colaboradores.find(function(x){return x.usuario&&x.usuario.toLowerCase()===u&&x.senha===p;});
    if(!c)return Promise.resolve({erro:'Usuário ou senha incorretos.'});
    if(c.ativo===false)return Promise.resolve({erro:'Este colaborador está inativo.'});
    return Promise.resolve({sessao:{role:'driver',id:c.id,via:'login'}});
  },
  sair:function(){return Promise.resolve();},
  atualizar:function(){return Promise.resolve(false);},
  criarAcesso:function(c){return Promise.resolve(c);},
  statusAcesso:function(){return Promise.resolve({liberado:true,motivo:'ok',plano:'full',dev:false,local:true});},
  /* histórico: no modo local tudo já está em DB */
  historico:function(de,ate){
    return Promise.resolve({
      entregas:DB.entregas.filter(function(e){return e.dia>=de&&e.dia<=ate;}),
      ocorrencias:DB.ocorrencias.filter(function(o){return o.dia>=de&&o.dia<=ate;}),
      abastecimentos:DB.abastecimentos.filter(function(a){var d=dayKey(a.em);return d>=de&&d<=ate;})
    });
  },
  diasComMovimento:function(de,ate){
    var m={};DB.entregas.forEach(function(e){if(e.dia>=de&&e.dia<=ate)m[e.dia]=(m[e.dia]||0)+1;});
    return Promise.resolve(m);
  },
  linkAcompanhamento:function(){return Promise.reject(new Error('Disponível só no modo online.'));},
  assinar:function(){return Promise.resolve();},
  urlEvid:function(v){return v;},
  posicoes:function(){try{return JSON.parse(localStorage.getItem(LSP)||'{}');}catch(e){return {};}},
  enviarPosicao:function(motoristaId,lat,lng,prec){
    try{var p=DadosLocal.posicoes();p[motoristaId]={lat:lat,lng:lng,prec:prec,em:new Date().toISOString()};localStorage.setItem(LSP,JSON.stringify(p));}catch(e){}
    return Promise.resolve();
  }
};
