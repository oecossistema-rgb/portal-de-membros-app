-- Aba "Ofertas" (25/11/2026): cada membro divulga os próprios produtos e serviços para os outros membros.
-- Fica visível só para administradores até ser liberada (portal_config 'ofertas' -> {"liberada": true}).
-- Nada do que existe muda: tabela nova, função nova, chave nova em portal_config.

create table if not exists public.ofertas (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros(id) on delete cascade,
  tipo text not null default 'servico' check (tipo in ('produto', 'servico')),
  titulo text not null check (char_length(titulo) between 3 and 90),
  descricao text not null check (char_length(descricao) between 10 and 1200),
  condicao_membro text check (condicao_membro is null or char_length(condicao_membro) <= 200),
  preco text check (preco is null or char_length(preco) <= 60),
  link text check (link is null or (char_length(link) <= 300 and link ~* '^https?://')),
  imagem_url text check (imagem_url is null or char_length(imagem_url) <= 500),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ofertas_membro_idx on public.ofertas (membro_id);

alter table public.ofertas enable row level security;
grant select, insert, update, delete on public.ofertas to authenticated;
grant select on public.ofertas to service_role;

insert into public.portal_config (chave, valor) values ('ofertas', '{"liberada": false}')
on conflict (chave) do nothing;

create or replace function private.ofertas_liberada() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (valor::jsonb->>'liberada')::boolean from public.portal_config where chave = 'ofertas'), false);
$$;
grant execute on function private.ofertas_liberada() to authenticated;

-- O portal pergunta se a aba aparece para membros.
create or replace function public.ofertas_liberada() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.ofertas_liberada();
$$;
revoke execute on function public.ofertas_liberada() from anon, public;
grant execute on function public.ofertas_liberada() to authenticated;

-- Ver: administradores sempre; membros só depois de liberada (ofertas ativas de todos + as próprias pausadas).
create policy "ofertas_ver" on public.ofertas for select to authenticated using (
  (select private.is_admin())
  or ((select private.ofertas_liberada()) and (select private.membro_ativo())
      and (ativo or membro_id = (select private.meu_membro_id())))
);
-- Criar / editar / apagar: o próprio membro (nas próprias ofertas) ou administrador.
create policy "ofertas_criar" on public.ofertas for insert to authenticated with check (
  (select private.is_admin())
  or ((select private.ofertas_liberada()) and (select private.membro_ativo()) and membro_id = (select private.meu_membro_id()))
);
create policy "ofertas_editar" on public.ofertas for update to authenticated
  using ((select private.is_admin()) or membro_id = (select private.meu_membro_id()))
  with check ((select private.is_admin()) or membro_id = (select private.meu_membro_id()));
create policy "ofertas_apagar" on public.ofertas for delete to authenticated
  using ((select private.is_admin()) or membro_id = (select private.meu_membro_id()));

-- Limite de 5 ofertas por membro e data de atualização.
create or replace function private.ofertas_antes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.ofertas where membro_id = new.membro_id) >= 5 then
    raise exception 'Limite de 5 ofertas por membro.';
  end if;
  if tg_op = 'UPDATE' then
    new.membro_id := old.membro_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists ofertas_antes on public.ofertas;
create trigger ofertas_antes before insert or update on public.ofertas
  for each row execute function private.ofertas_antes();
