-- ArcosRotas · Arcos Jobim
-- PARTE 9: permite o status "cancelada" nas entregas e coletas.
--   O administrador pode cancelar uma entrega que ainda não foi concluída.
--   Ela não é apagada: fica no histórico com o motivo nas observações.
--
-- Cole TODO este arquivo no Supabase: SQL Editor > New query > Run.
-- Pode rodar de novo sem problema. Não apaga nada.

alter table public.entregas drop constraint if exists entregas_status_check;
alter table public.entregas add constraint entregas_status_check
  check (status in ('separado','em_rota','entregue','entregue_problema','devolvido','enviado_errado','cancelada'));
