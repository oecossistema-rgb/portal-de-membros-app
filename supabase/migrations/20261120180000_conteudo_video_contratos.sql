-- (20/11/2026) Três novidades do portal:
-- 1) Vídeo do evento realizado (vídeo curto rodando no card da agenda; clique abre em tela cheia).
-- 2) Aba "Conteúdo": vídeos do canal do YouTube + fotos/álbuns, em grade.
-- 3) Gestão de contratos (só administradores), pronta para ser ligada ao onboarding.

-- 1) VÍDEO DO EVENTO -------------------------------------------------------------------------------
alter table public.eventos
  add column if not exists video_url text,        -- vídeo completo (arquivo .mp4 no portal, YouTube ou Drive)
  add column if not exists video_previa_url text; -- trecho curto em loop, sem som, para o card (.mp4)

-- Arquivos de mídia do portal (vídeos dos eventos, capas e fotos de Conteúdo). Público para leitura; só admins enviam.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-midia', 'portal-midia', true, 52428800, array['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "midia_admin_envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'portal-midia' and (select private.is_admin()));
create policy "midia_admin_atualiza" on storage.objects for update to authenticated
  using (bucket_id = 'portal-midia' and (select private.is_admin()));
create policy "midia_admin_apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'portal-midia' and (select private.is_admin()));

-- 2) CONTEÚDO ---------------------------------------------------------------------------------------
create table if not exists public.conteudos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('video', 'foto')),
  titulo text not null,
  descricao text,
  categoria text,                       -- ex.: "Imersões", "Business Day", "Bastidores"
  url text not null,                    -- vídeo: link do YouTube; foto: endereço da imagem
  capa_url text,                        -- miniatura (no YouTube vem sozinha)
  youtube_id text unique,               -- preenchido para vídeos do YouTube (evita repetir na sincronização)
  publicado_em timestamptz not null default now(),
  destaque boolean not null default false,
  ativo boolean not null default true,
  origem text not null default 'manual' check (origem in ('manual', 'youtube')),
  criado_em timestamptz not null default now()
);
create index if not exists conteudos_publicado_idx on public.conteudos (ativo, publicado_em desc);
alter table public.conteudos enable row level security;
revoke all on public.conteudos from anon;
create policy "conteudos_membros_veem" on public.conteudos for select to authenticated
  using (ativo and (select private.membro_ativo()) or (select private.is_admin()));
create policy "conteudos_admin_insere" on public.conteudos for insert to authenticated with check ((select private.is_admin()));
create policy "conteudos_admin_altera" on public.conteudos for update to authenticated using ((select private.is_admin()));
create policy "conteudos_admin_apaga" on public.conteudos for delete to authenticated using ((select private.is_admin()));
grant select, insert, update, delete on public.conteudos to authenticated;
grant select, insert, update on public.conteudos to service_role;

-- Configurações do portal (ex.: canal do YouTube a sincronizar).
create table if not exists public.portal_config (
  chave text primary key,
  valor text,
  atualizado_em timestamptz not null default now()
);
alter table public.portal_config enable row level security;
revoke all on public.portal_config from anon;
create policy "config_admin" on public.portal_config for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
grant select, insert, update, delete on public.portal_config to authenticated;
grant select, update on public.portal_config to service_role;

-- Sincroniza o canal do YouTube uma vez por hora (só traz vídeos novos; nada é apagado).
select cron.unschedule('youtube-sincronizar') where exists (select 1 from cron.job where jobname = 'youtube-sincronizar');
select cron.schedule('youtube-sincronizar', '17 * * * *', $c$ select private.chamar_funcao('youtube-sincronizar', '{}'::jsonb); $c$);

-- 3) CONTRATOS (só administradores) -----------------------------------------------------------------
create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros (id) on delete cascade,
  titulo text not null default 'Contrato Ecossistema Master Business',
  plano text,
  valor numeric(12, 2),
  vigencia_inicio date,
  vigencia_fim date,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'assinado', 'cancelado')),
  arquivo_path text,                    -- PDF no armazenamento privado "contratos"
  assinado_path text,                   -- PDF assinado (quando voltar)
  enviado_em timestamptz,
  assinado_em timestamptz,
  observacoes text,
  origem text not null default 'manual' check (origem in ('manual', 'onboarding')),
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists contratos_membro_idx on public.contratos (membro_id, criado_em desc);
alter table public.contratos enable row level security;
revoke all on public.contratos from anon;
create policy "contratos_admin" on public.contratos for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
grant select, insert, update, delete on public.contratos to authenticated;
grant select, insert, update on public.contratos to service_role;

create or replace function private.contrato_atualizado() returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  if new.status = 'enviado' and old.status is distinct from 'enviado' and new.enviado_em is null then new.enviado_em := now(); end if;
  if new.status = 'assinado' and old.status is distinct from 'assinado' and new.assinado_em is null then new.assinado_em := now(); end if;
  return new;
end;
$$;
drop trigger if exists contrato_atualizado on public.contratos;
create trigger contrato_atualizado before update on public.contratos for each row execute function private.contrato_atualizado();

-- PDFs dos contratos: armazenamento PRIVADO, só administradores leem e enviam.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contratos', 'contratos', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;
create policy "contratos_admin_le" on storage.objects for select to authenticated
  using (bucket_id = 'contratos' and (select private.is_admin()));
create policy "contratos_admin_envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'contratos' and (select private.is_admin()));
create policy "contratos_admin_atualiza" on storage.objects for update to authenticated
  using (bucket_id = 'contratos' and (select private.is_admin()));
create policy "contratos_admin_apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'contratos' and (select private.is_admin()));
