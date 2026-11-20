-- Permissões mínimas para as funções do portal (o projeto dá ao "service_role" só o que cada função precisa).
-- eventos-avisos: lê eventos/presenças/fila e marca o que já foi avisado.
-- galeria-indexar: lê e atualiza o índice da galeria do evento.
-- planilha-onboarding: marca quando a resposta chegou na planilha (antes faltava e ele reenviava a cada 10 min).
grant select, update on public.eventos to service_role;
grant select on public.presencas to service_role;
grant select, update on public.eventos_lista to service_role;
grant update (planilha_enviada_em, planilha_erro) on public.membros_onboarding to service_role;
