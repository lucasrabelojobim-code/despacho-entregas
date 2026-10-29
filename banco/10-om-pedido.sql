-- ArcosRotas · arquivo 10: número da OM / pedido na entrega
-- Usado pelo leitor de código de barras e QR code do app do motorista:
-- o código lido na etiqueta é comparado com este número.
-- Só adiciona uma coluna; não apaga nem altera nada que já existe. Pode rodar mais de uma vez.

alter table public.entregas add column if not exists om text default '';
create index if not exists entregas_om_idx on public.entregas (om);
