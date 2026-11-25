-- Teste do controle de gasto da IA sem a API de custos da Anthropic (25/11/2026): parte do saldo do console naquele momento
-- (US$ 8,25 às 16:31 de 25/11/2026, com US$ 4,72 já gastos no mês) e desconta o que o portal gasta, contado pelos tokens
-- que a própria Anthropic devolve em cada uso. Só a chave do portal entra; outras chaves (Kommo, Make) não.
insert into public.portal_config (chave, valor) values
  ('ia_saldo', '{"saldo_inicial":8.25,"em":"2026-11-25T19:31:00Z","gasto_mes_console":4.72}')
on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();
