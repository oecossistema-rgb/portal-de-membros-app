-- SOLICITAÇÃO DE ACESSO (19/11/2026)
-- Quem cria a senha sem estar pré-cadastrado deixa de ficar parado em "acesso não liberado":
-- preenche nome, WhatsApp e empresa e vira uma solicitação em aberto na Administração.
-- O administrador aprova (vira membro ativo e recebe WhatsApp) ou recusa.
-- A aprovação/recusa é feita pela função "decidir-acesso" (chave de serviço), nunca direto do navegador.
-- Reversão: 20261119190000_solicitacoes_acesso_REVERTER.sql.txt

create table if not exists public.solicitacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  nome text not null,
  whatsapp text not null,
  empresa text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por uuid references public.membros(id) on delete set null,
  membro_id uuid references public.membros(id) on delete set null,
  whatsapp_enviado_em timestamptz,
  whatsapp_erro text
);
alter table public.solicitacoes_acesso enable row level security;
revoke all on public.solicitacoes_acesso from anon, authenticated;
grant select on public.solicitacoes_acesso to authenticated;
grant select, insert, update, delete on public.solicitacoes_acesso to service_role;

-- Cada pessoa vê só a própria solicitação; administradores veem todas. Ninguém grava direto.
drop policy if exists sol_select on public.solicitacoes_acesso;
create policy sol_select on public.solicitacoes_acesso for select to authenticated
  using (auth_user_id = (select auth.uid()) or (select private.is_admin()));

-- O próprio usuário logado pede acesso (ou atualiza o pedido enquanto estiver pendente/recusado).
create or replace function public.solicitar_acesso(p_nome text, p_whatsapp text, p_empresa text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_email text; v_fone text;
begin
  if v_uid is null then raise exception 'não autenticado'; end if;
  if exists (select 1 from public.membros where auth_user_id = v_uid and ativo) then return 'ja_liberado'; end if;
  v_fone := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if length(trim(coalesce(p_nome, ''))) < 2 or length(v_fone) < 10 or length(trim(coalesce(p_empresa, ''))) < 2 then
    raise exception 'preencha nome, WhatsApp com DDD e empresa';
  end if;
  select email into v_email from auth.users where id = v_uid;
  insert into public.solicitacoes_acesso (auth_user_id, email, nome, whatsapp, empresa)
  values (v_uid, lower(v_email), left(trim(p_nome), 120), left(v_fone, 15), left(trim(p_empresa), 120))
  on conflict (auth_user_id) do update
    set nome = excluded.nome, whatsapp = excluded.whatsapp, empresa = excluded.empresa,
        status = 'pendente', criado_em = now(), decidido_em = null, decidido_por = null
    where public.solicitacoes_acesso.status <> 'aprovada';
  return 'pendente';
end;
$$;
revoke all on function public.solicitar_acesso(text, text, text) from public, anon;
grant execute on function public.solicitar_acesso(text, text, text) to authenticated;
