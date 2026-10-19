-- Despacho de Entregas · Arcos Jobim
-- Cole TODO este arquivo no Supabase: SQL Editor > New query > Run.
-- Pode rodar de novo sem problema (usa "if not exists" / "or replace").

-- ============ TABELAS ============
create table if not exists public.colaboradores (
  id          text primary key,                 -- ex.: c1, c2
  nome        text not null,
  tipo        text not null check (tipo in ('Efetivado','Terceirizado')),
  empresa     text default '',                  -- empresa terceirizada
  veiculo     text default '',
  placa       text default '',
  telefone    text default '',
  usuario     text unique,
  cpf         text default '',
  matricula   text default '',
  ativo       boolean not null default true,
  token       text,
  auth_id     uuid references auth.users(id) on delete set null
);

create table if not exists public.entregas (
  id            bigint primary key,
  dia           date not null,
  cliente       text not null,
  endereco      text default '',
  motorista_id  text references public.colaboradores(id),
  status        text not null check (status in ('separado','em_rota','entregue','entregue_problema','devolvido','enviado_errado')),
  prazo         timestamptz,
  criado_em     timestamptz,
  saida_em      timestamptz,
  concluido_em  timestamptz,
  retorno_em    timestamptz,
  itens         jsonb not null default '[]',    -- [{codigo, desc, qtd, qtdEntregue}]
  obs           text default '',
  recebedor     text default '',
  foto          text,                           -- URL no Storage (bucket evidencias)
  assinatura    text,                           -- URL no Storage
  x             double precision,               -- posição no mapa esquemático
  y             double precision,
  lat           double precision,               -- posição no mapa real
  lng           double precision
);
create index if not exists entregas_dia_idx on public.entregas (dia);
create index if not exists entregas_motorista_idx on public.entregas (motorista_id);

create table if not exists public.ocorrencias (
  id            bigint primary key,
  entrega_id    bigint references public.entregas(id) on delete cascade,
  dia           date not null,
  tipo          text not null check (tipo in ('defeito','avaria','falta','devolvido','enviado_errado')),
  codigo        text default '',
  motivo        text default '',
  em            timestamptz not null,
  motorista_id  text references public.colaboradores(id)
);
create index if not exists ocorrencias_dia_idx on public.ocorrencias (dia);

create table if not exists public.catalogo (
  codigo     text primary key,
  descricao  text
);

-- quem é administrador e quem é motorista (liga o login ao cadastro)
create table if not exists public.perfis (
  auth_id         uuid primary key references auth.users(id) on delete cascade,
  papel           text not null check (papel in ('admin','motorista')),
  colaborador_id  text references public.colaboradores(id)
);

-- posição GPS enviada pelo celular do motorista
create table if not exists public.posicoes (
  id            bigint generated always as identity primary key,
  motorista_id  text not null references public.colaboradores(id),
  lat           double precision not null,
  lng           double precision not null,
  precisao      integer,
  em            timestamptz not null default now()
);
create index if not exists posicoes_motorista_em_idx on public.posicoes (motorista_id, em desc);

create or replace view public.ultima_posicao with (security_invoker = true) as
  select distinct on (motorista_id) motorista_id, lat, lng, precisao, em
  from public.posicoes
  order by motorista_id, em desc;

-- ============ FUNÇÕES AUXILIARES ============
create or replace function public.eh_admin() returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.perfis where auth_id = auth.uid() and papel = 'admin') $$;

create or replace function public.meu_colaborador() returns text
  language sql stable security definer set search_path = public as
  $$ select colaborador_id from public.perfis where auth_id = auth.uid() and papel = 'motorista' $$;

-- ============ SEGURANÇA (Row Level Security) ============
alter table public.colaboradores enable row level security;
alter table public.entregas      enable row level security;
alter table public.ocorrencias   enable row level security;
alter table public.catalogo      enable row level security;
alter table public.perfis        enable row level security;
alter table public.posicoes      enable row level security;

drop policy if exists col_ler  on public.colaboradores;
drop policy if exists col_esc  on public.colaboradores;
drop policy if exists col_alt  on public.colaboradores;
create policy col_ler on public.colaboradores for select to authenticated using (public.eh_admin() or id = public.meu_colaborador());
create policy col_esc on public.colaboradores for insert to authenticated with check (public.eh_admin());
create policy col_alt on public.colaboradores for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists ent_ler on public.entregas;
drop policy if exists ent_esc on public.entregas;
drop policy if exists ent_alt on public.entregas;
create policy ent_ler on public.entregas for select to authenticated using (public.eh_admin() or motorista_id = public.meu_colaborador());
create policy ent_esc on public.entregas for insert to authenticated with check (public.eh_admin());
create policy ent_alt on public.entregas for update to authenticated
  using (public.eh_admin() or motorista_id = public.meu_colaborador())
  with check (public.eh_admin() or motorista_id = public.meu_colaborador());

drop policy if exists oc_ler on public.ocorrencias;
drop policy if exists oc_esc on public.ocorrencias;
drop policy if exists oc_alt on public.ocorrencias;
create policy oc_ler on public.ocorrencias for select to authenticated using (public.eh_admin() or motorista_id = public.meu_colaborador());
create policy oc_esc on public.ocorrencias for insert to authenticated with check (public.eh_admin() or motorista_id = public.meu_colaborador());
create policy oc_alt on public.ocorrencias for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists cat_ler on public.catalogo;
drop policy if exists cat_esc on public.catalogo;
drop policy if exists cat_alt on public.catalogo;
create policy cat_ler on public.catalogo for select to authenticated using (true);
create policy cat_esc on public.catalogo for insert to authenticated with check (public.eh_admin());
create policy cat_alt on public.catalogo for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists per_ler on public.perfis;
drop policy if exists per_esc on public.perfis;
create policy per_ler on public.perfis for select to authenticated using (auth_id = auth.uid() or public.eh_admin());
create policy per_esc on public.perfis for insert to authenticated with check (public.eh_admin());

drop policy if exists pos_ler on public.posicoes;
drop policy if exists pos_esc on public.posicoes;
create policy pos_ler on public.posicoes for select to authenticated using (public.eh_admin());
create policy pos_esc on public.posicoes for insert to authenticated with check (motorista_id = public.meu_colaborador());

-- ============ FOTOS E ASSINATURAS (Storage) ============
insert into storage.buckets (id, name, public) values ('evidencias', 'evidencias', true)
  on conflict (id) do nothing;
drop policy if exists evid_ler on storage.objects;
drop policy if exists evid_esc on storage.objects;
drop policy if exists evid_alt on storage.objects;
create policy evid_ler on storage.objects for select using (bucket_id = 'evidencias');
create policy evid_esc on storage.objects for insert to authenticated with check (bucket_id = 'evidencias');
create policy evid_alt on storage.objects for update to authenticated using (bucket_id = 'evidencias');

-- ============ PRIMEIRO ADMINISTRADOR ============
-- 1) No Supabase: Authentication > Users > Add user > "Create new user"
--    e-mail: admin@despacho.app   senha: (escolha uma forte)   marque "Auto Confirm User"
-- 2) Depois rode esta linha:
--
-- insert into public.perfis (auth_id, papel)
--   select id, 'admin' from auth.users where email = 'admin@despacho.app'
--   on conflict (auth_id) do nothing;
