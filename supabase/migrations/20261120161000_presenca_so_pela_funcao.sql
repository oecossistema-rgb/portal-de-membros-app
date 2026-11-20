-- Aplicada depois que o portal novo foi ao ar: confirmar presença passa a ser só pela função
-- public.confirmar_presenca (que respeita o limite de vagas). Ler e cancelar continuam como antes.
drop policy if exists "Usuario registra sua propria presenca" on public.presencas;
drop policy if exists "presencas_insert_membro" on public.presencas;
