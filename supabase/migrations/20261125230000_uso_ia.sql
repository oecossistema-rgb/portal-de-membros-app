-- Gasto da IA (API do Claude) em tempo real (25/11/2026): cada chamada das funções gerar-resumo e gerar-oportunidades
-- anota os tokens usados. O custo é estimado com o preço de tabela guardado em portal_config.preco_ia (US$ por milhão de tokens).
create table if not exists public.portal_uso_ia (
  id bigint generated always as identity primary key,
  funcao text not null,
  modelo text,
  entrada int not null default 0,
  saida int not null default 0,
  cache_leitura int not null default 0,
  cache_escrita int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.portal_uso_ia enable row level security;
revoke all on public.portal_uso_ia from anon, authenticated;
create index if not exists portal_uso_ia_criado on public.portal_uso_ia (criado_em);

insert into public.portal_config (chave, valor) values
  ('preco_ia', '{"entrada":2.00,"saida":10.00,"cache_leitura":0.10,"cache_escrita":2.50,"fonte":"preço de tabela do Claude Sonnet 5.5 (US$ por milhão de tokens)"}')
on conflict (chave) do nothing;

create or replace function private.custo_ia(p_desde timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  with p as (select (valor::jsonb) j from public.portal_config where chave = 'preco_ia'),
  u as (select count(*) n, coalesce(sum(entrada),0) e, coalesce(sum(saida),0) s, coalesce(sum(cache_leitura),0) cl, coalesce(sum(cache_escrita),0) ce
          from public.portal_uso_ia where criado_em >= p_desde)
  select jsonb_build_object('chamadas', u.n, 'entrada', u.e, 'saida', u.s,
    'custo_usd', round(((u.e * (p.j->>'entrada')::numeric + u.s * (p.j->>'saida')::numeric
                       + u.cl * (p.j->>'cache_leitura')::numeric + u.ce * (p.j->>'cache_escrita')::numeric) / 1000000)::numeric, 4))
  from u, p;
$$;
