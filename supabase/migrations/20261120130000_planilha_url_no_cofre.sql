-- Link do App da Web da planilha (script "Portla Membros.gs") guardado no cofre do banco (vault, nome "planilha_url").
-- O valor NÃO fica no repositório (que é público): foi gravado direto no banco com vault.create_secret(...).
create or replace function public.planilha_url()
returns text language sql security definer set search_path = '' stable as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'planilha_url' limit 1;
$$;
revoke all on function public.planilha_url() from public, anon, authenticated;
grant execute on function public.planilha_url() to service_role;
