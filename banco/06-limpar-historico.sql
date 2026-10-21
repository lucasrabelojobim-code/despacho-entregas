-- Despacho de Entregas · Arcos Jobim
-- PARTE 6: limpar o histórico (SÓ o desenvolvedor), por período.
--
-- Cole TODO este arquivo no Supabase: SQL Editor > New query > Run.
-- Rode ANTES de enviar os arquivos novos do site. Pode rodar de novo sem problema.
-- Este arquivo não apaga nada por si só: só cria as funções que o botão "Limpar histórico" usa.

-- Conta o que seria apagado (não apaga nada).
create or replace function public.dev_contar_limpeza(
  p_de date, p_ate date, p_ini timestamptz, p_fim timestamptz,
  p_entregas boolean, p_abast boolean, p_gps boolean, p_abertos boolean default false
) returns json
  language plpgsql stable security definer set search_path = public as $$
declare ent int := 0; oc int := 0; ab int := 0; gps int := 0; abertos int := 0;
begin
  if not public.eh_dev() then raise exception 'Acesso negado.'; end if;
  if p_de is null or p_ate is null or p_de > p_ate then raise exception 'Período inválido.'; end if;
  select count(*) into abertos from public.entregas
    where dia between p_de and p_ate and status in ('separado','em_rota');
  if p_entregas then
    select count(*) into ent from public.entregas
      where dia between p_de and p_ate and (p_abertos or status not in ('separado','em_rota'));
    select count(*) into oc from public.ocorrencias o
      where o.entrega_id in (select id from public.entregas
                              where dia between p_de and p_ate and (p_abertos or status not in ('separado','em_rota')))
         or (o.dia between p_de and p_ate and o.entrega_id is null);
  end if;
  if p_abast then select count(*) into ab from public.abastecimentos where em >= p_ini and em <= p_fim; end if;
  if p_gps   then select count(*) into gps from public.posicoes where em >= p_ini and em <= p_fim; end if;
  return json_build_object('entregas', ent, 'ocorrencias', oc, 'abastecimentos', ab, 'posicoes', gps, 'em_aberto', abertos);
end $$;

-- Apaga de verdade. Pedidos ainda em aberto (separado / em rota) só entram se p_abertos = true.
create or replace function public.dev_limpar_historico(
  p_de date, p_ate date, p_ini timestamptz, p_fim timestamptz,
  p_entregas boolean, p_abast boolean, p_gps boolean, p_abertos boolean default false
) returns json
  language plpgsql security definer set search_path = public as $$
declare ent int := 0; oc int := 0; ab int := 0; gps int := 0; n int;
begin
  if not public.eh_dev() then raise exception 'Acesso negado.'; end if;
  if p_de is null or p_ate is null or p_de > p_ate then raise exception 'Período inválido.'; end if;
  if not (coalesce(p_entregas,false) or coalesce(p_abast,false) or coalesce(p_gps,false)) then
    raise exception 'Escolha o que apagar.';
  end if;
  if p_entregas then
    -- ocorrências das entregas apagadas saem junto (cascata); as avulsas do período saem aqui
    delete from public.ocorrencias where dia between p_de and p_ate and entrega_id is null;
    get diagnostics n = row_count; oc := oc + n;
    select count(*) into n from public.ocorrencias o
      where o.entrega_id in (select id from public.entregas
                              where dia between p_de and p_ate and (p_abertos or status not in ('separado','em_rota')));
    oc := oc + n;
    delete from public.entregas
      where dia between p_de and p_ate and (p_abertos or status not in ('separado','em_rota'));
    get diagnostics ent = row_count;
  end if;
  if p_abast then
    delete from public.abastecimentos where em >= p_ini and em <= p_fim;
    get diagnostics ab = row_count;
  end if;
  if p_gps then
    delete from public.posicoes where em >= p_ini and em <= p_fim;
    get diagnostics gps = row_count;
  end if;
  return json_build_object('entregas', ent, 'ocorrencias', oc, 'abastecimentos', ab, 'posicoes', gps);
end $$;

-- Só o desenvolvedor apaga os arquivos (fotos e assinaturas) do armazenamento.
drop policy if exists evid_del on storage.objects;
create policy evid_del on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and public.eh_dev());

do $$
declare f text;
begin
  foreach f in array array[
    'dev_contar_limpeza(date,date,timestamptz,timestamptz,boolean,boolean,boolean,boolean)',
    'dev_limpar_historico(date,date,timestamptz,timestamptz,boolean,boolean,boolean,boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
