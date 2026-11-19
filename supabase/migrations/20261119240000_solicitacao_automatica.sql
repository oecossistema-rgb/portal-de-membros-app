-- SOLICITAÇÃO AUTOMÁTICA (19/11/2026)
-- Antes, o pedido de acesso só era criado quando a pessoa preenchia o formulário "Solicitar acesso".
-- Agora ele nasce no momento em que a conta é criada (se o e-mail não estiver pré-cadastrado),
-- e aparece na Administração na hora. WhatsApp e empresa ficam em branco até a pessoa completar.
-- Segurança: o gatilho nunca impede a criação da conta (qualquer erro é ignorado).
alter table public.solicitacoes_acesso alter column whatsapp drop not null;
alter table public.solicitacoes_acesso alter column empresa drop not null;

create or replace function private.solicitacao_automatica()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    if not exists (select 1 from public.membros m where m.auth_user_id = new.id or lower(m.email) = lower(new.email)) then
      insert into public.solicitacoes_acesso (auth_user_id, email, nome)
      values (new.id, lower(new.email), left(coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)), 120))
      on conflict (auth_user_id) do nothing;
    end if;
  exception when others then
    null; -- nunca bloqueia o cadastro da conta
  end;
  return new;
end;
$$;
revoke all on function private.solicitacao_automatica() from public, anon, authenticated;
drop trigger if exists zz_solicitacao_automatica on auth.users;
create trigger zz_solicitacao_automatica after insert on auth.users
  for each row execute function private.solicitacao_automatica();

-- Contas criadas hoje que ficaram sem cadastro e sem pedido (ex.: teste das 18:21) entram como pedido.
insert into public.solicitacoes_acesso (auth_user_id, email, nome)
select u.id, lower(u.email), left(coalesce(nullif(trim(u.raw_user_meta_data->>'nome'), ''), split_part(u.email, '@', 1)), 120)
from auth.users u
where u.created_at >= '2026-11-19'
  and not exists (select 1 from public.membros m where m.auth_user_id = u.id or lower(m.email) = lower(u.email))
on conflict (auth_user_id) do nothing;
