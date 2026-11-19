-- Membros antigos (cadastrados antes de 19/11/2026) já fizeram o onboarding fora do portal e não podem
-- ver o formulário. Os que estavam sem respostas importadas ficam como "dispensado-membro-antigo"
-- (a função gerar-resumo ignora esses: sem respostas, não há base para um resumo).
-- O formulário continua obrigatório só para quem for cadastrado daqui para frente.
insert into public.membros_onboarding (membro_id, etapa_atual, onboarding_versao, onboarding_concluido_em)
select m.id, 41, 'dispensado-membro-antigo', now()
from public.membros m
left join public.membros_onboarding o on o.membro_id = m.id
where m.ativo and not m.equipe and not m.is_admin
  and m.created_at < '2026-11-19'
  and o.onboarding_concluido_em is null
on conflict (membro_id) do update
  set onboarding_concluido_em = now(), onboarding_versao = 'dispensado-membro-antigo', etapa_atual = 41
  where public.membros_onboarding.onboarding_concluido_em is null;
