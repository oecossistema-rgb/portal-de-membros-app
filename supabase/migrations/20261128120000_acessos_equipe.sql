-- Fase 2 · Etapa 1 (28/11/2026): acessos da equipe por setor + registro de atividades.
-- Estrutura PRONTA e DESLIGADA: quem é administrador hoje (Mennandro, Rodrigo, Cíntia) continua vendo tudo, como sempre.
-- Quando liberarem um setor, basta colocar a pessoa no setor; as permissões já estão definidas por área.

-- Setores da equipe (lista editável).
create table if not exists public.equipe_setores (
  id text primary key,
  nome text not null,
  ordem int not null default 0
);
insert into public.equipe_setores (id, nome, ordem) values
  ('diretoria', 'Diretoria', 1), ('relacionamento', 'Relacionamento / Mentoria', 2), ('marketing', 'Marketing e Conteúdo', 3),
  ('financeiro', 'Financeiro', 4), ('relacoes_publicas', 'Relações Públicas', 5), ('operacao', 'Operação', 6), ('comercial', 'Comercial', 7)
on conflict (id) do nothing;

-- Áreas da área da equipe (os grupos do menu) e o nível de cada setor: nenhum / ver / editar.
create table if not exists public.equipe_permissoes (
  setor text not null references public.equipe_setores(id) on delete cascade,
  area text not null,
  nivel text not null default 'nenhum' check (nivel in ('nenhum', 'ver', 'editar')),
  primary key (setor, area)
);
-- Padrões propostos no plano (ajustáveis na tela "Usuários e setores").
insert into public.equipe_permissoes (setor, area, nivel)
select s.id, a.area,
  case
    when s.id = 'diretoria' then 'editar'
    when s.id = 'relacionamento' and a.area in ('carteiras', 'jornada', 'reunioes', 'conversas') then 'editar'
    when s.id = 'relacionamento' and a.area in ('visao', 'membros', 'eventos', 'pedidos_ajuda', 'indicacoes') then 'ver'
    when s.id = 'marketing' and a.area in ('conteudo', 'ofertas', 'pesquisas', 'disparos') then 'editar'
    when s.id = 'marketing' and a.area in ('visao', 'indicacoes', 'eventos') then 'ver'
    when s.id = 'financeiro' and a.area in ('contratos', 'cashback_valores') then 'editar'
    when s.id = 'financeiro' and a.area in ('visao', 'membros', 'indicacoes') then 'ver'
    when s.id = 'relacoes_publicas' and a.area in ('eventos', 'pesquisas') then 'editar'
    when s.id = 'relacoes_publicas' and a.area in ('visao', 'membros', 'conteudo') then 'ver'
    when s.id = 'operacao' and a.area in ('membros', 'eventos', 'contratos') then 'editar'
    when s.id = 'operacao' and a.area in ('visao', 'saude', 'conversas') then 'ver'
    when s.id = 'comercial' and a.area in ('indicacoes') then 'editar'
    when s.id = 'comercial' and a.area in ('visao', 'membros', 'ofertas') then 'ver'
    else 'nenhum'
  end
from public.equipe_setores s
cross join (values ('visao'), ('saude'), ('membros'), ('carteiras'), ('jornada'), ('reunioes'), ('conversas'), ('disparos'),
  ('indicacoes'), ('cashback_valores'), ('ofertas'), ('pesquisas'), ('pedidos_ajuda'), ('eventos'), ('conteudo'), ('contratos'),
  ('acessos'), ('registro')) a(area)
on conflict (setor, area) do nothing;

-- Cada pessoa da equipe tem um setor. Os administradores de hoje entram na Diretoria (não muda nada para eles).
alter table public.membros add column if not exists setor text references public.equipe_setores(id);
update public.membros set setor = 'diretoria' where is_admin and setor is null;

-- Pergunta única que todas as telas e regras novas usam: "posso ver/editar esta área?"
-- Administrador = pode tudo (como hoje). Sem setor = não pode nada da área da equipe.
create or replace function private.pode(p_area text, p_nivel text default 'ver') returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when m.is_admin then true
      when m.setor is null then false
      else exists (select 1 from public.equipe_permissoes p where p.setor = m.setor and p.area = p_area
                    and (p.nivel = 'editar' or (p.nivel = 'ver' and p_nivel = 'ver')))
    end
    from public.membros m where m.auth_user_id = (select auth.uid()) and m.ativo
  ), false);
$$;
create or replace function public.minhas_permissoes() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(a.area, case when m.is_admin then 'editar' else coalesce(p.nivel, 'nenhum') end), '{}'::jsonb)
  from public.membros m
  cross join (select distinct area from public.equipe_permissoes) a
  left join public.equipe_permissoes p on p.setor = m.setor and p.area = a.area
  where m.auth_user_id = (select auth.uid()) and m.ativo and (m.is_admin or m.setor is not null);
$$;
grant execute on function public.minhas_permissoes() to authenticated;

alter table public.equipe_setores enable row level security;
alter table public.equipe_permissoes enable row level security;
create policy "setores_ver" on public.equipe_setores for select to authenticated using ((select private.pode('acessos')));
create policy "setores_editar" on public.equipe_setores for all to authenticated using ((select private.pode('acessos', 'editar'))) with check ((select private.pode('acessos', 'editar')));
create policy "permissoes_ver" on public.equipe_permissoes for select to authenticated using ((select private.pode('acessos')));
create policy "permissoes_editar" on public.equipe_permissoes for all to authenticated using ((select private.pode('acessos', 'editar'))) with check ((select private.pode('acessos', 'editar')));
grant select, insert, update, delete on public.equipe_setores, public.equipe_permissoes to authenticated, service_role;

-- Registro de atividades: quem fez o quê, quando, antes e depois (só os campos que mudaram).
-- Não pode ser apagado nem alterado por ninguém pelo portal. Textos longos e dados pessoais do contrato não são copiados.
create table if not exists public.registro_atividades (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  quem uuid references public.membros(id) on delete set null,
  quem_nome text,
  origem text not null default 'portal',   -- portal (pessoa logada) ou sistema (rotinas automáticas)
  acao text not null,                      -- criou / alterou / apagou
  tabela text not null,
  registro_id text,
  registro_nome text,
  mudancas jsonb
);
create index if not exists registro_atividades_quando_idx on public.registro_atividades (quando desc);
create index if not exists registro_atividades_tabela_idx on public.registro_atividades (tabela, registro_id);
alter table public.registro_atividades enable row level security;
create policy "registro_ver" on public.registro_atividades for select to authenticated using ((select private.pode('registro')));
grant select on public.registro_atividades to authenticated;
grant select, insert on public.registro_atividades to service_role;

create or replace function private.registrar_atividade() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_quem uuid; v_nome text; v_old jsonb; v_new jsonb; v_mud jsonb := '{}'::jsonb; k text;
  -- campos que não entram: textos enormes, dados pessoais do contrato e carimbos de data automáticos
  ignorar text[] := array['texto', 'dados', 'assinaturas', 'atualizado_em', 'updated_at', 'verificado_em', 'proximo_envio_em', 'notificacoes_vistas_em', 'token'];
begin
  if auth.uid() is not null then
    select m.id, m.nome into v_quem, v_nome from public.membros m where m.auth_user_id = auth.uid();
  end if;
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else null end;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if not (k = any(ignorar)) and (v_old -> k) is distinct from (v_new -> k) then
        v_mud := v_mud || jsonb_build_object(k, jsonb_build_object('antes', left((v_old ->> k), 300), 'depois', left((v_new ->> k), 300)));
      end if;
    end loop;
    if v_mud = '{}'::jsonb then return new; end if;   -- só mudou carimbo de data: não registra
  else
    for k in select jsonb_object_keys(coalesce(v_new, v_old)) loop
      if not (k = any(ignorar)) and coalesce(v_new, v_old) ->> k is not null then
        v_mud := v_mud || jsonb_build_object(k, left(coalesce(v_new, v_old) ->> k, 300));
      end if;
    end loop;
  end if;
  insert into public.registro_atividades (quem, quem_nome, origem, acao, tabela, registro_id, registro_nome, mudancas)
  values (v_quem, v_nome, case when v_quem is null then 'sistema' else 'portal' end,
    case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'apagou' end,
    tg_table_name, coalesce(v_new, v_old) ->> 'id',
    coalesce(coalesce(v_new, v_old) ->> 'nome', coalesce(v_new, v_old) ->> 'titulo', coalesce(v_new, v_old) ->> 'chave'),
    v_mud);
  return coalesce(new, old);
end; $$;

-- Tabelas acompanhadas: o que a equipe mexe no dia a dia.
do $$
declare t text;
begin
  foreach t in array array['membros', 'contratos', 'eventos', 'ofertas', 'wa_disparos', 'wa_modelos', 'portal_config',
                           'solicitacoes_acesso', 'conteudos', 'equipe_setores', 'equipe_permissoes'] loop
    execute format('drop trigger if exists registrar_atividade on public.%I', t);
    execute format('create trigger registrar_atividade after insert or update or delete on public.%I for each row execute function private.registrar_atividade()', t);
  end loop;
end $$;

-- Segurança: o próprio membro não pode se colocar num setor da equipe (só administrador muda o setor).
create or replace function private.proteger_colunas_membro() returns trigger
language plpgsql security definer set search_path = '' as $function$
begin
  if (select auth.role()) = 'authenticated' and not private.is_admin()
     and coalesce(current_setting('app.publicando_resumo', true), '') <> 'sim' then
    if new.ativo is distinct from old.ativo
       or new.is_admin is distinct from old.is_admin
       or new.equipe is distinct from old.equipe
       or new.email is distinct from old.email
       or new.auth_user_id is distinct from old.auth_user_id
       or new.resumo_publico is distinct from old.resumo_publico
       or new.resumo_publicado_em is distinct from old.resumo_publicado_em
       or new.contrato_pendente is distinct from old.contrato_pendente
       or new.setor is distinct from old.setor then
      raise exception 'Somente o administrador pode alterar esses campos';
    end if;
  end if;
  return new;
end; $function$;
