-- ArcoRota · PARTE 7: link de acompanhamento para o cliente (sem login).
--
-- Cole TODO este arquivo no Supabase: SQL Editor > New query > Run.
-- Rode ANTES de enviar os arquivos novos do site. Pode rodar de novo sem problema.
-- Não apaga nada. O cliente só enxerga UMA entrega, pelo link secreto, e só o necessário:
-- situação, prazo, primeiro nome do motorista, local de destino e a posição do motorista
-- enquanto a entrega estiver em rota. Sem telefone, sem endereço completo, sem dados de outros pedidos.

alter table public.entregas add column if not exists acompanhar_token text;
create unique index if not exists entregas_acompanhar_idx on public.entregas (acompanhar_token) where acompanhar_token is not null;

-- Administrador gera (ou reaproveita) o link de uma entrega. Devolve o código secreto (64 letras/números).
create or replace function public.gerar_link_acompanhamento(p_id bigint) returns text
  language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not public.eh_admin() then raise exception 'Acesso negado.'; end if;
  update public.entregas
     set acompanhar_token = coalesce(acompanhar_token, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
   where id = p_id
   returning acompanhar_token into t;
  if t is null then raise exception 'Entrega não encontrada.'; end if;
  return t;
end $$;

-- Página pública do cliente. Sem login: quem tem o código secreto vê o andamento desta entrega.
create or replace function public.acompanhar(p_token text) returns json
  language plpgsql stable security definer set search_path = public as $$
declare e public.entregas%rowtype; v_mot text; plat double precision; plng double precision; pem timestamptz;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  if not public.plano_ativo() then return null; end if;
  select * into e from public.entregas where acompanhar_token = p_token;
  if not found then return null; end if;
  if e.concluido_em is not null and now() - e.concluido_em > interval '24 hours' then
    return json_build_object('expirado', true);
  end if;
  select split_part(c.nome, ' ', 1) into v_mot from public.colaboradores c where c.id = e.motorista_id;
  if e.status = 'em_rota' then
    select lat, lng, em into plat, plng, pem from public.posicoes
      where motorista_id = e.motorista_id order by em desc limit 1;
    if pem is not null and pem < now() - interval '10 minutes' then plat := null; plng := null; pem := null; end if;
  end if;
  return json_build_object(
    'tipo', e.tipo, 'status', e.status, 'cliente', e.cliente, 'prazo', e.prazo,
    'saida_em', e.saida_em, 'concluido_em', e.concluido_em,
    'motorista', v_mot, 'destino_lat', e.lat, 'destino_lng', e.lng,
    'pos_lat', plat, 'pos_lng', plng, 'pos_em', pem);
end $$;

do $$
begin
  revoke all on function public.gerar_link_acompanhamento(bigint) from public, anon;
  grant execute on function public.gerar_link_acompanhamento(bigint) to authenticated;
  revoke all on function public.acompanhar(text) from public;
  grant execute on function public.acompanhar(text) to anon, authenticated;
end $$;
