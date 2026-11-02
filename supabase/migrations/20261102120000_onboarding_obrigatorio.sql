-- ONBOARDING OBRIGATÓRIO (formulário "Onboarding - Ecossistema Master Business", 40 perguntas)
-- Testado no projeto "Portal Membros - TESTE onboarding" (estrutura idêntica à produção) em 02/11/2026.
-- Reversão: 20261102120000_onboarding_obrigatorio_REVERTER.sql.txt
--
-- Perguntas 1,2,3,5,7,8,34,35,39,40 continuam em public.membros (colunas que já existiam).
-- As demais vão para public.membros_onboarding, visível só para o próprio membro e administradores.

create table public.membros_onboarding (
  membro_id uuid primary key references public.membros(id) on delete cascade,
  cidade_estado text,                 -- P4 (texto como o membro digitar)
  data_fundacao date,                 -- P6
  modelo_comercial text,              -- P9 opção marcada
  modelo_comercial_outro_texto text,  -- P9 texto do "Outro:"
  modelo_comercial_outros text,       -- P10
  faturamento_mensal_atual text,      -- P11
  faturamento_meta_12m text,          -- P12
  tamanho_equipe text,                -- P13
  canais_aquisicao text[],            -- P14
  canais_aquisicao_outros text,       -- P15
  melhor_canal_hoje text,             -- P16
  principal_gargalo text,             -- P17
  avancos_12m text,                   -- P18
  visao_5anos text,                   -- P19
  faturamento_meta_5anos text,        -- P20
  papel_5anos text,                   -- P21
  legado_missao text,                 -- P22
  desafios_atuais text,               -- P23
  areas_apoio text[],                 -- P24
  areas_apoio_outro text,             -- P25 (opcional)
  decisoes_pendentes text,            -- P26
  planejamento_anual text[],          -- P27
  perfil_gestao text,                 -- P28
  ponto_forte text,                   -- P29
  maior_limitacao text,               -- P30
  grupos_mentorias text,              -- P31
  motivacao_entrada text,             -- P32
  expectativas text,                  -- P33
  comentarios text,                   -- P36
  esporte text,                       -- P37
  hobby text,                         -- P38
  etapa_atual int not null default 1,
  onboarding_versao text not null default 'google-forms-2026-11',
  onboarding_concluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.membros_onboarding enable row level security;
revoke all on public.membros_onboarding from anon;
revoke truncate, references, trigger, delete on public.membros_onboarding from authenticated;
grant select, insert, update on public.membros_onboarding to authenticated;

create or replace function private.meu_membro_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.membros where auth_user_id = (select auth.uid()) and ativo = true limit 1;
$$;
grant execute on function private.meu_membro_id() to authenticated;

create policy "onb_select" on public.membros_onboarding for select to authenticated
  using (membro_id = (select private.meu_membro_id()) or (select private.is_admin()));
create policy "onb_insert_proprio" on public.membros_onboarding for insert to authenticated
  with check (membro_id = (select private.meu_membro_id()));
create policy "onb_update_proprio" on public.membros_onboarding for update to authenticated
  using (membro_id = (select private.meu_membro_id())) with check (membro_id = (select private.meu_membro_id()));
create policy "onb_admin_update" on public.membros_onboarding for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Só a função concluir_onboarding() pode marcar como concluído.
create or replace function private.proteger_conclusao_onboarding()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'authenticated' and not private.is_admin()
     and coalesce(current_setting('app.concluindo_onboarding', true), '') <> 'sim' then
    if new.onboarding_concluido_em is distinct from (case when tg_op = 'INSERT' then null else old.onboarding_concluido_em end)
       or new.membro_id is distinct from (case when tg_op = 'INSERT' then new.membro_id else old.membro_id end) then
      raise exception 'Conclusao do onboarding so pelo envio do formulario';
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;
revoke all on function private.proteger_conclusao_onboarding() from public, anon, authenticated;
create trigger proteger_conclusao_onboarding
  before insert or update on public.membros_onboarding
  for each row execute function private.proteger_conclusao_onboarding();

-- Envio final: confere as 39 obrigatórias (todas menos a P25) e marca como concluído.
create or replace function public.concluir_onboarding()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := private.meu_membro_id();
  m public.membros;
  o public.membros_onboarding;
  faltando text[];
begin
  if v_id is null then raise exception 'Membro nao encontrado ou inativo'; end if;
  select * into m from public.membros where id = v_id;
  select * into o from public.membros_onboarding where membro_id = v_id;
  if o.membro_id is null then raise exception 'Formulario ainda nao iniciado'; end if;

  -- 39 obrigatorias (todas menos a P25, opcional no Google Forms)
  select coalesce(array_agg(c.cod order by c.ord), '{}') into faltando
  from (values
    (1,'P1',  nullif(trim(m.nome),'') is null),
    (2,'P2',  nullif(trim(m.empresa),'') is null),
    (3,'P3',  nullif(trim(m.segmento),'') is null),
    (4,'P4',  nullif(trim(o.cidade_estado),'') is null),
    (5,'P5',  nullif(trim(m.site_instagram),'') is null),
    (6,'P6',  o.data_fundacao is null),
    (7,'P7',  nullif(trim(m.produtos_servicos),'') is null),
    (8,'P8',  nullif(trim(m.modelo_negocio),'') is null),
    (9,'P9',  nullif(trim(o.modelo_comercial),'') is null),
    (10,'P10', nullif(trim(o.modelo_comercial_outros),'') is null),
    (11,'P11', nullif(trim(o.faturamento_mensal_atual),'') is null),
    (12,'P12', nullif(trim(o.faturamento_meta_12m),'') is null),
    (13,'P13', nullif(trim(o.tamanho_equipe),'') is null),
    (14,'P14', coalesce(cardinality(o.canais_aquisicao),0) = 0),
    (15,'P15', nullif(trim(o.canais_aquisicao_outros),'') is null),
    (16,'P16', nullif(trim(o.melhor_canal_hoje),'') is null),
    (17,'P17', nullif(trim(o.principal_gargalo),'') is null),
    (18,'P18', nullif(trim(o.avancos_12m),'') is null),
    (19,'P19', nullif(trim(o.visao_5anos),'') is null),
    (20,'P20', nullif(trim(o.faturamento_meta_5anos),'') is null),
    (21,'P21', nullif(trim(o.papel_5anos),'') is null),
    (22,'P22', nullif(trim(o.legado_missao),'') is null),
    (23,'P23', nullif(trim(o.desafios_atuais),'') is null),
    (24,'P24', coalesce(cardinality(o.areas_apoio),0) = 0),
    (26,'P26', nullif(trim(o.decisoes_pendentes),'') is null),
    (27,'P27', coalesce(cardinality(o.planejamento_anual),0) = 0),
    (28,'P28', nullif(trim(o.perfil_gestao),'') is null),
    (29,'P29', nullif(trim(o.ponto_forte),'') is null),
    (30,'P30', nullif(trim(o.maior_limitacao),'') is null),
    (31,'P31', nullif(trim(o.grupos_mentorias),'') is null),
    (32,'P32', nullif(trim(o.motivacao_entrada),'') is null),
    (33,'P33', nullif(trim(o.expectativas),'') is null),
    (34,'P34', nullif(trim(m.conexoes_buscadas),'') is null),
    (35,'P35', nullif(trim(m.como_pode_contribuir),'') is null),
    (36,'P36', nullif(trim(o.comentarios),'') is null),
    (37,'P37', nullif(trim(o.esporte),'') is null),
    (38,'P38', nullif(trim(o.hobby),'') is null),
    (39,'P39', nullif(trim(m.foto_url),'') is null),
    (40,'P40', nullif(trim(m.logo_url),'') is null)
  ) as c(ord, cod, vazio)
  where c.vazio;

  if cardinality(faltando) > 0 then
    return jsonb_build_object('ok', false, 'faltando', to_jsonb(faltando));
  end if;

  perform set_config('app.concluindo_onboarding', 'sim', true);
  update public.membros_onboarding set onboarding_concluido_em = now() where membro_id = v_id;
  perform set_config('app.concluindo_onboarding', '', true);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.concluir_onboarding() from public, anon;
grant execute on function public.concluir_onboarding() to authenticated;

-- BLOQUEIO: "membro ativo" passa a exigir onboarding concluído (admins ficam livres).
-- Todas as regras do portal (diretório, eventos, presenças, fotos) já usam esta função.
create or replace function private.membro_ativo()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros m
    where m.auth_user_id = (select auth.uid()) and m.ativo = true
      and (m.is_admin = true or exists (
        select 1 from public.membros_onboarding o
        where o.membro_id = m.id and o.onboarding_concluido_em is not null)));
$$;

-- Exceção: durante o onboarding o membro pode enviar foto e logo na própria pasta.
create policy "fotos_upload_onboarding" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-membros'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.meu_membro_id()) is not null);

-- Para a tela saber se deve mostrar o onboarding.
create or replace function public.meu_status_onboarding()
returns text language sql stable security definer set search_path = '' as $$
  select case
    when m.id is null then 'sem_cadastro'
    when m.is_admin then 'liberado'
    when o.onboarding_concluido_em is not null then 'liberado'
    else 'pendente' end
  from (select 1) x
  left join public.membros m on m.auth_user_id = (select auth.uid()) and m.ativo = true
  left join public.membros_onboarding o on o.membro_id = m.id;
$$;
revoke all on function public.meu_status_onboarding() from public, anon;
grant execute on function public.meu_status_onboarding() to authenticated;
