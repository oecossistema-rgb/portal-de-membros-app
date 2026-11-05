-- Meu Painel > Oportunidades: conexões sugeridas pela IA para cada membro.
-- Privado: cada membro só vê as próprias; administradores veem todas.
-- A IA usa o onboarding completo do PRÓPRIO membro e só o resumo público aprovado dos outros.

create table if not exists public.membros_oportunidades (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros(id) on delete cascade,   -- dono do painel
  alvo_id   uuid not null references public.membros(id) on delete cascade,   -- membro sugerido
  tipo text not null check (tipo in ('cliente','ajuda','parceria','afinidade')),
  motivo text not null,
  forca smallint not null default 2 check (forca between 1 and 3),
  status text not null default 'nova' check (status in ('nova','conversei','fechou','descartada')),
  gerado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (membro_id, alvo_id, tipo),
  check (membro_id <> alvo_id)
);
create index if not exists membros_oportunidades_membro_idx on public.membros_oportunidades (membro_id);

alter table public.membros_oportunidades enable row level security;

drop policy if exists op_select on public.membros_oportunidades;
create policy op_select on public.membros_oportunidades for select to authenticated
  using (membro_id = (select private.meu_membro_id()) or (select private.is_admin()));
-- Sem insert/update/delete direto: quem grava é a função da IA (service_role) e o RPC abaixo.

revoke all on public.membros_oportunidades from anon, authenticated;
grant select on public.membros_oportunidades to authenticated;
grant select, insert, update, delete on public.membros_oportunidades to service_role;

-- O dono marca o que fez com a oportunidade.
create or replace function public.marcar_oportunidade(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('nova','conversei','fechou','descartada') then raise exception 'Status invalido'; end if;
  update public.membros_oportunidades set status = p_status, atualizado_em = now()
   where id = p_id and membro_id = (select private.meu_membro_id());
  if not found then raise exception 'Oportunidade nao encontrada'; end if;
end; $$;
revoke all on function public.marcar_oportunidade(uuid, text) from public, anon;
grant execute on function public.marcar_oportunidade(uuid, text) to authenticated;
