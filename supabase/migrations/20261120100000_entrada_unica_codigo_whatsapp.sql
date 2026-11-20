-- ENTRADA ÚNICA + CÓDIGO NO WHATSAPP (20/11/2026)
-- Uma tela só: a pessoa digita o e-mail; se já tem senha, entra; se não tem, cria a senha.
-- Quem o portal reconhece como membro (pelo e-mail OU pelo WhatsApp do cadastro) confirma com um código
-- de 6 dígitos enviado ao WhatsApp QUE ESTÁ NO CADASTRO (não ao número digitado) e entra sem aprovação.
-- Quem não é reconhecido vira pedido de acesso; o admin pode ligar o pedido ao perfil que já existe ("É ele").
-- Fecha a brecha antiga: criar conta com o e-mail de um membro não liga mais sozinho ao perfil dele.
-- Reversão: 20261120100000_entrada_unica_codigo_whatsapp_REVERTER.sql.txt

-- Chave do telefone: DDD + últimos 8 dígitos (ignora 55 e o 9 extra).
create or replace function private.fone_chave(p text)
returns text language sql immutable set search_path = '' as $$
  select case when length(d) >= 10 then left(d, 2) || right(d, 8) end
  from (select regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^55(?=\d{10,11}$)', '') as d) x;
$$;

-- Criar conta não liga mais o login ao membro pelo e-mail (isso agora exige o código no WhatsApp ou a aprovação).
drop trigger if exists on_auth_user_created_vincular_membro on auth.users;

-- Toda conta nova que não estiver ligada a um membro vira pedido de acesso (antes: só se o e-mail não fosse de membro).
create or replace function private.solicitacao_automatica()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_fone text;
begin
  begin
    if not exists (select 1 from public.membros m where m.auth_user_id = new.id) then
      v_fone := nullif(left(regexp_replace(coalesce(new.raw_user_meta_data->>'whatsapp', ''), '\D', '', 'g'), 15), '');
      if v_fone is not null and length(v_fone) < 10 then v_fone := null; end if;
      insert into public.solicitacoes_acesso (auth_user_id, email, nome, whatsapp)
      values (new.id, lower(new.email), left(coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)), 120), v_fone)
      on conflict (auth_user_id) do nothing;
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

-- Códigos de confirmação (só a função "entrada", com a chave de serviço, lê e grava).
create table if not exists public.codigos_entrada (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  membro_id uuid not null references public.membros(id) on delete cascade,
  codigo_hash text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  tentativas int not null default 0,
  usado_em timestamptz
);
create index if not exists codigos_entrada_email on public.codigos_entrada (email, criado_em desc);
create index if not exists codigos_entrada_membro on public.codigos_entrada (membro_id, criado_em desc);
alter table public.codigos_entrada enable row level security;
revoke all on public.codigos_entrada from anon, authenticated;
grant select, insert, update, delete on public.codigos_entrada to service_role;

-- Primeira etapa da tela: esse e-mail já tem senha? ('senha') ou precisa criar? ('criar')
create or replace function public.entrada_status(p_email text)
returns text language sql security definer set search_path = '' stable as $$
  select case when exists (select 1 from auth.users u where lower(u.email) = lower(trim(p_email))) then 'senha' else 'criar' end;
$$;
revoke all on function public.entrada_status(text) from public;
grant execute on function public.entrada_status(text) to anon, authenticated, service_role;

-- Para o admin escolher "É ele": membros ativos que ainda não têm login.
create or replace function public.membros_para_vincular()
returns table (id uuid, nome text, empresa text, email text, fone_final text)
language sql security definer set search_path = '' stable as $$
  select m.id, m.nome, m.empresa, m.email, right(regexp_replace(coalesce(m.telefone_whatsapp, ''), '\D', '', 'g'), 4)
  from public.membros m
  where (select private.is_admin()) and m.ativo and not coalesce(m.equipe, false) and m.auth_user_id is null
  order by m.nome;
$$;
revoke all on function public.membros_para_vincular() from public, anon;
grant execute on function public.membros_para_vincular() to authenticated;
