-- Visão geral (gráficos) da Administração + registro de acessos ao portal (25/11/2026).
-- portal_acessos: um registro por membro por dia em que ele abriu o portal (para o gráfico de acessos; começa a contar hoje).
create table if not exists public.portal_acessos (
  membro_id uuid not null references public.membros(id) on delete cascade,
  dia date not null,
  primary key (membro_id, dia)
);
alter table public.portal_acessos enable row level security;
revoke all on public.portal_acessos from anon, authenticated;

create or replace function public.registrar_acesso() returns void
language sql security definer set search_path = '' as $$
  insert into public.portal_acessos (membro_id, dia)
  select m.id, (now() at time zone 'America/Bahia')::date from public.membros m where m.auth_user_id = (select auth.uid()) and m.ativo
  on conflict do nothing;
$$;
revoke all on function public.registrar_acesso() from public, anon;
grant execute on function public.registrar_acesso() to authenticated;

create or replace function public.painel_graficos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_hoje date := (now() at time zone 'America/Bahia')::date; r jsonb;
begin
  if not private.is_admin() then raise exception 'somente administradores'; end if;
  with m as (
    select m.*, u.last_sign_in_at, o.onboarding_concluido_em
      from public.membros m
      left join auth.users u on u.id = m.auth_user_id
      left join public.membros_onboarding o on o.membro_id = m.id
     where m.equipe = false and m.is_admin = false and m.ativo and not m.contrato_pendente
  ), c as (
    select c.* from public.contratos c where coalesce(c.autentique_teste, false) = false and coalesce(c.observacoes, '') <> 'TESTE' and c.status <> 'cancelado'
  )
  select jsonb_build_object(
    'funil', jsonb_build_object(
      'ativos', (select count(*) from m),
      'com_senha', (select count(*) from m where auth_user_id is not null),
      'onboarding', (select count(*) from m where onboarding_concluido_em is not null),
      'acessaram_30d', (select count(*) from m where last_sign_in_at > now() - interval '30 days')),
    'perfis', jsonb_build_object(
      'total', (select count(*) from m),
      'foto', (select count(*) from m where coalesce(foto_url, '') <> ''),
      'logo', (select count(*) from m where coalesce(logo_url, '') <> ''),
      'resumo', (select count(*) from m where resumo_publicado_em is not null),
      'produtos', (select count(*) from m where coalesce(produtos_servicos, '') <> '')),
    'contratos', jsonb_build_object(
      'aguardando_formulario', (select count(*) from c where status = 'aguardando_formulario'),
      'revisao', (select count(*) from c where status = 'revisao'),
      'enviado', (select count(*) from c where status = 'enviado'),
      'vigentes', (select count(*) from c where status = 'assinado' and (vigencia_fim is null or vigencia_fim >= v_hoje)),
      'vencidos', (select count(*) from c where status = 'assinado' and vigencia_fim < v_hoje)),
    'eventos', coalesce((select jsonb_agg(x order by x->>'data') from (
        select jsonb_build_object('titulo', e.titulo, 'data', e.data_inicio, 'vagas', e.vagas,
               'confirmados', (select count(*) from public.presencas p where p.evento_id = e.id)) x
          from public.eventos e where e.ativo and e.data_inicio >= v_hoje order by e.data_inicio limit 6) q), '[]'::jsonb),
    'acessos', coalesce((select jsonb_agg(jsonb_build_object('dia', d::date, 'membros',
               (select count(*) from public.portal_acessos a where a.dia = d::date)) order by d)
          from generate_series(v_hoje - 29, v_hoje, interval '1 day') d), '[]'::jsonb),
    'acessos_desde', (select min(dia) from public.portal_acessos)
  ) into r;
  return r;
end; $$;
revoke all on function public.painel_graficos() from public, anon;
grant execute on function public.painel_graficos() to authenticated;
