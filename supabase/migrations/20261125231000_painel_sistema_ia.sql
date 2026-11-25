-- (redefine a de 20261125220000 com o gasto da IA)
-- Saúde do sistema em gráficos (25/11/2026): rotinas, chamadas internas, IA e custos. Só leitura, só administradores.
create or replace function public.painel_sistema() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_mes timestamptz := date_trunc('month', now() at time zone 'America/Bahia') at time zone 'America/Bahia'; r jsonb;
begin
  if not private.is_admin() then raise exception 'somente administradores'; end if;
  select jsonb_build_object(
    'rotinas', (select coalesce(jsonb_agg(jsonb_build_object(
        'nome', j.jobname, 'agenda', j.schedule, 'ativa', j.active,
        'ultima', (select max(d.start_time) from cron.job_run_details d where d.jobid = j.jobid),
        'execucoes_24h', (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.start_time > now() - interval '24 hours'),
        'falhas_24h', (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed' and d.start_time > now() - interval '24 hours'),
        'funcoes', greatest(1, (length(j.command) - length(replace(j.command, 'chamar_funcao', ''))) / length('chamar_funcao'))
      ) order by j.jobname), '[]'::jsonb) from cron.job j),
    'chamadas_6h', jsonb_build_object(
      'ok', (select count(*) from net._http_response x where x.created > now() - interval '6 hours' and x.status_code between 200 and 499 and not x.timed_out and x.error_msg is null),
      'erro', (select count(*) from net._http_response x where x.created > now() - interval '6 hours' and (x.status_code >= 500 or x.timed_out or x.error_msg is not null))),
    'ia_mes', jsonb_build_object(
      'resumos', (select count(*) from public.membros_resumo x where x.gerado_em >= v_mes),
      'oportunidades', (select count(distinct (x.membro_id, (x.gerado_em at time zone 'America/Bahia')::date)) from public.membros_oportunidades x where x.gerado_em >= v_mes)),
    'autentique_mes', (select count(*) from public.contratos x where x.autentique_id is not null and x.enviado_em >= v_mes and coalesce(x.autentique_teste, false) = false),
    'ia_custo', jsonb_build_object('mes', private.custo_ia(v_mes), 'hoje', private.custo_ia(date_trunc('day', now() at time zone 'America/Bahia') at time zone 'America/Bahia'),
      'desde', (select min(criado_em) from public.portal_uso_ia), 'preco', (select valor::jsonb from public.portal_config where chave = 'preco_ia')),
    'alertas_resolvidos_30d', (select count(*) from public.portal_alertas a where a.resolvido_em > now() - interval '30 days')
  ) into r;
  return r;
end; $$;
revoke all on function public.painel_sistema() from public, anon;
grant execute on function public.painel_sistema() to authenticated;
