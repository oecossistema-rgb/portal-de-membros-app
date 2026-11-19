-- A função decidir-acesso (chave de serviço) precisa criar/reativar o cadastro ao aprovar uma solicitação.
grant insert, update on public.membros to service_role;
