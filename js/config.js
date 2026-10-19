/* Configuração do site.
   Deixe supabaseUrl e supabaseKey vazios para rodar em MODO LOCAL (dados de exemplo no navegador).
   Para usar o banco online, preencha os dois campos (veja o README, passo 2). */
window.CONFIG = {
  supabaseUrl: '',          // ex.: https://abcdefgh.supabase.co
  supabaseKey: '',          // chave "anon public" (nunca use a service_role aqui)
  dominioLogin: 'despacho.app', // usuário "joao" vira joao@despacho.app no login online
  mapaReal: true,           // true = mapa OpenStreetMap; false = mapa esquemático
  gps: true,                // permite o motorista ativar o GPS do celular
  gpsIntervaloSeg: 20,      // de quanto em quanto tempo enviar a posição
  atualizarSeg: 15          // atualização automática do painel no modo online
};
