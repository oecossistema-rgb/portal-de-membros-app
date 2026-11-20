-- As miniaturas rápidas do Drive (lh3.googleusercontent.com) vencem com o tempo: a cada 3 horas a galeria
-- de todos os eventos é relida (também pega fotos e vídeos novos que forem colocados nas pastas).
select cron.unschedule('galeria-renovar') where exists (select 1 from cron.job where jobname = 'galeria-renovar');
select cron.schedule('galeria-renovar', '41 */3 * * *', $c$ select private.chamar_funcao('galeria-indexar', '{"todos": true}'::jsonb); $c$);

-- Miniaturas da galeria guardadas no próprio portal (rápidas e permanentes): a cada 5 min processa o que faltar.
select cron.unschedule('galeria-miniaturas') where exists (select 1 from cron.job where jobname = 'galeria-miniaturas');
select cron.schedule('galeria-miniaturas', '*/5 * * * *', $c$ select private.chamar_funcao('galeria-miniaturas', '{"todos": true}'::jsonb); $c$);
