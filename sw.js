'use strict';
/* Service worker do ArcosRotas: deixa o app abrir mesmo com sinal fraco.
   Regra principal: SEMPRE tenta a internet primeiro (assim as atualizações chegam sozinhas e os dados
   nunca ficam velhos). O cache só entra quando não há rede. Dados do Supabase, mapas e rotas são de
   outros endereços e NÃO passam por aqui. */
var CACHE='arcorota-app-v6';
var BASE=['./','index.html','admin.html','colaborador.html','instalar.html','sobre.html','admin.webmanifest','colaborador.webmanifest','marca/admin-192.png','marca/mot-192.png'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(BASE);}).catch(function(){}).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch',function(e){
  var r=e.request;
  if(r.method!=='GET')return;
  var u=new URL(r.url);
  if(u.origin!==self.location.origin)return;          /* Supabase, mapas, rotas: direto da internet */
  e.respondWith(
    fetch(r).then(function(res){
      if(res&&res.ok){var cp=res.clone();caches.open(CACHE).then(function(c){c.put(r,cp);}).catch(function(){});}
      return res;
    }).catch(function(){
      return caches.match(r,{ignoreSearch:false}).then(function(m){return m||caches.match(r,{ignoreSearch:true});}).then(function(m){return m||(r.mode==='navigate'?caches.match('index.html'):undefined)||Response.error();});
    })
  );
});
