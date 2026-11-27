-- Oferta nova (27/11/2026): toda vez que um membro publica uma oferta, a equipe recebe um aviso no grupo de WhatsApp
-- "GESTÃO DE CONTRATO" (o mesmo dos contratos). Só na criação; editar, pausar ou excluir não avisa.
create or replace function private.oferta_avisar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.chamar_funcao('whatsapp', jsonb_build_object('oferta_nova', new.id));
  return new;
end; $$;
drop trigger if exists oferta_avisar on public.ofertas;
create trigger oferta_avisar after insert on public.ofertas for each row execute function private.oferta_avisar();
