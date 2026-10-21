-- Despacho de Entregas · Arcos Jobim
-- PARTE 4: BLOQUEAR a empresa agora (só o desenvolvedor continua com acesso).
--
-- Rode SOMENTE depois de testar o login do desenvolvedor no site.
-- Depois disso, para liberar a empresa: entre como desenvolvedor > aba "Desenvolvedor",
-- gere um código do plano Full (ou inicie um teste grátis).

do $$
begin
  if not exists (select 1 from public.perfis where papel = 'desenvolvedor' and not bloqueado) then
    raise exception 'Crie o usuário desenvolvedor antes (arquivo 03-criar-desenvolvedor.sql). Nada foi bloqueado.';
  end if;
  update public.licenca set plano = 'bloqueado', atualizado_em = now() where id = 1;
end $$;
