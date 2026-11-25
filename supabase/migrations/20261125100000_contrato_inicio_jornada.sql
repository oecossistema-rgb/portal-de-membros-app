-- Contrato no INÍCIO da jornada do membro novo (alinhado em 25/11/2026). Nada do que existe muda; só a ordem:
--   equipe manda o link do portal (manual) -> membro cria a senha -> WhatsApp com o link do formulário do contrato
--   -> revisão / envio / assinaturas na Autentique -> portal liberado -> cartão de membro + onboarding (como já é).
-- Membro novo = cadastrado com "Membro novo: passa pelo contrato" (contrato_pendente). Os membros de hoje não são afetados.

alter table public.membros add column if not exists contrato_pendente boolean not null default false;

-- Enquanto o contrato não for assinado por todos, ele ainda não é membro: sem acesso aos dados do portal.
create or replace function private.membro_ativo() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros m
    where m.auth_user_id = (select auth.uid()) and m.ativo = true and m.contrato_pendente = false
      and (m.is_admin = true or exists (
        select 1 from public.membros_onboarding o
        where o.membro_id = m.id and o.onboarding_concluido_em is not null)));
$$;

-- Criou a senha pela primeira vez (o login foi ligado ao cadastro) e é membro novo: manda o formulário do contrato.
create or replace function private.contrato_ao_criar_senha() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.contrato_pendente and new.auth_user_id is not null and old.auth_user_id is null then
    perform private.chamar_funcao('contratos', jsonb_build_object('acao', 'convidar', 'membro_id', new.id));
  end if;
  return new;
end;
$$;
drop trigger if exists contrato_ao_criar_senha on public.membros;
create trigger contrato_ao_criar_senha after update of auth_user_id on public.membros
  for each row execute function private.contrato_ao_criar_senha();

grant update (contrato_pendente) on public.membros to service_role;

-- O próprio membro não pode tirar a marcação de contrato pendente (só a equipe ou a liberação após as assinaturas).
create or replace function private.proteger_colunas_membro() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'authenticated' and not private.is_admin()
     and coalesce(current_setting('app.publicando_resumo', true), '') <> 'sim' then
    if new.ativo is distinct from old.ativo
       or new.is_admin is distinct from old.is_admin
       or new.equipe is distinct from old.equipe
       or new.email is distinct from old.email
       or new.auth_user_id is distinct from old.auth_user_id
       or new.resumo_publico is distinct from old.resumo_publico
       or new.resumo_publicado_em is distinct from old.resumo_publicado_em
       or new.contrato_pendente is distinct from old.contrato_pendente then
      raise exception 'Somente o administrador pode alterar esses campos';
    end if;
  end if;
  return new;
end; $$;

-- Membro novo criado já com login (aprovação de solicitação de acesso) e marcado para contrato: manda o formulário na hora.
create or replace function private.contrato_ao_criar_senha() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.contrato_pendente and new.auth_user_id is not null
     and (tg_op = 'INSERT' or old.auth_user_id is null) then
    perform private.chamar_funcao('contratos', jsonb_build_object('acao', 'convidar', 'membro_id', new.id));
  end if;
  return new;
end;
$$;
drop trigger if exists contrato_ao_criar_membro on public.membros;
create trigger contrato_ao_criar_membro after insert on public.membros
  for each row execute function private.contrato_ao_criar_senha();

-- Pessoa nova que cria a senha no portal (sem cadastro): não passa mais por aprovação. Vira cadastro de membro novo com
-- contrato pendente; o formulário do contrato sai no WhatsApp e tudo aparece em Administração > Contratos.
-- Quem já tem cadastro (mesmo e-mail ou WhatsApp) segue o caminho de sempre. Se algo falhar, cai na solicitação de acesso.
create or replace function private.solicitacao_automatica() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_fone text; v_nome text;
begin
  begin
    if not exists (select 1 from public.membros m where m.auth_user_id = new.id) then
      v_fone := nullif(left(regexp_replace(coalesce(new.raw_user_meta_data->>'whatsapp', ''), '\D', '', 'g'), 15), '');
      if v_fone is not null and length(v_fone) < 10 then v_fone := null; end if;
      v_nome := left(coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)), 120);
      if exists (select 1 from public.membros m where lower(m.email) = lower(new.email)
                 or (v_fone is not null and right(regexp_replace(coalesce(m.telefone_whatsapp, ''), '\D', '', 'g'), 8) = right(v_fone, 8))) then
        insert into public.solicitacoes_acesso (auth_user_id, email, nome, whatsapp)
        values (new.id, lower(new.email), v_nome, v_fone) on conflict (auth_user_id) do nothing;
      else
        begin
          insert into public.membros (nome, email, telefone_whatsapp, empresa, ativo, auth_user_id, is_admin, equipe, contrato_pendente)
          values (v_nome, lower(new.email), v_fone, nullif(trim(new.raw_user_meta_data->>'empresa'), ''), true, new.id, false, false, true);
        exception when others then
          insert into public.solicitacoes_acesso (auth_user_id, email, nome, whatsapp)
          values (new.id, lower(new.email), v_nome, v_fone) on conflict (auth_user_id) do nothing;
        end;
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;
