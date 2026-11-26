-- Contrato que não chegou na planilha do Google (26/11/2026): a orientação diz que o contrato segue normal e que o portal
-- reenvia sozinho; o motivo exato (qual pergunta ou opção do Google mudou) vem no detalhe, escrito pela função "contratos".
do $$ declare d text; begin
  d := pg_get_functiondef('public.painel_resumo'::regproc);
  d := replace(d, 'O portal tenta de novo a cada 10 minutos. Se continuar, confira se o Google Forms "Dados do Contrato" ainda aceita respostas.',
               'O contrato não é afetado: pode revisar e enviar para assinatura. O motivo exato aparece acima; depois de corrigido, o portal reenvia sozinho em até 10 minutos.');
  execute d;
end $$;
