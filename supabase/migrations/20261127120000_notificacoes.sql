-- Sino de notificações (27/11/2026): uma notificação vale para todos (sem uma linha por membro, custo zero por membro).
-- Cada membro guarda só "até quando já viu" (membros.notificacoes_vistas_em). Começa agora: ninguém recebe notificação antiga.
-- Primeiro uso: oferta nova publicada por um membro. Some sozinha se a oferta for pausada ou apagada.

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('oferta', 'aviso')),
  titulo text not null,
  texto text,
  link text,                                   -- seção do portal, ex.: ofertas/<id>
  autor_id uuid references public.membros(id) on delete set null,
  oferta_id uuid references public.ofertas(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists notificacoes_criado_idx on public.notificacoes (criado_em desc);
alter table public.notificacoes enable row level security; -- leitura só pela função abaixo
grant select, insert, update, delete on public.notificacoes to service_role;

alter table public.membros add column if not exists notificacoes_vistas_em timestamptz not null default now();

-- As últimas 30 notificações de quem está logado (quem publicou não recebe a própria).
create or replace function public.minhas_notificacoes() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid; v_visto timestamptz; v_admin boolean; r jsonb;
begin
  select m.id, m.notificacoes_vistas_em, m.is_admin into v_id, v_visto, v_admin
    from public.membros m where m.auth_user_id = auth.uid() and m.ativo;
  if v_id is null or not (v_admin or private.membro_ativo()) then return jsonb_build_object('itens', '[]'::jsonb, 'novas', 0); end if;
  with n as (
    select n.* from public.notificacoes n
      left join public.ofertas o on o.id = n.oferta_id
     where n.autor_id is distinct from v_id
       and (n.oferta_id is null or (o.ativo and (v_admin or private.ofertas_liberada())))
     order by n.criado_em desc limit 30
  )
  select jsonb_build_object(
    'novas', (select count(*) from n where n.criado_em > v_visto),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'tipo', n.tipo, 'titulo', n.titulo, 'texto', n.texto, 'link', n.link,
               'criado_em', n.criado_em, 'nova', n.criado_em > v_visto) order by n.criado_em desc) from n), '[]'::jsonb)
  ) into r;
  return r;
end; $$;
revoke all on function public.minhas_notificacoes() from public;
grant execute on function public.minhas_notificacoes() to authenticated;

create or replace function public.notificacoes_vistas() returns void
language sql security definer set search_path = '' as $$
  update public.membros set notificacoes_vistas_em = now() where auth_user_id = auth.uid();
$$;
revoke all on function public.notificacoes_vistas() from public;
grant execute on function public.notificacoes_vistas() to authenticated;

-- Oferta nova: aviso no grupo da equipe (como já era) + notificação no sino de todos.
create or replace function private.oferta_avisar() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_resumo text;
begin
  select m.nome into v_nome from public.membros m where m.id = new.membro_id;
  v_resumo := regexp_replace(trim(new.descricao), '\s+', ' ', 'g');
  if char_length(v_resumo) > 50 then v_resumo := rtrim(regexp_replace(left(v_resumo, 51), '\s+\S*$', ''), ' ,.;:-') || '...'; end if;
  insert into public.notificacoes (tipo, titulo, texto, link, autor_id, oferta_id)
  values ('oferta', 'Nova oportunidade: ' || new.titulo, coalesce(v_nome || ' · ', '') || v_resumo, 'ofertas/' || new.id, new.membro_id, new.id);
  perform private.chamar_funcao('whatsapp', jsonb_build_object('oferta_nova', new.id));
  return new;
end; $$;
