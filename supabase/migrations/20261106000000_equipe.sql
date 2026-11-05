-- Tipo de acesso "Equipe": administra o portal, mas NÃO é membro
-- (não aparece no diretório, não faz onboarding, não tem resumo nem painel de oportunidades).
alter table public.membros add column if not exists equipe boolean not null default false;
alter table public.membros drop constraint if exists membros_equipe_admin;
alter table public.membros add constraint membros_equipe_admin check (not equipe or is_admin);

-- Membros comuns não enxergam os cadastros da equipe; administradores e a própria pessoa continuam vendo.
drop policy if exists membros_select on public.membros;
create policy membros_select on public.membros for select to authenticated
  using (((ativo = true) and (not equipe) and (select private.membro_ativo()))
         or (auth_user_id = (select auth.uid()))
         or (select private.is_admin()));
drop policy if exists membros_select_authenticated on public.membros;
create policy membros_select_authenticated on public.membros for select to authenticated
  using ((ativo = true) and (not equipe) and (select private.membro_ativo()));

-- Só administrador muda o tipo de acesso.
create or replace function private.proteger_colunas_membro()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'authenticated' and not private.is_admin()
     and coalesce(current_setting('app.publicando_resumo', true), '') <> 'sim' then
    if new.ativo is distinct from old.ativo
       or new.is_admin is distinct from old.is_admin
       or new.equipe is distinct from old.equipe
       or new.email is distinct from old.email
       or new.auth_user_id is distinct from old.auth_user_id
       or new.resumo_publico is distinct from old.resumo_publico
       or new.resumo_publicado_em is distinct from old.resumo_publicado_em then
      raise exception 'Somente o administrador pode alterar esses campos';
    end if;
  end if;
  return new;
end; $$;
