-- Renovação de contrato: novo contrato com os mesmos dados do anterior, sem taxa de adesão (item 6.8).
-- Não bloqueia o portal do membro e não manda de novo o cartão de boas-vindas.
alter table public.contratos add column if not exists renovacao_de uuid references public.contratos(id);
alter table public.contratos drop constraint if exists contratos_origem_check;
alter table public.contratos add constraint contratos_origem_check check (origem in ('manual', 'onboarding', 'formulario', 'renovacao'));
