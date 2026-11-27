-- Todo erro aparece na Saúde (27/11/2026).
-- 1) Erros que alguém viu na tela (qualquer função do portal que respondeu erro, ou a tela que quebrou) ficam registrados aqui.
--    O mesmo erro não duplica: só conta "vezes" e "última vez". Fica na Saúde até alguém clicar em Resolvido.
-- 2) Rotinas automáticas (banco chamando funções) que falharam nas últimas horas também aparecem na Saúde.
-- 3) Erro de contrato (Google, WhatsApp, assinatura recusada) passa a aparecer também na Saúde (avisos de contrato continuam só em Contratos).
-- Sem dados pessoais: guarda só o texto do erro, a tela/função e quem estava logado (id).

create table if not exists public.portal_erros (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  mensagem text not null,
  detalhe text,
  quem uuid references public.membros(id) on delete set null,
  vezes int not null default 1,
  primeira_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid references public.membros(id) on delete set null
);
create unique index if not exists portal_erros_aberto_idx on public.portal_erros (origem, mensagem) where resolvido_em is null;
alter table public.portal_erros enable row level security;
create policy "portal_erros_admin" on public.portal_erros for select to authenticated using ((select private.is_admin()));
grant select on public.portal_erros to authenticated;
grant select, insert, update, delete on public.portal_erros to service_role;

-- Qualquer tela do portal registra o erro que mostrou (também o formulário público do contrato, sem login).
create or replace function public.registrar_erro(p_origem text, p_mensagem text, p_detalhe text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_quem uuid;
begin
  if coalesce(trim(p_mensagem), '') = '' then return; end if;
  -- Proteção contra abuso: no máximo 300 erros diferentes abertos.
  if (select count(*) from public.portal_erros where resolvido_em is null) >= 300 then return; end if;
  if auth.uid() is not null then select m.id into v_quem from public.membros m where m.auth_user_id = auth.uid(); end if;
  insert into public.portal_erros (origem, mensagem, detalhe, quem)
  values (left(trim(coalesce(p_origem, 'tela')), 120), left(trim(p_mensagem), 500), left(p_detalhe, 1000), v_quem)
  on conflict (origem, mensagem) where resolvido_em is null
  do update set vezes = public.portal_erros.vezes + 1, ultima_vez = now(), quem = coalesce(excluded.quem, public.portal_erros.quem),
                detalhe = coalesce(excluded.detalhe, public.portal_erros.detalhe);
end; $$;
revoke all on function public.registrar_erro(text, text, text) from public;
grant execute on function public.registrar_erro(text, text, text) to anon, authenticated;

create or replace function public.erro_resolvido(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'somente administradores'; end if;
  update public.portal_erros set resolvido_em = now(), resolvido_por = private.meu_membro_id() where id = p_id and resolvido_em is null;
end; $$;
revoke all on function public.erro_resolvido(uuid) from public;
grant execute on function public.erro_resolvido(uuid) to authenticated;

-- Lista de erros para a Saúde: erros vistos na tela + rotinas automáticas que falharam (últimas ~6 horas guardadas pelo banco)
-- + falhas de envio do disparo de WhatsApp (últimos 7 dias).
create or replace function public.painel_erros() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not private.is_admin() then raise exception 'somente administradores'; end if;
  select coalesce(jsonb_agg(x order by x->>'desde' desc), '[]'::jsonb) into r from (
    select jsonb_build_object('nivel', 'erro', 'tipo', 'tela', 'id', e.id, 'titulo', 'Erro mostrado na tela: ' || e.origem,
             'quem', m.nome, 'desde', e.primeira_vez,
             'detalhe', e.mensagem || case when e.vezes > 1 then ' (' || e.vezes || ' vezes, a última ' || to_char(e.ultima_vez at time zone 'America/Bahia', 'DD/MM HH24:MI') || ')' else '' end,
             'como', 'Se já foi resolvido, clique em Resolvido. Se continuar aparecendo, peça ao suporte para ver este erro.') x
      from public.portal_erros e left join public.membros m on m.id = e.quem where e.resolvido_em is null
    union all
    select jsonb_build_object('nivel', 'erro', 'tipo', 'rotina', 'titulo', 'Rotina automática falhou (' || count(*) || 'x nas últimas horas)',
             'desde', min(h.created),
             'detalhe', string_agg(distinct left(coalesce(h.error_msg, case when h.timed_out then 'tempo esgotado' end, 'código ' || h.status_code || ': ' || coalesce(h.content, '')), 160), ' | '),
             'como', 'O portal tenta de novo sozinho. Se continuar, peça ao suporte para olhar os registros das funções no Supabase.')
      from net._http_response h
     where h.status_code >= 400 or h.error_msg is not null or h.timed_out or h.content like '%"ok":false%'
    having count(*) > 0
    union all
    select jsonb_build_object('nivel', 'erro', 'tipo', 'whatsapp', 'aba', 'whatsapp', 'titulo', 'Disparo de WhatsApp com mensagens que falharam',
             'quem', d.titulo, 'desde', min(d.criado_em), 'detalhe', count(*) || ' falha(s): ' || string_agg(distinct coalesce(e.motivo, 'sem motivo'), ', '),
             'como', 'Confira o WhatsApp do cadastro de quem falhou (relatório do disparo) e se o WhatsApp do portal está conectado.')
      from public.wa_envios e join public.wa_disparos d on d.id = e.disparo_id
     where e.status = 'falha' and d.criado_em > now() - interval '7 days'
     group by d.id, d.titulo
  ) q;
  return r;
end; $$;
revoke all on function public.painel_erros() from public;
grant execute on function public.painel_erros() to authenticated;
