-- ONBOARDING DO PORTAL -> PLANILHA DO GOOGLE FORMS (20/11/2026)
-- Ao concluir o onboarding no portal, as respostas vão para a planilha de respostas do Forms
-- (aba "Respostas do portal"), pela função "planilha-onboarding". Sem Make.
-- Se o Google falhar, a varredura de 10 em 10 minutos tenta de novo.
-- Reversão: 20261120120000_onboarding_para_planilha_REVERTER.sql.txt

alter table public.membros_onboarding add column if not exists planilha_enviada_em timestamptz;
alter table public.membros_onboarding add column if not exists planilha_erro text;

-- Respostas que vieram do próprio Forms (importadas) já estão na planilha: ficam marcadas para nunca reenviar.
update public.membros_onboarding set planilha_enviada_em = coalesce(onboarding_concluido_em, now())
 where planilha_enviada_em is null and (onboarding_versao like 'importado%' or onboarding_versao like 'dispensado%');

create or replace function private.onboarding_concluido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.onboarding_concluido_em is not null
     and (tg_op = 'INSERT' or old.onboarding_concluido_em is null) then
    perform private.chamar_funcao('gerar-resumo', jsonb_build_object('membro_id', new.membro_id));
    perform private.chamar_funcao('planilha-onboarding', jsonb_build_object('membro_id', new.membro_id));
  end if;
  return new;
end;
$$;

select cron.unschedule('portal-varredura');
select cron.schedule('portal-varredura', '*/10 * * * *', $c$
  select private.chamar_funcao('gerar-resumo', '{"varredura": true}'::jsonb);
  select private.chamar_funcao('gerar-oportunidades', '{"varredura": true}'::jsonb);
  select private.chamar_funcao('planilha-onboarding', '{"varredura": true}'::jsonb);
$c$);
