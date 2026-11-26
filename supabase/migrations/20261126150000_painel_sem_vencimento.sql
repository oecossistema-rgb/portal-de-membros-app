-- Saúde do sistema (26/11/2026): contrato perto de vencer não é problema e não aparece mais como pendência.
-- O vencimento fica só na aba Contratos (vigência colorida e botão Renovar). Resto da função igual.
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

      ) q(p)), '[]'::jsonb)
  ) into r;
  return r;
end; $$;
revoke all on function public.painel_resumo() from public, anon;
grant execute on function public.painel_resumo() to authenticated;
