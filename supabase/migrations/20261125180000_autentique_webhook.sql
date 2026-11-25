-- Aviso imediato da Autentique (webhook): quando alguém assina, a Autentique chama a função "autentique-webhook",
-- que confere a assinatura do aviso (HMAC com o segredo do cofre) e manda o portal atualizar os contratos na hora.
-- A conferência de 10 em 10 minutos continua como rede de segurança (se um aviso se perder, nada fica parado).
create or replace function public.autentique_webhook_segredo() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'autentique_webhook' limit 1;
$$;
create or replace function public.autentique_webhook_guardar(p_segredo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'autentique_webhook';
  if v_id is null then perform vault.create_secret(p_segredo, 'autentique_webhook', 'segredo do webhook da Autentique');
  else perform vault.update_secret(v_id, p_segredo); end if;
end; $$;
create or replace function public.contratos_atualizar_agora() returns void
language sql security definer set search_path = '' as $$
  select private.chamar_funcao('contratos', '{"varredura": true}'::jsonb);
$$;
revoke all on function public.autentique_webhook_segredo() from public, anon, authenticated;
revoke all on function public.autentique_webhook_guardar(text) from public, anon, authenticated;
revoke all on function public.contratos_atualizar_agora() from public, anon, authenticated;
grant execute on function public.autentique_webhook_segredo() to service_role;
grant execute on function public.autentique_webhook_guardar(text) to service_role;
grant execute on function public.contratos_atualizar_agora() to service_role;
