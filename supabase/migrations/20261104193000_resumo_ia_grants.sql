-- Permissões mínimas para a função gerar-resumo (service_role) no projeto de produção.
grant select on public.membros, public.membros_onboarding to service_role;
grant select, insert, update on public.membros_resumo to service_role;
