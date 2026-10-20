'use strict';
/* Camada de dados LOCAL: tudo fica no navegador (localStorage). */
var LS='despacho-entregas-v1', LSS='despacho-sessao-v1', LSP='despacho-posicoes-v1';
var DB=null, SESSION=null;

function load(){
  try{var raw=localStorage.getItem(LS);if(raw){DB=JSON.parse(raw);if(DB&&DB.v===1&&!(DB.demo&&DB.seedDay!==todayKey()))return;}}catch(e){}
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
  assinar:function(){return Promise.resolve();},
  urlEvid:function(v){return v;},
  posicoes:function(){try{return JSON.parse(localStorage.getItem(LSP)||'{}');}catch(e){return {};}},
  enviarPosicao:function(motoristaId,lat,lng,prec){
    try{var p=DadosLocal.posicoes();p[motoristaId]={lat:lat,lng:lng,prec:prec,em:new Date().toISOString()};localStorage.setItem(LSP,JSON.stringify(p));}catch(e){}
    return Promise.resolve();
  }
};
