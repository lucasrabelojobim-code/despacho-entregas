-- ArcosRotas · Arcos Jobim
-- PARTE 8: cadastro no primeiro acesso.
--   Administrador: nome completo, nome da empresa e email (só o desenvolvedor vê).
--   Motorista: nome completo, email e vínculo (efetivado ou terceirizado, e de qual empresa).
--
-- Cole TODO este arquivo no Supabase: SQL Editor > New query > Run.
-- Pode rodar de novo sem problema. Não apaga nada e não mexe em plano, usuários nem entregas.

-- ============ 1) TABELA ============
create table if not exists public.cadastros (
  auth_id        uuid primary key references auth.users(id) on delete cascade,
  papel          text not null check (papel in ('admin','motorista')),
  nome_completo  text not null check (length(trim(nome_completo)) between 3 and 120),
  email          text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 160),
  empresa        text not null default '' check (length(empresa) <= 120),  -- admin: empresa dele · motorista terceirizado: empresa terceirizada
  vinculo        text check (vinculo in ('Efetivado','Terceirizado')),      -- só motorista
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
-- ninguém lê nem grava direto: só pelas funções abaixo
alter table public.cadastros enable row level security;
revoke all on public.cadastros from anon, authenticated;

-- ============ 2) FUNÇÕES ============
-- O meu cadastro (vazio = ainda não fez). O desenvolvedor não precisa de cadastro.
create or replace function public.meu_cadastro() returns jsonb
  language sql stable security definer set search_path = public as
  $$ select case
       when exists (select 1 from public.perfis where auth_id = auth.uid() and papel = 'desenvolvedor')
         then jsonb_build_object('dispensado', true)
       else (select to_jsonb(c) - 'auth_id' from public.cadastros c where c.auth_id = auth.uid())
     end $$;

-- Salva só o próprio cadastro, conferindo os campos conforme o papel.
create or replace function public.salvar_meu_cadastro(
  p_nome text, p_email text, p_empresa text default '', p_vinculo text default null
) returns void
  language plpgsql security definer set search_path = public as $$
declare v_papel text;
begin
  select papel into v_papel from public.perfis where auth_id = auth.uid() and not bloqueado;
  if v_papel is null or v_papel not in ('admin','motorista') then
    raise exception 'Usuário sem permissão para cadastro.';
  end if;
  p_nome := trim(coalesce(p_nome,'')); p_email := lower(trim(coalesce(p_email,'')));
  p_empresa := trim(coalesce(p_empresa,''));
  if length(p_nome) < 3 then raise exception 'Informe o nome completo.'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email inválido.'; end if;
  if v_papel = 'admin' then
    if p_empresa = '' then raise exception 'Informe o nome da empresa.'; end if;
    p_vinculo := null;
  else
    if p_vinculo is null or p_vinculo not in ('Efetivado','Terceirizado') then raise exception 'Informe se é efetivado ou terceirizado.'; end if;
    if p_vinculo = 'Terceirizado' and p_empresa = '' then raise exception 'Informe a empresa terceirizada.'; end if;
    if p_vinculo = 'Efetivado' then p_empresa := ''; end if;
  end if;
  insert into public.cadastros (auth_id, papel, nome_completo, email, empresa, vinculo)
  values (auth.uid(), v_papel, p_nome, p_email, p_empresa, p_vinculo)
  on conflict (auth_id) do update
    set nome_completo = excluded.nome_completo, email = excluded.email, empresa = excluded.empresa,
        vinculo = excluded.vinculo, papel = excluded.papel, atualizado_em = now();
end $$;

-- Todos os cadastros (administradores e motoristas). Só o desenvolvedor.
create or replace function public.dev_listar_cadastros()
  returns table (auth_id uuid, papel text, nome_completo text, email text, empresa text, vinculo text, login text, criado_em timestamptz)
  language sql stable security definer set search_path = public as
  $$ select c.auth_id, c.papel, c.nome_completo, c.email, c.empresa, c.vinculo, u.email::text, c.criado_em
     from public.cadastros c left join auth.users u on u.id = c.auth_id
     where public.eh_dev()
     order by (c.papel = 'admin') desc, c.criado_em desc $$;

-- Cadastros dos motoristas, para a aba Colaboradores do administrador.
create or replace function public.listar_cadastros_motoristas()
  returns table (colaborador_id text, nome_completo text, email text, empresa text, vinculo text, criado_em timestamptz)
  language sql stable security definer set search_path = public as
  $$ select p.colaborador_id, c.nome_completo, c.email, c.empresa, c.vinculo, c.criado_em
     from public.cadastros c join public.perfis p on p.auth_id = c.auth_id
     where c.papel = 'motorista' and public.eh_admin() $$;

do $$
declare f text;
begin
  foreach f in array array['meu_cadastro()', 'salvar_meu_cadastro(text,text,text,text)',
                           'dev_listar_cadastros()', 'listar_cadastros_motoristas()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
