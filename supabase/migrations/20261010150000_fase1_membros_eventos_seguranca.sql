-- Fase 1: lista de membros autorizados, administrador, eventos no banco e RLS revisada.
-- Aplicada em 10/10/2026 em partes (fase1_parte1..parte6). Diferença: as policies antigas
-- "membros_select_authenticated" e "Usuario registra sua propria presenca" foram ajustadas
-- com ALTER POLICY em vez de removidas, com o mesmo efeito.

-- ---------- membros ----------
alter table public.membros add column if not exists is_admin boolean not null default false;
create index if not exists membros_auth_user_id_idx on public.membros (auth_user_id);

-- ---------- funções auxiliares (fora do schema exposto pela API) ----------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.membro_ativo()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros
    where auth_user_id = (select auth.uid()) and ativo = true
  );
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros
    where auth_user_id = (select auth.uid()) and ativo = true and is_admin = true
  );
$$;

revoke all on function private.membro_ativo() from public, anon;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.membro_ativo() to authenticated;
grant execute on function private.is_admin() to authenticated;

-- ---------- vínculo automático: conta criada -> membro pré-cadastrado (por e-mail) ----------
create or replace function private.vincular_membro()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.membros
     set auth_user_id = new.id
   where lower(email) = lower(new.email)
     and auth_user_id is null;
  return new;
end;
$$;
revoke all on function private.vincular_membro() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_vincular_membro on auth.users;
create trigger on_auth_user_created_vincular_membro
  after insert on auth.users
  for each row execute function private.vincular_membro();

-- ---------- proteção de colunas: só admin altera ativo, is_admin, email e vínculo ----------
create or replace function private.proteger_colunas_membro()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'authenticated' and not private.is_admin() then
    if new.ativo is distinct from old.ativo
       or new.is_admin is distinct from old.is_admin
       or new.email is distinct from old.email
       or new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'Somente o administrador pode alterar esses campos';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.proteger_colunas_membro() from public, anon, authenticated;

drop trigger if exists proteger_colunas_membro on public.membros;
create trigger proteger_colunas_membro
  before update on public.membros
  for each row execute function private.proteger_colunas_membro();

-- ---------- permissões e policies: membros ----------
revoke all on public.membros from anon;
revoke truncate, references, trigger on public.membros from authenticated;
grant select, insert, update, delete on public.membros to authenticated;

drop policy if exists "membros_select_authenticated" on public.membros;
drop policy if exists "membros_select" on public.membros;
drop policy if exists "membros_update_proprio" on public.membros;
drop policy if exists "membros_admin_insert" on public.membros;
drop policy if exists "membros_admin_update" on public.membros;
drop policy if exists "membros_admin_delete" on public.membros;

create policy "membros_select" on public.membros for select to authenticated
  using (
    (ativo = true and (select private.membro_ativo()))
    or auth_user_id = (select auth.uid())
    or (select private.is_admin())
  );

create policy "membros_update_proprio" on public.membros for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create policy "membros_admin_insert" on public.membros for insert to authenticated
  with check ((select private.is_admin()));
create policy "membros_admin_update" on public.membros for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "membros_admin_delete" on public.membros for delete to authenticated
  using ((select private.is_admin()));

-- ---------- eventos ----------
create table if not exists public.eventos (
  id text primary key,
  trilha text not null check (trilha in ('imersao', 'business-day', 'growth', 'conselho')),
  titulo text not null,
  quando text not null,
  dia_semana text,
  data_inicio date not null,
  inscricoes_abertas boolean not null default true,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.eventos enable row level security;
revoke all on public.eventos from anon;
grant select, insert, update, delete on public.eventos to authenticated;

create policy "eventos_select_membros" on public.eventos for select to authenticated
  using ((ativo = true and (select private.membro_ativo())) or (select private.is_admin()));
create policy "eventos_admin_insert" on public.eventos for insert to authenticated
  with check ((select private.is_admin()));
create policy "eventos_admin_update" on public.eventos for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "eventos_admin_delete" on public.eventos for delete to authenticated
  using ((select private.is_admin()));

insert into public.eventos (id, trilha, titulo, quando, dia_semana, data_inicio) values
  ('gs-ago-2026', 'growth', 'Growth Session', '19 de Agosto de 2026', 'Quarta-feira', '2026-08-19'),
  ('conselho-set-2026', 'conselho', 'Reunião de Conselho', '16 de Setembro de 2026', 'Quarta-feira', '2026-09-16'),
  ('gs-out-2026', 'growth', 'Growth Session', '14 de Outubro de 2026', 'Quarta-feira', '2026-10-14'),
  ('imersao-nov-2026', 'imersao', 'Imersão Ecossistema Master Business', '13 e 14 de Novembro de 2026', 'Sexta e Sábado', '2026-11-13'),
  ('conselho-nov-2026', 'conselho', 'Reunião de Conselho', '18 de Novembro de 2026', 'Quarta-feira', '2026-11-18'),
  ('business-day-2026', 'business-day', 'Ecossistema Business Day', '28 de Novembro de 2026', 'Sábado', '2026-11-28'),
  ('gs-dez-2026', 'growth', 'Growth Session', '16 de Dezembro de 2026', 'Quarta-feira', '2026-12-16'),
  ('conselho-jan-2027', 'conselho', 'Reunião de Conselho', '13 de Janeiro de 2027', 'Quarta-feira', '2027-01-13'),
  ('gs-fev-2027', 'growth', 'Growth Session', '17 de Fevereiro de 2027', 'Quarta-feira', '2027-02-17'),
  ('conselho-mar-2027', 'conselho', 'Reunião de Conselho', '17 de Março de 2027', 'Quarta-feira', '2027-03-17'),
  ('imersao-mar-2027', 'imersao', 'Imersão Ecossistema Master Business', '26 e 27 de Março de 2027', 'Sexta e Sábado', '2027-03-26'),
  ('gs-abr-2027', 'growth', 'Growth Session', '14 de Abril de 2027', 'Quarta-feira', '2027-04-14'),
  ('conselho-mai-2027', 'conselho', 'Reunião de Conselho', '12 de Maio de 2027', 'Quarta-feira', '2027-05-12'),
  ('imersao-jul-2027', 'imersao', 'Imersão Ecossistema Master Business', '23 e 24 de Julho de 2027', 'Sexta e Sábado', '2027-07-23'),
  ('imersao-nov-2027', 'imersao', 'Imersão Ecossistema Master Business', '12 e 13 de Novembro de 2027', 'Sexta e Sábado', '2027-11-12')
on conflict (id) do nothing;

-- ---------- presencas ----------
alter table public.presencas
  drop constraint if exists presencas_evento_id_fkey,
  add constraint presencas_evento_id_fkey foreign key (evento_id) references public.eventos (id) on delete cascade;
create index if not exists presencas_evento_id_idx on public.presencas (evento_id);

revoke all on public.presencas from anon;
revoke truncate, references, trigger, update on public.presencas from authenticated;

drop policy if exists "Usuario visualiza suas presencas" on public.presencas;
drop policy if exists "Usuario registra sua propria presenca" on public.presencas;
drop policy if exists "Usuario remove sua propria presenca" on public.presencas;

create policy "presencas_select" on public.presencas for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "presencas_insert_membro" on public.presencas for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.membro_ativo()));
create policy "presencas_delete" on public.presencas for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- ---------- alerta do advisor ----------
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
