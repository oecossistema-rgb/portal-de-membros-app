-- VAGAS DOS EVENTOS (20/11/2026)
-- * Cada evento pode ter limite de vagas (Growth Session 5, Reunião de Conselho 10; vazio = sem limite).
-- * A abertura das vagas pode ser programada (data e hora). Antes disso o membro só pode pedir "me avise quando abrir".
-- * Lotou: ninguém mais confirma (garantido aqui no banco, mesmo com cliques no mesmo segundo); o membro entra na fila.
-- * Saiu alguém (cancelou ou o admin removeu) ou o admin aumentou as vagas: o 1º da fila entra sozinho e é avisado.
-- * Cancelar pelo portal: até a véspera do encontro. Depois disso, só falando com a equipe.
-- * Avisos no WhatsApp pela função "eventos-avisos" (vaga garantida, entrou da fila, vagas abriram, lembrete na véspera).

alter table public.eventos
  add column if not exists vagas integer check (vagas is null or vagas > 0),
  add column if not exists vagas_abrem_em timestamptz,
  add column if not exists abertura_avisada_em timestamptz,
  add column if not exists lembrete_enviado_em timestamptz;

-- Padrão pedido: Growth Session 5 vagas, Reunião de Conselho 10 (só encontros que ainda vão acontecer).
update public.eventos set vagas = 5 where trilha = 'growth' and data_inicio >= current_date and vagas is null;
update public.eventos set vagas = 10 where trilha = 'conselho' and data_inicio >= current_date and vagas is null;

-- Uma confirmação por pessoa por evento.
create unique index if not exists presencas_evento_user_uk on public.presencas (evento_id, user_id);

-- Fila de espera ('fila') e pré-cadastro "me avise quando abrir" ('aviso').
create table if not exists public.eventos_lista (
  id bigint generated always as identity primary key,
  evento_id text not null references public.eventos (id) on delete cascade,
  user_id uuid not null,
  tipo text not null check (tipo in ('fila', 'aviso')),
  criado_em timestamptz not null default now(),
  avisado_em timestamptz,
  unique (evento_id, user_id, tipo)
);
create index if not exists eventos_lista_evento_idx on public.eventos_lista (evento_id, tipo, criado_em);
alter table public.eventos_lista enable row level security;
revoke all on public.eventos_lista from anon;
revoke insert, update, truncate, references, trigger on public.eventos_lista from authenticated;
create policy "eventos_lista_select" on public.eventos_lista for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "eventos_lista_delete_admin" on public.eventos_lista for delete to authenticated
  using ((select private.is_admin()));

create or replace function private.rotulo_trilha(p text) returns text language sql immutable set search_path = '' as $$
  select case p when 'imersao' then 'Imersão' when 'business-day' then 'Business Day' when 'growth' then 'Growth Session'
    when 'conselho' then 'Conselho' else p end;
$$;

create or replace function private.hoje_bahia() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Bahia')::date;
$$;

-- Coloca alguém como confirmado (usado pela confirmação e pela fila).
create or replace function private.inserir_presenca(p_evento public.eventos, p_user uuid, p_nome text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m public.membros; v_login text;
begin
  select * into v_m from public.membros where auth_user_id = p_user and ativo limit 1;
  select email into v_login from auth.users where id = p_user;
  insert into public.presencas (user_id, membro, membro_login, evento_id, evento, data_evento, trilha, confirmado_em)
  values (p_user, coalesce(nullif(btrim(p_nome), ''), v_m.nome, ''), coalesce(v_login, v_m.email, ''), p_evento.id,
          p_evento.titulo, p_evento.quando, private.rotulo_trilha(p_evento.trilha), now())
  on conflict (evento_id, user_id) do nothing;
  delete from public.eventos_lista where evento_id = p_evento.id and user_id = p_user;
end;
$$;

-- Preenche vagas livres com a fila (em ordem de chegada) e avisa quem entrou.
create or replace function private.promover_fila(p_evento text)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.eventos; f public.eventos_lista; v_conf int;
begin
  select * into e from public.eventos where id = p_evento for update;
  if not found or e.vagas is null or not e.ativo or not e.inscricoes_abertas or e.data_inicio < private.hoje_bahia() then return; end if;
  loop
    select count(*) into v_conf from public.presencas where evento_id = e.id;
    exit when v_conf >= e.vagas;
    select * into f from public.eventos_lista where evento_id = e.id and tipo = 'fila' order by criado_em, id limit 1;
    exit when not found;
    perform private.inserir_presenca(e, f.user_id, null);
    perform private.chamar_funcao('eventos-avisos', jsonb_build_object('tipo', 'promovido', 'evento_id', e.id, 'user_id', f.user_id));
  end loop;
end;
$$;

create or replace function private.presenca_removida() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.promover_fila(old.evento_id);
  return null;
end;
$$;
drop trigger if exists presenca_removida on public.presencas;
create trigger presenca_removida after delete on public.presencas for each row execute function private.presenca_removida();

-- Reprogramou a abertura: o aviso "vagas abriram" volta a valer para a nova data.
create or replace function private.abertura_reprogramada() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.vagas_abrem_em is distinct from old.vagas_abrem_em then new.abertura_avisada_em := null; end if;
  return new;
end;
$$;
drop trigger if exists abertura_reprogramada on public.eventos;
create trigger abertura_reprogramada before update on public.eventos for each row execute function private.abertura_reprogramada();

-- Aumentou as vagas ou reabriu: a fila anda.
create or replace function private.vagas_alteradas() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.vagas is distinct from old.vagas or (new.inscricoes_abertas and not old.inscricoes_abertas) then
    perform private.promover_fila(new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists vagas_alteradas on public.eventos;
create trigger vagas_alteradas after update on public.eventos for each row execute function private.vagas_alteradas();

-- Situação das vagas de cada evento (para a agenda e a tela inicial). p_membro: só administradores ("ver como membro").
create or replace function public.eventos_vagas(p_membro uuid default null)
returns table (evento_id text, vagas int, abre_em timestamptz, confirmados int, fila int, minha text, posicao int, fotos jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if not (private.membro_ativo() or private.is_admin()) then return; end if;
  if p_membro is not null and private.is_admin() then
    select m.auth_user_id into v_uid from public.membros m where m.id = p_membro;
  end if;
  return query
  select e.id, e.vagas, e.vagas_abrem_em,
    (select count(*)::int from public.presencas p where p.evento_id = e.id),
    (select count(*)::int from public.eventos_lista l where l.evento_id = e.id and l.tipo = 'fila'),
    case when exists (select 1 from public.presencas p where p.evento_id = e.id and p.user_id = v_uid) then 'confirmado'
         when exists (select 1 from public.eventos_lista l where l.evento_id = e.id and l.user_id = v_uid and l.tipo = 'fila') then 'fila'
         when exists (select 1 from public.eventos_lista l where l.evento_id = e.id and l.user_id = v_uid and l.tipo = 'aviso') then 'aviso'
         else null end,
    (select count(*)::int from public.eventos_lista l, public.eventos_lista eu
      where eu.evento_id = e.id and eu.user_id = v_uid and eu.tipo = 'fila'
        and l.evento_id = e.id and l.tipo = 'fila' and (l.criado_em, l.id) <= (eu.criado_em, eu.id)),
    coalesce((select jsonb_agg(jsonb_build_object('nome', split_part(m.nome, ' ', 1), 'foto', m.foto_url) order by p.confirmado_em)
       from (select * from public.presencas p0 where p0.evento_id = e.id order by p0.confirmado_em limit 12) p
       join public.membros m on m.auth_user_id = p.user_id and m.ativo), '[]'::jsonb)
  from public.eventos e where e.ativo;
end;
$$;

-- Confirmar presença respeitando o limite. Respostas: confirmado | lotado | nao_abriu | fechado | encerrado
create or replace function public.confirmar_presenca(p_evento text, p_nome text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare e public.eventos; v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.membro_ativo() then raise exception 'Acesso negado'; end if;
  select * into e from public.eventos where id = p_evento and ativo for update;
  if not found then raise exception 'Evento não encontrado'; end if;
  if exists (select 1 from public.presencas where evento_id = e.id and user_id = v_uid) then return 'confirmado'; end if;
  if e.data_inicio < private.hoje_bahia() then return 'encerrado'; end if;
  if not e.inscricoes_abertas then return 'fechado'; end if;
  if e.vagas_abrem_em is not null and e.vagas_abrem_em > now() then return 'nao_abriu'; end if;
  if e.vagas is not null and (select count(*) from public.presencas where evento_id = e.id) >= e.vagas then return 'lotado'; end if;
  perform private.inserir_presenca(e, v_uid, p_nome);
  if e.vagas is not null then
    perform private.chamar_funcao('eventos-avisos', jsonb_build_object('tipo', 'confirmado', 'evento_id', e.id, 'user_id', v_uid));
  end if;
  return 'confirmado';
end;
$$;

-- Cancelar a própria presença (até a véspera). Respostas: cancelado | prazo
create or replace function public.cancelar_presenca(p_evento text)
returns text language plpgsql security definer set search_path = '' as $$
declare e public.eventos; v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'Acesso negado'; end if;
  select * into e from public.eventos where id = p_evento;
  if found and e.vagas is not null and e.data_inicio <= private.hoje_bahia() then return 'prazo'; end if;
  delete from public.presencas where evento_id = p_evento and user_id = v_uid;
  return 'cancelado';
end;
$$;

-- Entrar/sair da fila de espera ou do "me avise quando abrir". Respostas: ok | vaga_livre | confirmado
create or replace function public.entrar_lista(p_evento text, p_tipo text)
returns text language plpgsql security definer set search_path = '' as $$
declare e public.eventos; v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.membro_ativo() then raise exception 'Acesso negado'; end if;
  if p_tipo not in ('fila', 'aviso') then raise exception 'Tipo inválido'; end if;
  select * into e from public.eventos where id = p_evento and ativo for update;
  if not found or e.data_inicio < private.hoje_bahia() then raise exception 'Evento não disponível'; end if;
  if exists (select 1 from public.presencas where evento_id = e.id and user_id = v_uid) then return 'confirmado'; end if;
  if p_tipo = 'fila' and e.inscricoes_abertas and (e.vagas_abrem_em is null or e.vagas_abrem_em <= now())
     and (e.vagas is null or (select count(*) from public.presencas where evento_id = e.id) < e.vagas) then
    return 'vaga_livre';
  end if;
  insert into public.eventos_lista (evento_id, user_id, tipo) values (e.id, v_uid, p_tipo) on conflict do nothing;
  return 'ok';
end;
$$;

create or replace function public.sair_lista(p_evento text, p_tipo text)
returns void language sql security definer set search_path = '' as $$
  delete from public.eventos_lista where evento_id = p_evento and tipo = p_tipo and user_id = (select auth.uid());
$$;

revoke execute on function public.eventos_vagas(uuid), public.confirmar_presenca(text, text), public.cancelar_presenca(text),
  public.entrar_lista(text, text), public.sair_lista(text, text) from public, anon;
grant execute on function public.eventos_vagas(uuid), public.confirmar_presenca(text, text), public.cancelar_presenca(text),
  public.entrar_lista(text, text), public.sair_lista(text, text) to authenticated;
revoke execute on function private.inserir_presenca(public.eventos, uuid, text), private.promover_fila(text) from public, anon, authenticated;

-- Avisos programados (vagas abriram / lembrete na véspera): a cada 5 minutos.
select cron.unschedule('eventos-avisos') where exists (select 1 from cron.job where jobname = 'eventos-avisos');
select cron.schedule('eventos-avisos', '*/5 * * * *', $c$ select private.chamar_funcao('eventos-avisos', '{"varredura": true}'::jsonb); $c$);
