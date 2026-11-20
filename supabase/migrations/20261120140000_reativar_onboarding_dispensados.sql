-- Regra (20/11/2026): quem não tem onboarding (nem no Google Forms, nem no portal) faz o onboarding no primeiro acesso.
-- Os 6 membros antigos que estavam "dispensados" voltam a ter o formulário pendente (como um membro novo).
-- (Conferido na planilha de respostas do Forms e nas pastas de fotos/logos: nenhum dos 6 respondeu.)
update public.membros_onboarding
   set onboarding_concluido_em = null, onboarding_versao = 'google-forms-2026-11', etapa_atual = 1, planilha_enviada_em = null, planilha_erro = null
 where onboarding_versao = 'dispensado-membro-antigo';
