-- Conteúdo, parte 2: vídeo exclusivo para membros, "Continuar assistindo" e "Minha lista".
alter table public.conteudos add column if not exists exclusivo boolean not null default false;

-- Onde cada membro parou em cada vídeo (só ele vê o próprio).
create table if not exists public.conteudo_progresso (
  user_id uuid not null default auth.uid(),
  conteudo_id uuid not null references public.conteudos (id) on delete cascade,
  segundos integer not null default 0,
  duracao integer,
  concluido boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, conteudo_id)
);
alter table public.conteudo_progresso enable row level security;
revoke all on public.conteudo_progresso from anon;
create policy "progresso_proprio" on public.conteudo_progresso for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select private.membro_ativo() or private.is_admin()));
grant select, insert, update, delete on public.conteudo_progresso to authenticated;

-- "Minha lista": vídeos salvos para ver depois.
create table if not exists public.conteudo_favoritos (
  user_id uuid not null default auth.uid(),
  conteudo_id uuid not null references public.conteudos (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (user_id, conteudo_id)
);
alter table public.conteudo_favoritos enable row level security;
revoke all on public.conteudo_favoritos from anon;
create policy "favoritos_proprios" on public.conteudo_favoritos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select private.membro_ativo() or private.is_admin()));
grant select, insert, update, delete on public.conteudo_favoritos to authenticated;
