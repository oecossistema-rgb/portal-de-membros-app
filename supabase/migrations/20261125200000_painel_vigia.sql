-- PAINEL DA ADMINISTRAÇÃO + VIGIA (25/11/2026). Nada do que existe muda: só leitura das tabelas atuais e duas tabelas novas.
-- portal_alertas: problemas encontrados pelo vigia (com "como resolver"); somem sozinhos quando o problema acaba.
-- portal_vigia: quando o vigia verificou pela última vez (se ficar velho, o próprio painel acusa que o vigia parou).
-- painel_resumo(): números e pendências do painel, calculados na hora a partir das tabelas (só administradores).
-- O vigia (função "vigia", de hora em hora, sem IA) usa vigia_dados_internos() e vigia_registrar().

create table if not exists public.portal_alertas (
  chave text primary key,
  origem text not null default 'vigia',
  nivel text not null default 'erro' check (nivel in ('erro', 'atencao')),
  titulo text not null,
  detalhe text,
  como_resolver text,
  aba text,
  primeira_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now(),
  resolvido_em timestamptz
);
alter table public.portal_alertas enable row level security;
revoke all on public.portal_alertas from anon;
drop policy if exists "alertas_admin_le" on public.portal_alertas;
create policy "alertas_admin_le" on public.portal_alertas for select to authenticated using ((select private.is_admin()));

create table if not exists public.portal_vigia (
  id int primary key default 1 check (id = 1),
  verificado_em timestamptz,
  resultado jsonb
);
alter table public.portal_vigia enable row level security;
revoke all on public.portal_vigia from anon;
drop policy if exists "vigia_admin_le" on public.portal_vigia;
create policy "vigia_admin_le" on public.portal_vigia for select to authenticated using ((select private.is_admin()));

-- Rotinas do banco (pg_cron) e chamadas internas às funções (pg_net) que falharam.
create or replace function public.vigia_dados_internos() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'rotinas', (select coalesce(jsonb_agg(jsonb_build_object(
        'nome', j.jobname, 'agenda', j.schedule, 'ativa', j.active,
        'ultima', (select max(d.start_time) from cron.job_run_details d where d.jobid = j.jobid),
        'falhas_2h', (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed' and d.start_time > now() - interval '2 hours'),
        'erro', (select left(d.return_message, 200) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed' order by d.start_time desc limit 1)
      )), '[]'::jsonb) from cron.job j),
    'http_falhas_1h', (select count(*) from net._http_response r where r.created > now() - interval '1 hour' and (r.status_code >= 500 or r.timed_out or r.error_msg is not null)),
    'http_exemplo', (select left(coalesce(r.error_msg, r.content::text), 200) from net._http_response r where r.created > now() - interval '1 hour' and (r.status_code >= 500 or r.timed_out or r.error_msg is not null) order by r.created desc limit 1)
  );
$$;

-- Grava o resultado do vigia: alertas atuais entram (ou são atualizados); os do vigia que não apareceram mais ficam resolvidos.
create or replace function public.vigia_registrar(p_alertas jsonb, p_resultado jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare a jsonb;
begin
  for a in select * from jsonb_array_elements(coalesce(p_alertas, '[]'::jsonb)) loop
    insert into public.portal_alertas as t (chave, origem, nivel, titulo, detalhe, como_resolver, aba)
    values (a->>'chave', 'vigia', coalesce(a->>'nivel', 'erro'), a->>'titulo', a->>'detalhe', a->>'como_resolver', a->>'aba')
    on conflict (chave) do update set nivel = excluded.nivel, titulo = excluded.titulo, detalhe = excluded.detalhe,
      como_resolver = excluded.como_resolver, aba = excluded.aba, ultima_vez = now(),
      primeira_vez = case when t.resolvido_em is not null then now() else t.primeira_vez end, resolvido_em = null;
  end loop;
  update public.portal_alertas set resolvido_em = now()
   where origem = 'vigia' and resolvido_em is null
     and chave not in (select x->>'chave' from jsonb_array_elements(coalesce(p_alertas, '[]'::jsonb)) x);
  insert into public.portal_vigia (id, verificado_em, resultado) values (1, now(), p_resultado)
  on conflict (id) do update set verificado_em = now(), resultado = excluded.resultado;
end; $$;

revoke all on function public.vigia_dados_internos() from public, anon, authenticated;
revoke all on function public.vigia_registrar(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.vigia_dados_internos() to service_role;
grant execute on function public.vigia_registrar(jsonb, jsonb) to service_role;

-- Números e pendências do painel (calculados na hora). Contratos de teste ficam de fora.
create or replace function public.painel_resumo() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Bahia') at time zone 'America/Bahia';
  v_hoje date := (now() at time zone 'America/Bahia')::date;
  r jsonb;
begin
  if not private.is_admin() then raise exception 'somente administradores'; end if;
  with m as (
    select m.*, u.last_sign_in_at, o.onboarding_concluido_em, o.planilha_erro
      from public.membros m
      left join auth.users u on u.id = m.auth_user_id
      left join public.membros_onboarding o on o.membro_id = m.id
     where m.equipe = false and m.is_admin = false
  ), c as (
    select c.*, mm.nome from public.contratos c join public.membros mm on mm.id = c.membro_id
     where coalesce(c.autentique_teste, false) = false and coalesce(c.observacoes, '') <> 'TESTE'
  ), prox as (
    select e.* from public.eventos e where e.ativo and e.data_inicio >= v_hoje order by e.data_inicio limit 1
  ), ult as (
    select e.* from public.eventos e where e.data_inicio < v_hoje order by e.data_inicio desc limit 1
  )
  select jsonb_build_object(
    'membros', jsonb_build_object(
      'ativos', (select count(*) from m where ativo and not contrato_pendente),
      'novos_mes', (select count(*) from m where ativo and created_at >= v_mes),
      'sem_senha', (select count(*) from m where ativo and auth_user_id is null),
      'onboarding_pendente', (select count(*) from m where ativo and auth_user_id is not null and not contrato_pendente and onboarding_concluido_em is null),
      'contrato_andamento', (select count(*) from m where ativo and contrato_pendente),
      'acessaram_30d', (select count(*) from m where ativo and last_sign_in_at > now() - interval '30 days'),
      'sumidos_30d', (select count(*) from m where ativo and auth_user_id is not null and not contrato_pendente and (last_sign_in_at is null or last_sign_in_at <= now() - interval '30 days')),
      'solicitacoes', (select count(*) from public.solicitacoes_acesso s where s.status = 'pendente')
    ),
    'contratos', jsonb_build_object(
      'aguardando_formulario', (select count(*) from c where status = 'aguardando_formulario'),
      'revisao', (select count(*) from c where status = 'revisao'),
      'enviado', (select count(*) from c where status = 'enviado'),
      'assinados_mes', (select count(*) from c where status = 'assinado' and assinado_em >= v_mes),
      'vencendo_60d', (select count(*) from c where status = 'assinado' and vigencia_fim between v_hoje and v_hoje + 60
                        and not exists (select 1 from public.contratos x where x.renovacao_de = c.id and x.status <> 'cancelado')),
      'vencidos', (select count(*) from c where status = 'assinado' and vigencia_fim < v_hoje
                        and not exists (select 1 from public.contratos x where x.renovacao_de = c.id and x.status <> 'cancelado')),
      'autentique_mes', (select count(*) from public.contratos x where x.autentique_id is not null and x.enviado_em >= v_mes and coalesce(x.autentique_teste, false) = false)
    ),
    'eventos', jsonb_build_object(
      'proximo', (select jsonb_build_object('titulo', p.titulo, 'data', p.data_inicio, 'vagas', p.vagas,
                   'confirmados', (select count(*) from public.presencas pr where pr.evento_id = p.id),
                   'fila', (select count(*) from public.eventos_lista l where l.evento_id = p.id and l.tipo = 'fila')) from prox p),
      'ultimo', (select jsonb_build_object('titulo', u.titulo, 'data', u.data_inicio,
                   'presentes', (select count(*) from public.presencas pr where pr.evento_id = u.id)) from ult u)
    ),
    -- "Precisa de você": tudo que está parado ou com erro, direto das tabelas (aparece na hora, sem esperar o vigia).
    'pendencias', coalesce((select jsonb_agg(p order by p->>'nivel', p->>'desde') from (
        select jsonb_build_object('nivel', 'acao', 'aba', 'contratos', 'titulo', 'Contrato para revisar e enviar', 'quem', nome, 'desde', formulario_respondido_em,
               'como', 'Abra em Contratos, confira o que está em vermelho e clique em Enviar para assinatura.') p from c where status = 'revisao'
        union all
        select jsonb_build_object('nivel', 'atencao', 'aba', 'contratos', 'titulo', 'Formulário do contrato sem resposta há mais de 3 dias', 'quem', nome, 'desde', coalesce(formulario_enviado_em, criado_em),
               'como', 'Fale com o membro ou use Reenviar link em Contratos.') from c where status = 'aguardando_formulario' and coalesce(formulario_enviado_em, criado_em) < now() - interval '3 days'
        union all
        select jsonb_build_object('nivel', 'atencao', 'aba', 'contratos', 'titulo', 'Assinatura parada há mais de 3 dias', 'quem', nome, 'desde', enviado_em,
               'como', 'Abra o contrato, veja quem falta assinar e use Reenviar links.') from c where status = 'enviado' and enviado_em < now() - interval '3 days'
        union all
        select jsonb_build_object('nivel', 'erro', 'aba', 'contratos', 'titulo', 'Assinatura recusada na Autentique', 'quem', nome, 'desde', enviado_em,
               'como', 'Fale com quem recusou. Para refazer: cancele o contrato e envie de novo.') from c
         where status = 'enviado' and exists (select 1 from jsonb_array_elements(coalesce(assinaturas, '[]'::jsonb)) a where a->>'recusado_em' is not null)
        union all
        select jsonb_build_object('nivel', 'atencao', 'aba', 'contratos', 'titulo', 'Link de assinatura não foi pelo WhatsApp (mesmo número de outro assinante)', 'quem', nome, 'desde', enviado_em,
               'como', 'Confira o WhatsApp do cadastro. O link foi por e-mail; se preciso, copie o link na tela do contrato e envie.') from c
         where status = 'enviado' and exists (select 1 from jsonb_array_elements(coalesce(assinaturas, '[]'::jsonb)) a where a->>'aviso' is not null and a->>'assinado_em' is null)
        union all
        select jsonb_build_object('nivel', 'erro', 'aba', 'contratos', 'titulo', 'WhatsApp do formulário do contrato não foi enviado', 'quem', nome, 'desde', criado_em, 'detalhe', whatsapp_erro,
               'como', 'Confira o WhatsApp no cadastro do membro e use Reenviar link em Contratos.') from c where status = 'aguardando_formulario' and whatsapp_erro is not null
        union all
        select jsonb_build_object('nivel', 'erro', 'aba', 'contratos', 'titulo', 'Dados do contrato não chegaram na planilha do Google', 'quem', nome, 'desde', formulario_respondido_em, 'detalhe', google_erro,
               'como', 'O portal tenta de novo a cada 10 minutos. Se continuar, confira se o Google Forms "Dados do Contrato" ainda aceita respostas.') from c where google_erro is not null and status <> 'cancelado'
        union all
        select jsonb_build_object('nivel', 'erro', 'aba', 'membros', 'titulo', 'Onboarding não chegou na planilha', 'quem', nome, 'desde', onboarding_concluido_em, 'detalhe', planilha_erro,
               'como', 'O portal tenta de novo a cada 10 minutos. Se continuar, confira o script da planilha de onboarding.') from m where planilha_erro is not null
        union all
        select jsonb_build_object('nivel', 'erro', 'aba', 'membros', 'titulo', 'Mensagem de acesso não foi pelo WhatsApp', 'quem', coalesce(s.nome, s.email), 'desde', s.decidido_em, 'detalhe', s.whatsapp_erro,
               'como', 'Confira o WhatsApp da pessoa e reenvie o acesso em Membros.') from public.solicitacoes_acesso s where s.whatsapp_erro is not null and s.decidido_em > now() - interval '30 days'
        union all
        select jsonb_build_object('nivel', 'acao', 'aba', 'membros', 'titulo', 'Pedido de acesso aguardando', 'quem', coalesce(s.nome, s.email), 'desde', s.criado_em,
               'como', 'Aprove ou recuse no topo da Administração.') from public.solicitacoes_acesso s where s.status = 'pendente'
        union all
        select jsonb_build_object('nivel', 'atencao', 'aba', 'contratos', 'titulo', case when vigencia_fim < v_hoje then 'Contrato vencido' else 'Contrato vence em até 60 dias' end, 'quem', nome, 'desde', vigencia_fim,
               'como', 'Abra em Contratos e use Renovar contrato.') from c
         where status = 'assinado' and vigencia_fim <= v_hoje + 60
           and not exists (select 1 from public.contratos x where x.renovacao_de = c.id and x.status <> 'cancelado')
      ) q(p)), '[]'::jsonb)
  ) into r;
  return r;
end; $$;
revoke all on function public.painel_resumo() from public, anon;
grant execute on function public.painel_resumo() to authenticated;

-- Rotina do vigia: de hora em hora, no minuto 7 (criada à parte com cron.schedule):
-- select cron.schedule('vigia', '7 * * * *', $$ select private.chamar_funcao('vigia', '{}'::jsonb); $$);
