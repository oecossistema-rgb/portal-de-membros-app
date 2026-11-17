-- AUTOMAÇÃO DO RESUMO E DAS OPORTUNIDADES (decisões de 17/11/2026)
-- 1) Concluiu o onboarding (pelo portal ou importado) -> o banco chama "gerar-resumo" sozinho.
-- 2) Resumo limpo nas duas travas -> publica sozinho e monta o painel de oportunidades do membro.
--    Algo sensível -> fica "pendente" para um administrador revisar.
-- 3) A cada 10 minutos, uma varredura: resumos que faltaram e painéis que precisam incluir o membro novo.
-- O código interno que autoriza essas chamadas é gerado AQUI, aleatório, guardado no cofre (vault)
-- do Supabase. Ninguém digita nem vê esse código.
-- Reversão: 20261117200000_automacao_REVERTER.sql.txt

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Código interno (32 bytes aleatórios), só no cofre.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'portal_interno',
  'Autoriza chamadas do banco às funções gerar-resumo e gerar-oportunidades')
where not exists (select 1 from vault.secrets where name = 'portal_interno');

-- As funções conferem o código recebido (só a chave de serviço pode perguntar).
create or replace function public.token_interno_valido(p_token text)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'portal_interno' and decrypted_secret = p_token);
$$;
revoke all on function public.token_interno_valido(text) from public, anon, authenticated;
grant execute on function public.token_interno_valido(text) to service_role;

-- Chamada de uma função a partir do banco (não espera a resposta; não trava a gravação do onboarding).
create or replace function private.chamar_funcao(p_funcao text, p_corpo jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'portal_interno';
  if v_token is null then return; end if;
  perform net.http_post(
    url := 'https://tpsujbvwpqptrzeqcgcb.supabase.co/functions/v1/' || p_funcao,
    body := p_corpo,
    headers := jsonb_build_object('content-type', 'application/json', 'x-portal-interno', v_token),
    timeout_milliseconds := 290000
  );
end;
$$;
revoke all on function private.chamar_funcao(text, jsonb) from public, anon, authenticated;

-- Gatilho: onboarding acabou de ser concluído.
create or replace function private.onboarding_concluido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.onboarding_concluido_em is not null
     and (tg_op = 'INSERT' or old.onboarding_concluido_em is null) then
    perform private.chamar_funcao('gerar-resumo', jsonb_build_object('membro_id', new.membro_id));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_onboarding_concluido on public.membros_onboarding;
create trigger trg_onboarding_concluido
  after insert or update of onboarding_concluido_em on public.membros_onboarding
  for each row execute function private.onboarding_concluido();

-- Quando cada painel foi montado (só as funções leem e gravam).
create table if not exists public.membros_painel_estado (
  membro_id uuid primary key references public.membros(id) on delete cascade,
  gerado_em timestamptz,
  tentado_em timestamptz
);
alter table public.membros_painel_estado enable row level security;
revoke all on public.membros_painel_estado from anon, authenticated;
grant select, insert, update, delete on public.membros_painel_estado to service_role;
-- Os painéis que já existem contam como atualizados agora (não refaz os 60 de uma vez).
insert into public.membros_painel_estado (membro_id, gerado_em, tentado_em)
select distinct membro_id, now(), now() from public.membros_oportunidades
on conflict (membro_id) do nothing;

-- Varredura a cada 10 minutos.
select cron.unschedule('portal-varredura') where exists (select 1 from cron.job where jobname = 'portal-varredura');
select cron.schedule('portal-varredura', '*/10 * * * *', $$
  select private.chamar_funcao('gerar-resumo', '{"varredura": true}'::jsonb);
  select private.chamar_funcao('gerar-oportunidades', '{"varredura": true}'::jsonb);
$$);
