-- Despacho de Entregas · Arcos Jobim
-- PARTE 2: usuário DESENVOLVEDOR + PLANOS (teste grátis de 3 dias e Full com código).
--
-- Cole TODO este arquivo no Supabase: SQL Editor > New query > Run.
-- Rode DEPOIS do schema.sql. Pode rodar de novo sem problema.
--
-- Este arquivo NÃO bloqueia ninguém: a empresa começa no plano Full.
-- O bloqueio só acontece quando você rodar o arquivo 04-ativar-bloqueio.sql.
--
-- ORDEM:  02 (este)  ->  03-criar-desenvolvedor.sql  ->  testar o login  ->  04-ativar-bloqueio.sql

-- ============ 1) PERFIS: papel "desenvolvedor" e bloqueio individual ============
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.perfis'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%papel%'
  loop
    execute format('alter table public.perfis drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.perfis add constraint perfis_papel_check check (papel in ('desenvolvedor','admin','motorista'));
alter table public.perfis add column if not exists bloqueado boolean not null default false;

-- ============ 2) TABELAS DE PLANO ============
-- Uma única linha (id = 1): o plano vale para a empresa inteira.
--   teste      = 3 dias (configurável), contados a partir do primeiro login de qualquer usuário da empresa
--   full       = sem prazo
--   bloqueado  = ninguém entra (só o desenvolvedor)
create table if not exists public.licenca (
  id            int primary key default 1 check (id = 1),
  plano         text not null default 'full' check (plano in ('teste','full','bloqueado')),
  teste_dias    int  not null default 3 check (teste_dias between 1 and 365),
  teste_inicio  timestamptz,
  teste_fim     timestamptz,
  full_desde    timestamptz,
  atualizado_em timestamptz not null default now()
);
insert into public.licenca (id, plano, full_desde) values (1, 'full', now()) on conflict (id) do nothing;

-- Códigos do plano Full. O código em si NÃO fica guardado: só a "impressão digital" (hash).
-- Por isso ele aparece uma única vez, na hora de gerar.
create table if not exists public.codigos_acesso (
  id           bigint generated always as identity primary key,
  codigo_hash  text not null unique,
  nota         text default '',
  criado_em    timestamptz not null default now(),
  usado_em     timestamptz,
  usado_por    uuid references auth.users(id) on delete set null,
  cancelado_em timestamptz
);

-- limite de tentativas erradas de código (contra adivinhação)
create table if not exists public.tentativas_codigo (
  id       bigint generated always as identity primary key,
  auth_id  uuid,
  em       timestamptz not null default now()
);
create index if not exists tentativas_codigo_idx on public.tentativas_codigo (auth_id, em desc);

alter table public.licenca           enable row level security;
alter table public.codigos_acesso    enable row level security;
alter table public.tentativas_codigo enable row level security;

-- ============ 3) FUNÇÕES DE ACESSO ============
-- é o desenvolvedor? (não depende do plano: ele nunca é bloqueado)
create or replace function public.eh_dev() returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.perfis where auth_id = auth.uid() and papel = 'desenvolvedor' and not bloqueado) $$;

-- o plano da empresa está valendo agora?
create or replace function public.plano_ativo() returns boolean
  language sql stable security definer set search_path = public as
  $$ select coalesce((
       select case plano
                when 'full'  then true
                when 'teste' then (teste_inicio is null or now() < teste_fim)
                else false end
       from public.licenca where id = 1), false) $$;

-- administrador (e desenvolvedor, que tem tudo do administrador). Plano vencido ou usuário bloqueado = falso.
create or replace function public.eh_admin() returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (
       select 1 from public.perfis p
       where p.auth_id = auth.uid() and not p.bloqueado
         and (p.papel = 'desenvolvedor' or (p.papel = 'admin' and public.plano_ativo()))) $$;

-- motorista logado. Plano vencido ou usuário bloqueado = nulo (as regras de segurança passam a negar tudo).
create or replace function public.meu_colaborador() returns text
  language sql stable security definer set search_path = public as
  $$ select p.colaborador_id from public.perfis p
     where p.auth_id = auth.uid() and p.papel = 'motorista' and not p.bloqueado and public.plano_ativo() $$;

-- ============ 4) REGRAS DE SEGURANÇA (substituem as antigas) ============
-- Perfis: o administrador não enxerga o perfil do desenvolvedor, não cria administradores e não altera ninguém.
drop policy if exists per_ler on public.perfis;
drop policy if exists per_esc on public.perfis;
create policy per_ler on public.perfis for select to authenticated
  using (auth_id = auth.uid() or public.eh_dev() or (public.eh_admin() and papel <> 'desenvolvedor'));
create policy per_esc on public.perfis for insert to authenticated
  with check ((public.eh_dev() and papel in ('admin','motorista')) or (public.eh_admin() and papel = 'motorista'));

-- Catálogo e veículos eram abertos a qualquer usuário logado: agora respeitam o plano.
drop policy if exists cat_ler on public.catalogo;
create policy cat_ler on public.catalogo for select to authenticated
  using (public.eh_admin() or public.meu_colaborador() is not null);
drop policy if exists vei_ler on public.veiculos;
create policy vei_ler on public.veiculos for select to authenticated
  using (public.eh_admin() or public.meu_colaborador() is not null);

create or replace function public.ultimos_km() returns table (veiculo_id bigint, ultimo_km numeric)
  language sql stable security definer set search_path = public as
  $$ select a.veiculo_id, max(a.km) from public.abastecimentos a
     where public.eh_admin() or public.meu_colaborador() is not null
     group by a.veiculo_id $$;
revoke all on function public.ultimos_km() from public, anon;
grant execute on function public.ultimos_km() to authenticated;

-- Só o desenvolvedor apaga registros (o administrador não apaga nada).
drop policy if exists col_del on public.colaboradores;
drop policy if exists ent_del on public.entregas;
drop policy if exists oc_del  on public.ocorrencias;
drop policy if exists cat_del on public.catalogo;
drop policy if exists vei_del on public.veiculos;
drop policy if exists ab_del  on public.abastecimentos;
drop policy if exists pos_del on public.posicoes;
create policy col_del on public.colaboradores   for delete to authenticated using (public.eh_dev());
create policy ent_del on public.entregas        for delete to authenticated using (public.eh_dev());
create policy oc_del  on public.ocorrencias     for delete to authenticated using (public.eh_dev());
create policy cat_del on public.catalogo        for delete to authenticated using (public.eh_dev());
create policy vei_del on public.veiculos        for delete to authenticated using (public.eh_dev());
create policy ab_del  on public.abastecimentos  for delete to authenticated using (public.eh_dev());
create policy pos_del on public.posicoes        for delete to authenticated using (public.eh_dev());

-- Plano e códigos: só o desenvolvedor lê. Ninguém grava direto: tudo passa pelas funções abaixo.
drop policy if exists lic_ler on public.licenca;
drop policy if exists cod_ler on public.codigos_acesso;
create policy lic_ler on public.licenca        for select to authenticated using (public.eh_dev());
create policy cod_ler on public.codigos_acesso for select to authenticated using (public.eh_dev());

-- ============ 5) O TESTE GRÁTIS COMEÇA NO PRIMEIRO LOGIN ============
-- Dispara sozinho quando um usuário da empresa (admin ou motorista) entra. Nunca derruba o login.
create or replace function public.iniciar_teste_no_login() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    begin
      if exists (select 1 from public.perfis where auth_id = new.id and papel in ('admin','motorista')) then
        update public.licenca
           set teste_inicio = now(), teste_fim = now() + make_interval(days => teste_dias), atualizado_em = now()
         where id = 1 and plano = 'teste' and teste_inicio is null;
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end $$;
drop trigger if exists teste_inicia_no_login on auth.users;
create trigger teste_inicia_no_login after update of last_sign_in_at on auth.users
  for each row execute function public.iniciar_teste_no_login();

-- ============ 6) FUNÇÕES CHAMADAS PELO SITE: TODOS OS USUÁRIOS ============
-- Situação do acesso do usuário logado (o site usa para mostrar a tela de bloqueio e o aviso de dias restantes).
create or replace function public.status_acesso() returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  p public.perfis%rowtype;
  l public.licenca%rowtype;
  lib boolean; motivo text; resto bigint;
begin
  select * into p from public.perfis where auth_id = auth.uid();
  if p.auth_id is null then
    return jsonb_build_object('liberado', false, 'motivo', 'sem_perfil');
  end if;

  if p.papel in ('admin','motorista') and not p.bloqueado then
    update public.licenca
       set teste_inicio = now(), teste_fim = now() + make_interval(days => teste_dias), atualizado_em = now()
     where id = 1 and plano = 'teste' and teste_inicio is null;
  end if;

  select * into l from public.licenca where id = 1;
  resto := case when l.plano = 'teste' and l.teste_fim is not null
                then greatest(0, floor(extract(epoch from (l.teste_fim - now()))))::bigint end;

  if p.bloqueado then
    lib := false; motivo := 'usuario_bloqueado';
  elsif p.papel = 'desenvolvedor' then
    lib := true; motivo := 'ok';
  elsif l.plano = 'full' then
    lib := true; motivo := 'ok';
  elsif l.plano = 'teste' and (l.teste_inicio is null or now() < l.teste_fim) then
    lib := true; motivo := 'ok';
  elsif l.plano = 'teste' then
    lib := false; motivo := 'teste_expirado';
  else
    lib := false; motivo := 'bloqueado';
  end if;

  return jsonb_build_object(
    'liberado', lib, 'motivo', motivo, 'papel', p.papel, 'dev', p.papel = 'desenvolvedor',
    'plano', l.plano, 'teste_dias', l.teste_dias, 'teste_fim', l.teste_fim, 'segundos_restantes', resto);
end $$;

-- Resgata um código do plano Full. Cada código funciona uma única vez.
create or replace function public.resgatar_codigo(p_codigo text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  p public.perfis%rowtype;
  c public.codigos_acesso%rowtype;
  norm text; h text; falhas int;
begin
  select * into p from public.perfis where auth_id = auth.uid();
  if p.auth_id is null or p.bloqueado or p.papel not in ('admin','motorista') then
    return jsonb_build_object('ok', false, 'erro', 'Este usuário não pode ativar um plano.');
  end if;

  select count(*) into falhas from public.tentativas_codigo where auth_id = auth.uid() and em > now() - interval '15 minutes';
  if falhas >= 5 then
    return jsonb_build_object('ok', false, 'erro', 'Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.');
  end if;

  norm := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  h := encode(sha256(convert_to(norm, 'utf8')), 'hex');

  select * into c from public.codigos_acesso
   where codigo_hash = h and usado_em is null and cancelado_em is null
   for update;
  if c.id is null then
    insert into public.tentativas_codigo (auth_id) values (auth.uid());
    return jsonb_build_object('ok', false, 'erro', 'Código inválido ou já utilizado.');
  end if;

  update public.codigos_acesso set usado_em = now(), usado_por = auth.uid() where id = c.id;
  update public.licenca set plano = 'full', full_desde = now(), atualizado_em = now() where id = 1;
  delete from public.tentativas_codigo where auth_id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- ============ 7) FUNÇÕES SÓ DO DESENVOLVEDOR ============
-- Escolher o plano da empresa.
--   'teste'     : p_dias de teste. Se p_iniciar_agora for falso, a contagem começa no próximo login.
--   'full'      : libera sem prazo, sem código.
--   'bloqueado' : tranca todo mundo (menos o desenvolvedor).
create or replace function public.dev_definir_plano(p_plano text, p_dias int default 3, p_iniciar_agora boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_dev() then raise exception 'Acesso negado.'; end if;
  if p_plano not in ('teste','full','bloqueado') then raise exception 'Plano inválido.'; end if;
  if p_plano = 'teste' then
    if p_dias is null or p_dias < 1 or p_dias > 365 then raise exception 'Informe de 1 a 365 dias.'; end if;
    update public.licenca set plano = 'teste', teste_dias = p_dias,
           teste_inicio = case when p_iniciar_agora then now() end,
           teste_fim    = case when p_iniciar_agora then now() + make_interval(days => p_dias) end,
           atualizado_em = now() where id = 1;
  elsif p_plano = 'full' then
    update public.licenca set plano = 'full', full_desde = now(), atualizado_em = now() where id = 1;
  else
    update public.licenca set plano = 'bloqueado', atualizado_em = now() where id = 1;
  end if;
end $$;

-- Somar dias ao teste que está rodando (ou que já terminou).
create or replace function public.dev_estender_teste(p_dias int) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_dev() then raise exception 'Acesso negado.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 365 then raise exception 'Informe de 1 a 365 dias.'; end if;
  update public.licenca set
    teste_fim = case when teste_fim is null then null else greatest(teste_fim, now()) + make_interval(days => p_dias) end,
    teste_dias = case when teste_fim is null then least(365, teste_dias + p_dias) else teste_dias end,
    plano = 'teste', atualizado_em = now()
  where id = 1 and plano = 'teste';
  if not found then raise exception 'A empresa não está no plano de teste.'; end if;
end $$;

-- Gera um código do plano Full e devolve o texto UMA ÚNICA VEZ.
create or replace function public.dev_gerar_codigo(p_nota text default '') returns text
  language plpgsql security definer set search_path = public as $$
declare raw text; tentativa int := 0;
begin
  if not public.eh_dev() then raise exception 'Acesso negado.'; end if;
  loop
    raw := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
    begin
      insert into public.codigos_acesso (codigo_hash, nota)
        values (encode(sha256(convert_to(raw, 'utf8')), 'hex'), left(coalesce(p_nota, ''), 120));
      exit;
    exception when unique_violation then
      tentativa := tentativa + 1;
      if tentativa > 5 then raise; end if;
    end;
  end loop;
  return substr(raw,1,4) || '-' || substr(raw,5,4) || '-' || substr(raw,9,4) || '-' || substr(raw,13,4);
end $$;

create or replace function public.dev_cancelar_codigo(p_id bigint) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_dev() then raise exception 'Acesso negado.'; end if;
  update public.codigos_acesso set cancelado_em = now() where id = p_id and usado_em is null and cancelado_em is null;
  if not found then raise exception 'Código não encontrado, já usado ou já cancelado.'; end if;
end $$;

-- Lista de todos os usuários (inclusive administradores), com e-mail de login, papel e situação.
create or replace function public.dev_listar_usuarios()
  returns table (auth_id uuid, email text, papel text, colaborador_id text, nome text, bloqueado boolean, criado_em timestamptz, ultimo_login timestamptz)
  language sql stable security definer set search_path = public as
  $$ select p.auth_id, u.email::text, p.papel, p.colaborador_id, c.nome, p.bloqueado, u.created_at, u.last_sign_in_at
     from public.perfis p
     left join auth.users u on u.id = p.auth_id
     left join public.colaboradores c on c.id = p.colaborador_id
     where public.eh_dev()
     order by (p.papel = 'desenvolvedor') desc, (p.papel = 'admin') desc, c.nome nulls last, u.email $$;

-- Define uma nova senha para qualquer usuário (6 ou mais caracteres).
create or replace function public.dev_definir_senha(p_auth_id uuid, p_senha text) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.eh_dev() then raise exception 'Acesso negado.'; end if;
  if p_senha is null or length(p_senha) < 6 then raise exception 'A senha precisa ter ao menos 6 caracteres.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')), updated_at = now() where id = p_auth_id;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end $$;

-- Bloqueia ou libera um usuário (o bloqueio vale na hora, mesmo com o celular já logado).
create or replace function public.dev_bloquear_usuario(p_auth_id uuid, p_bloquear boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_dev() then raise exception 'Acesso negado.'; end if;
  if exists (select 1 from public.perfis where auth_id = p_auth_id and papel = 'desenvolvedor') then
    raise exception 'O usuário desenvolvedor não pode ser bloqueado.';
  end if;
  update public.perfis set bloqueado = p_bloquear where auth_id = p_auth_id;
  if not found then raise exception 'Usuário não encontrado.'; end if;
  update auth.users set banned_until = case when p_bloquear then now() + interval '100 years' end where id = p_auth_id;
end $$;

-- Troca o papel de um usuário entre administrador e motorista.
create or replace function public.dev_definir_papel(p_auth_id uuid, p_papel text, p_colaborador text default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_dev() then raise exception 'Acesso negado.'; end if;
  if p_papel not in ('admin','motorista') then raise exception 'Papel inválido.'; end if;
  if exists (select 1 from public.perfis where auth_id = p_auth_id and papel = 'desenvolvedor') then
    raise exception 'O usuário desenvolvedor não pode ser alterado.';
  end if;
  if p_papel = 'motorista' and not exists (select 1 from public.colaboradores where id = p_colaborador) then
    raise exception 'Escolha o colaborador (motorista) deste usuário.';
  end if;
  update public.perfis set papel = p_papel, colaborador_id = case when p_papel = 'motorista' then p_colaborador end where auth_id = p_auth_id;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end $$;

-- Exclui o acesso de um usuário. Com p_apagar_cadastro, apaga também o cadastro do colaborador,
-- mas só se ele não tiver entregas, ocorrências nem abastecimentos (o histórico nunca se perde).
create or replace function public.dev_excluir_usuario(p_auth_id uuid, p_apagar_cadastro boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
declare col text;
begin
  if not public.eh_dev() then raise exception 'Acesso negado.'; end if;
  if exists (select 1 from public.perfis where auth_id = p_auth_id and papel = 'desenvolvedor') then
    raise exception 'O usuário desenvolvedor não pode ser excluído.';
  end if;
  select colaborador_id into col from public.perfis where auth_id = p_auth_id;

  if p_apagar_cadastro and col is not null then
    if exists (select 1 from public.entregas where motorista_id = col)
       or exists (select 1 from public.ocorrencias where motorista_id = col)
       or exists (select 1 from public.abastecimentos where motorista_id = col) then
      raise exception 'Este colaborador tem entregas, ocorrências ou abastecimentos registrados. Exclua só o acesso (o cadastro fica inativo).';
    end if;
  end if;

  delete from public.perfis where auth_id = p_auth_id;
  if col is not null then
    if p_apagar_cadastro then
      delete from public.posicoes where motorista_id = col;
      delete from public.colaboradores where id = col;
    else
      update public.colaboradores set ativo = false, auth_id = null where id = col;
    end if;
  end if;
  delete from auth.users where id = p_auth_id;
end $$;

-- ============ 8) PERMISSÕES DAS FUNÇÕES ============
do $$
declare f text;
begin
  foreach f in array array[
    'status_acesso()', 'resgatar_codigo(text)',
    'dev_definir_plano(text,int,boolean)', 'dev_estender_teste(int)', 'dev_gerar_codigo(text)', 'dev_cancelar_codigo(bigint)',
    'dev_listar_usuarios()', 'dev_definir_senha(uuid,text)', 'dev_bloquear_usuario(uuid,boolean)',
    'dev_definir_papel(uuid,text,text)', 'dev_excluir_usuario(uuid,boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
