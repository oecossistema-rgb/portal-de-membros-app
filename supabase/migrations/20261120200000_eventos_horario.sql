-- Horário dos eventos (início e fim), preenchido no painel. Aparece no card, no lembrete do WhatsApp e no "adicionar à agenda".
alter table public.eventos
  add column if not exists hora_inicio time,
  add column if not exists hora_fim time;
