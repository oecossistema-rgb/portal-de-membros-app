-- Formato aprovado da notificação de oferta (27/11/2026, simulado no celular): etiqueta "Nova oportunidade · Serviço",
-- título da oferta em destaque, quem publicou numa linha e o resumo (frase inteira se couber em ~90 caracteres).
alter table public.notificacoes add column if not exists etiqueta text, add column if not exists quem text;

-- Resumo: frases inteiras enquanto couberem no limite (se ocuparem pelo menos 60% dele); senão corta no fim de uma
-- palavra e põe "…" (nunca no meio da palavra).
create or replace function private.resumo(p text, n int) returns text language plpgsql immutable set search_path = '' as $$
declare s text := regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g'); acc text := ''; f text;
begin
  if char_length(s) <= n then return s; end if;
  for f in select m[1] from regexp_matches(s, '([^.!?]+[.!?]+)(?:\s|$)', 'g') m loop
    exit when char_length(trim(acc || ' ' || trim(f))) > n;
    acc := trim(acc || ' ' || trim(f));
  end loop;
  if char_length(acc) >= n * 0.6 then return acc; end if;
  return rtrim(regexp_replace(left(s, n + 1), '\s+\S*$', ''), ' ,.;:-') || '…';
end; $$;

create or replace function private.oferta_avisar() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_quem text;
begin
  select m.nome || coalesce(' · ' || nullif(trim(m.empresa), ''), '') into v_quem from public.membros m where m.id = new.membro_id;
  insert into public.notificacoes (tipo, etiqueta, titulo, quem, texto, link, autor_id, oferta_id)
  values ('oferta', 'Nova oportunidade · ' || case when new.tipo = 'produto' then 'Produto' else 'Serviço' end,
          regexp_replace(trim(new.titulo), '\.$', ''), v_quem, private.resumo(new.descricao, 90), 'ofertas/' || new.id, new.membro_id, new.id);
  perform private.chamar_funcao('whatsapp', jsonb_build_object('oferta_nova', new.id));
  return new;
end; $$;

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
    'itens', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'tipo', n.tipo, 'etiqueta', n.etiqueta, 'titulo', n.titulo, 'quem', n.quem,
               'texto', n.texto, 'link', n.link, 'criado_em', n.criado_em, 'nova', n.criado_em > v_visto) order by n.criado_em desc) from n), '[]'::jsonb)
  ) into r;
  return r;
end; $$;

-- A notificação que já existe passa para o formato novo.
update public.notificacoes n set
  etiqueta = 'Nova oportunidade · ' || case when o.tipo = 'produto' then 'Produto' else 'Serviço' end,
  titulo = regexp_replace(trim(o.titulo), '\.$', ''),
  quem = m.nome || coalesce(' · ' || nullif(trim(m.empresa), ''), ''),
  texto = private.resumo(o.descricao, 90)
from public.ofertas o join public.membros m on m.id = o.membro_id
where o.id = n.oferta_id and n.tipo = 'oferta';
