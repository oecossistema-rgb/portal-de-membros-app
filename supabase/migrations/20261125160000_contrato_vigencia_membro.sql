-- Correção (25/11/2026): a vigência começa quando o MEMBRO assina (não quando todos assinam).
-- Com sócio, vale a data em que o último participante assinou. Fim = início + 12 meses.
create or replace function private.contrato_vigencia() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_part int; v_ok int; v_data timestamptz;
begin
  if new.vigencia_inicio is null and jsonb_typeof(new.assinaturas) = 'array' then
    select count(*), count(a->>'assinado_em'), max((a->>'assinado_em')::timestamptz)
      into v_part, v_ok, v_data
      from jsonb_array_elements(new.assinaturas) a where a->>'papel' = 'Participante';
    if v_part > 0 and v_ok = v_part then
      new.vigencia_inicio := (v_data at time zone 'America/Bahia')::date;
    end if;
  end if;
  if new.status = 'assinado' and new.vigencia_inicio is null then
    new.vigencia_inicio := (coalesce(new.assinado_em, now()) at time zone 'America/Bahia')::date;
  end if;
  if new.vigencia_inicio is not null and new.vigencia_fim is null then
    new.vigencia_fim := (new.vigencia_inicio + interval '12 months')::date;
  end if;
  return new;
end; $$;
