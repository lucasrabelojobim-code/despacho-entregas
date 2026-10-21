-- Despacho de Entregas · Arcos Jobim
-- PARTE 5: local da empresa no mapa (só o desenvolvedor altera) + tipo do pedido (entrega ou coleta).
--
-- Cole TODO este arquivo no Supabase: SQL Editor > New query > Run.
-- Rode ANTES de enviar os arquivos novos do site. Pode rodar de novo sem problema.
-- Não apaga nada e não mexe em plano, usuários nem entregas existentes.

-- ============ 1) ENTREGA OU COLETA ============
-- Toda entrega que já existe continua sendo "entrega".
alter table public.entregas add column if not exists tipo text not null default 'entrega';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entregas_tipo_check' and conrelid = 'public.entregas'::regclass) then
    alter table public.entregas add constraint entregas_tipo_check check (tipo in ('entrega','coleta'));
  end if;
end $$;

-- ============ 2) LOCAL DA EMPRESA ============
-- Uma única linha (id = 1). Ninguém lê nem grava direto: tudo passa pelas funções abaixo.
create table if not exists public.empresa_local (
  id            int primary key default 1 check (id = 1),
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  endereco      text not null default '',
  atualizado_em timestamptz not null default now()
);
alter table public.empresa_local enable row level security;
revoke all on public.empresa_local from anon, authenticated;

-- Qualquer administrador ou motorista com acesso liberado enxerga o local (para desenhar o mapa).
create or replace function public.local_empresa() returns json
  language sql stable security definer set search_path = public as
  $$ select case when public.eh_admin() or public.meu_colaborador() is not null
            then (select json_build_object('lat', lat, 'lng', lng, 'endereco', endereco) from public.empresa_local where id = 1)
         end $$;

-- Só o desenvolvedor altera.
create or replace function public.dev_definir_local_empresa(p_lat double precision, p_lng double precision, p_endereco text default '') returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_dev() then raise exception 'Acesso negado.'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Local inválido.';
  end if;
  insert into public.empresa_local (id, lat, lng, endereco, atualizado_em)
  values (1, p_lat, p_lng, left(coalesce(p_endereco, ''), 300), now())
  on conflict (id) do update
    set lat = excluded.lat, lng = excluded.lng, endereco = excluded.endereco, atualizado_em = now();
end $$;

do $$
declare f text;
begin
  foreach f in array array['local_empresa()', 'dev_definir_local_empresa(double precision,double precision,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
