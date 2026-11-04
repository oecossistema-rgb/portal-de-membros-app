-- RESUMO DO PERFIL GERADO POR IA (decisões de 04/11/2026)
-- - A IA lê o onboarding e escreve um resumo da empresa SEM dados sensíveis
--   (sem faturamento, metas de faturamento, limitações/pontos fracos, gargalos, desafios).
-- - O resumo só aparece para os outros membros depois de aprovado por um administrador.
-- - Respostas completas do onboarding: só administradores (o membro só as acessa enquanto preenche).
-- Reversão: 20261104150000_resumo_ia_REVERTER.sql.txt

-- 1) Resumo aprovado, na ficha pública (lida por todos os membros ativos).
alter table public.membros add column if not exists resumo_publico jsonb;
alter table public.membros add column if not exists resumo_publicado_em timestamptz;

-- 2) Rascunhos da IA: só o administrador e o próprio membro leem; ninguém grava pela API
--    (quem grava é a função gerar-resumo, com a chave de serviço).
create table public.membros_resumo (
  membro_id uuid primary key references public.membros(id) on delete cascade,
  status text not null default 'pendente' check (status in ('gerando', 'pendente', 'aprovado', 'erro')),
  rascunho jsonb,
  alertas text[],
  modelo text,
  erro text,
  gerado_em timestamptz,
  aprovado_em timestamptz,
  aprovado_por uuid,
  atualizado_em timestamptz not null default now()
);
alter table public.membros_resumo enable row level security;
revoke all on public.membros_resumo from anon;
revoke insert, update, delete, truncate, references, trigger on public.membros_resumo from authenticated;
grant select on public.membros_resumo to authenticated;
create policy "resumo_select" on public.membros_resumo for select to authenticated
  using (membro_id = (select private.meu_membro_id()) or (select private.is_admin()));

-- 3) Membro comum não altera o próprio resumo público (só pela aprovação).
create or replace function private.proteger_colunas_membro()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'authenticated' and not private.is_admin()
     and coalesce(current_setting('app.publicando_resumo', true), '') <> 'sim' then
    if new.ativo is distinct from old.ativo
       or new.is_admin is distinct from old.is_admin
       or new.email is distinct from old.email
       or new.auth_user_id is distinct from old.auth_user_id
       or new.resumo_publico is distinct from old.resumo_publico
       or new.resumo_publicado_em is distinct from old.resumo_publicado_em then
      raise exception 'Somente o administrador pode alterar esses campos';
    end if;
  end if;
  return new;
end;
$$;

-- 4) Administrador aprova (pode ter editado o texto) e publica.
create or replace function public.publicar_resumo(p_membro uuid, p_resumo jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Somente administradores'; end if;
  if p_resumo is null or jsonb_typeof(p_resumo) <> 'object' then raise exception 'Resumo invalido'; end if;
  update public.membros set resumo_publico = p_resumo, resumo_publicado_em = now() where id = p_membro;
  insert into public.membros_resumo (membro_id, status, rascunho, aprovado_em, aprovado_por, atualizado_em)
  values (p_membro, 'aprovado', p_resumo, now(), (select auth.uid()), now())
  on conflict (membro_id) do update set status = 'aprovado', rascunho = p_resumo, aprovado_em = now(),
    aprovado_por = (select auth.uid()), atualizado_em = now();
end;
$$;
revoke all on function public.publicar_resumo(uuid, jsonb) from public, anon;
grant execute on function public.publicar_resumo(uuid, jsonb) to authenticated;

-- 5) Administrador retira um resumo do ar.
create or replace function public.retirar_resumo(p_membro uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Somente administradores'; end if;
  update public.membros set resumo_publico = null, resumo_publicado_em = null where id = p_membro;
  update public.membros_resumo set status = 'pendente', aprovado_em = null, aprovado_por = null, atualizado_em = now()
   where membro_id = p_membro;
end;
$$;
revoke all on function public.retirar_resumo(uuid) from public, anon;
grant execute on function public.retirar_resumo(uuid) to authenticated;

-- 6) Respostas completas: o membro só lê as próprias ENQUANTO preenche. Depois de concluído, só admin.
alter policy "onb_select" on public.membros_onboarding
  using ((membro_id = (select private.meu_membro_id()) and onboarding_concluido_em is null) or (select private.is_admin()));
alter policy "onb_update_proprio" on public.membros_onboarding
  using (membro_id = (select private.meu_membro_id()) and onboarding_concluido_em is null)
  with check (membro_id = (select private.meu_membro_id()));
