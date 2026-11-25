-- Vigência do contrato (cláusula 3.2: doze meses contados da assinatura). Quando o contrato passa a "assinado"
-- (todas as assinaturas), grava início = data da assinatura e fim = início + 12 meses, se a equipe não tiver preenchido.
create or replace function private.contrato_vigencia() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'assinado' and new.vigencia_inicio is null then
    new.vigencia_inicio := (coalesce(new.assinado_em, now()) at time zone 'America/Bahia')::date;
  end if;
  if new.vigencia_inicio is not null and new.vigencia_fim is null then
    new.vigencia_fim := (new.vigencia_inicio + interval '12 months')::date;
  end if;
  return new;
end; $$;
drop trigger if exists contrato_vigencia on public.contratos;
create trigger contrato_vigencia before insert or update on public.contratos
  for each row execute function private.contrato_vigencia();
