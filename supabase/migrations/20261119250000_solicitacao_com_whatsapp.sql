-- O WhatsApp agora é pedido na própria tela de "Primeiro acesso" (vai nos metadados da conta).
-- O pedido de acesso automático já nasce com esse número, então a aprovação manda o aviso sem depender de outra tela.
create or replace function private.solicitacao_automatica()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_fone text;
begin
  begin
    if not exists (select 1 from public.membros m where m.auth_user_id = new.id or lower(m.email) = lower(new.email)) then
      v_fone := nullif(left(regexp_replace(coalesce(new.raw_user_meta_data->>'whatsapp', ''), '\D', '', 'g'), 15), '');
      if v_fone is not null and length(v_fone) < 10 then v_fone := null; end if;
      insert into public.solicitacoes_acesso (auth_user_id, email, nome, whatsapp)
      values (new.id, lower(new.email), left(coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)), 120), v_fone)
      on conflict (auth_user_id) do nothing;
    end if;
  exception when others then
    null; -- nunca bloqueia o cadastro da conta
  end;
  return new;
end;
$$;
