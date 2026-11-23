-- Fluxo do contrato do membro NOVO (23/11/2026):
--   "+ Novo membro" (opção marcada) -> WhatsApp com o link do formulário do contrato
--   -> membro preenche -> contrato gerado do modelo -> Administração > Contratos (revisar / editar / salvar / enviar)
--   -> Autentique (membro, Mennandro e testemunhas) -> todas as assinaturas -> mensagem de boas-vindas que já existe.
-- Os membros que já estão no portal não passam por isso (os contratos deles já estão assinados na Autentique).

alter table public.contratos drop constraint if exists contratos_status_check;
alter table public.contratos add constraint contratos_status_check
  check (status in ('aguardando_formulario', 'revisao', 'rascunho', 'enviado', 'assinado', 'cancelado'));
alter table public.contratos drop constraint if exists contratos_origem_check;
alter table public.contratos add constraint contratos_origem_check check (origem in ('manual', 'onboarding', 'formulario'));

alter table public.contratos
  add column if not exists token uuid not null default gen_random_uuid(),   -- link do formulário (só quem recebeu o link abre)
  add column if not exists socio boolean not null default false,            -- contrato com 2 participantes
  add column if not exists dados jsonb,                                     -- respostas do formulário (dados pessoais: só admins)
  add column if not exists texto text,                                      -- texto do contrato (gerado do modelo, editável na revisão)
  add column if not exists formulario_enviado_em timestamptz,
  add column if not exists formulario_respondido_em timestamptz,
  add column if not exists whatsapp_erro text,
  add column if not exists autentique_id text,
  add column if not exists autentique_teste boolean not null default false, -- documento de teste (sandbox), sem validade
  add column if not exists assinaturas jsonb,                               -- [{nome, papel, link, assinado_em, recusado_em}]
  add column if not exists verificado_em timestamptz,
  add column if not exists google_enviado_em timestamptz,
  add column if not exists google_erro text,
  add column if not exists boas_vindas_em timestamptz;
create unique index if not exists contratos_token_idx on public.contratos (token);

-- Quem assina pelo Ecossistema e as testemunhas (editável aqui, sem mexer no código). O WhatsApp vem do cadastro de cada um.
insert into public.portal_config (chave, valor) values
  ('contrato_assinantes', '[{"nome":"Mennandro Machado","acao":"SIGN","papel":"Contratada"},{"nome":"Rodrigo Aureliano","acao":"SIGN_AS_A_WITNESS","papel":"Testemunha"},{"nome":"Cintia Nepomuceno","acao":"SIGN_AS_A_WITNESS","papel":"Testemunha"}]')
on conflict (chave) do nothing;
-- Texto-modelo do contrato (vem do último contrato padrão da Autentique; a função "contratos" preenche). Fica no banco, não no código.
insert into public.portal_config (chave, valor) values ('contrato_modelo', null) on conflict (chave) do nothing;

-- Verifica as assinaturas na Autentique a cada 10 minutos (só contratos enviados).
select cron.unschedule('contratos-verificar') where exists (select 1 from cron.job where jobname = 'contratos-verificar');
select cron.schedule('contratos-verificar', '*/10 * * * *', $$select private.chamar_funcao('contratos', '{"varredura": true}'::jsonb)$$);

-- Todas as assinaturas concluídas: dispara a mensagem de boas-vindas que já existe (cartão de membro), pela função "decidir-acesso".
-- Só a função "contratos" (service_role) chama.
create or replace function public.contrato_boas_vindas(p_membro_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.chamar_funcao('decidir-acesso', jsonb_build_object('acao', 'boas_vindas', 'membro_id', p_membro_id));
end;
$$;
revoke all on function public.contrato_boas_vindas(uuid) from public, anon, authenticated;
grant execute on function public.contrato_boas_vindas(uuid) to service_role;
