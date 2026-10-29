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
  status        text not null check (status in ('separado','em_rota','entregue','entregue_problema','devolvido','enviado_errado','cancelada')),
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

-- ============ COMBUSTÍVEL: VEÍCULOS E ABASTECIMENTOS ============
create table if not exists public.veiculos (
  id          bigint primary key,
  placa       text not null unique,
  tipo        text not null check (tipo in ('moto','caminhao','carro')),
  modelo      text default '',
  combustivel text default '',
  capacidade  numeric(6,1),                       -- litros do tanque (opcional)
  km_inicial  numeric(10,1) not null default 0,   -- km do painel quando o veículo entrou no sistema
  meta_kml    numeric(6,2),                       -- consumo esperado em km/L (opcional)
  ativo       boolean not null default true
);

create table if not exists public.abastecimentos (
  id             bigint primary key,
  veiculo_id     bigint not null references public.veiculos(id),
  motorista_id   text references public.colaboradores(id),
  em             timestamptz not null default now(),
  km             numeric(10,1) not null check (km >= 0),
  litros         numeric(8,2)  not null check (litros > 0),
  valor          numeric(10,2) not null check (valor >= 0),
  cheio          boolean not null default true,    -- completou o tanque?
  posto          text default '',
  foto_odometro  text,                             -- caminho no Storage (bucket evidencias)
  foto_nota      text,
  obs            text default '',
  origem         text not null default 'app' check (origem in ('app','cartao','importacao'))
);
create index if not exists abast_veiculo_km_idx on public.abastecimentos (veiculo_id, km desc);
create index if not exists abast_em_idx on public.abastecimentos (em desc);

-- maior km já registrado por veículo (o motorista não enxerga abastecimentos dos outros,
-- mas precisa saber o último km para não digitar um valor menor)
create or replace function public.ultimos_km() returns table (veiculo_id bigint, ultimo_km numeric)
  language sql stable security definer set search_path = public as
  $$ select a.veiculo_id, max(a.km) from public.abastecimentos a group by a.veiculo_id $$;
revoke all on function public.ultimos_km() from public, anon;
grant execute on function public.ultimos_km() to authenticated;

-- trava no banco: o km de um novo abastecimento não pode ser menor que o último do veículo
create or replace function public.checa_km_abastecimento() returns trigger
  language plpgsql security definer set search_path = public as $$
declare ult numeric; ini numeric; base numeric;
begin
  select km_inicial into ini from public.veiculos where id = new.veiculo_id;
  select max(km) into ult from public.abastecimentos where veiculo_id = new.veiculo_id and id <> new.id;
  base := greatest(coalesce(ult, 0), coalesce(ini, 0));
  if new.km < base then
    raise exception 'O km informado (%) é menor que o último registrado (%).', new.km, base;
  end if;
  return new;
end $$;
drop trigger if exists abast_checa_km on public.abastecimentos;
create trigger abast_checa_km before insert on public.abastecimentos
  for each row execute function public.checa_km_abastecimento();

alter table public.veiculos       enable row level security;
alter table public.abastecimentos enable row level security;

drop policy if exists vei_ler on public.veiculos;
drop policy if exists vei_esc on public.veiculos;
drop policy if exists vei_alt on public.veiculos;
create policy vei_ler on public.veiculos for select to authenticated using (true);
create policy vei_esc on public.veiculos for insert to authenticated with check (public.eh_admin());
create policy vei_alt on public.veiculos for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists ab_ler on public.abastecimentos;
drop policy if exists ab_esc on public.abastecimentos;
drop policy if exists ab_alt on public.abastecimentos;
create policy ab_ler on public.abastecimentos for select to authenticated using (public.eh_admin() or motorista_id = public.meu_colaborador());
create policy ab_esc on public.abastecimentos for insert to authenticated with check (
  public.eh_admin() or (motorista_id = public.meu_colaborador() and origem = 'app'));
create policy ab_alt on public.abastecimentos for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- ============ FOTOS E ASSINATURAS (Storage) ============
-- Bucket PRIVADO: as fotos só abrem por link temporário, gerado para quem tem permissão.
-- Entregas: pastas "entrega-<número>/". Abastecimentos: pastas "abastecimento-<id do motorista>/".
-- Cada motorista só envia e lê o que é dele; o administrador lê tudo. Ninguém altera arquivo já enviado.
insert into storage.buckets (id, name, public) values ('evidencias', 'evidencias', false)
  on conflict (id) do update set public = false;
drop policy if exists evid_ler on storage.objects;
drop policy if exists evid_esc on storage.objects;
drop policy if exists evid_alt on storage.objects;
create policy evid_ler on storage.objects for select to authenticated using (
  bucket_id = 'evidencias' and (
    public.eh_admin()
    or (storage.foldername(name))[1] = 'abastecimento-' || public.meu_colaborador()
    or exists (
      select 1 from public.entregas e
      where 'entrega-' || e.id::text = (storage.foldername(name))[1]
        and e.motorista_id = public.meu_colaborador())));
create policy evid_esc on storage.objects for insert to authenticated with check (
  bucket_id = 'evidencias' and (
    public.eh_admin()
    or (storage.foldername(name))[1] = 'abastecimento-' || public.meu_colaborador()
    or exists (
      select 1 from public.entregas e
      where 'entrega-' || e.id::text = (storage.foldername(name))[1]
        and e.motorista_id = public.meu_colaborador())));

-- ============ PRIMEIRO ADMINISTRADOR ============
-- 1) No Supabase: Authentication > Users > Add user > "Create new user"
--    e-mail: admin@despacho.app   senha: (escolha uma forte)   marque "Auto Confirm User"
-- 2) Depois rode esta linha:
--
-- insert into public.perfis (auth_id, papel)
--   select id, 'admin' from auth.users where email = 'admin@despacho.app'
--   on conflict (auth_id) do nothing;
