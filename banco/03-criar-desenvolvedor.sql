-- Despacho de Entregas · Arcos Jobim
-- PARTE 3: criar o usuário DESENVOLVEDOR (só você tem acesso).
--
-- 1) No Supabase: Authentication > Users > Add user > "Create new user"
--      e-mail: o e-mail que você vai usar para entrar como desenvolvedor
--      senha:  uma senha forte e só sua (não envie para ninguém)
--      marque "Auto Confirm User"
-- 2) Troque COLOQUE-AQUI-O-SEU-EMAIL (logo abaixo) pelo MESMO e-mail e rode este arquivo.
-- 3) No site, na tela de login, digite o e-mail completo no campo "Usuário" e a sua senha.

do $$
declare
  v_email text := 'COLOQUE-AQUI-O-SEU-EMAIL';
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);
  if v_id is null then
    raise exception 'Não achei o usuário "%". Crie-o em Authentication > Users e confira se o e-mail está igual.', v_email;
  end if;
  insert into public.perfis (auth_id, papel, colaborador_id, bloqueado)
    values (v_id, 'desenvolvedor', null, false)
    on conflict (auth_id) do update set papel = 'desenvolvedor', colaborador_id = null, bloqueado = false;
end $$;
