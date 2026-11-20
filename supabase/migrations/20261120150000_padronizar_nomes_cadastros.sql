-- AUDITORIA (20/11/2026): padronização de nomes e cadastros antes da liberação do portal.
-- 1) Nome de pessoa: se vier TODO EM MAIÚSCULAS ou todo em minúsculas, vira "Nome Sobrenome" (de/da/do/das/dos/e minúsculos).
--    Vale para os cadastros atuais e para os próximos (gatilho).
create or replace function private.nome_proprio(p text)
returns text language sql immutable set search_path = '' as $$
  select string_agg(
    case when lower(w) in ('de','da','do','das','dos','e') and ord > 1 then lower(w)
         else upper(left(w, 1)) || lower(substr(w, 2)) end, ' ' order by ord)
  from unnest(regexp_split_to_array(btrim(regexp_replace(p, '\s+', ' ', 'g')), ' ')) with ordinality as t(w, ord);
$$;

create or replace function private.padronizar_nome_membro()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.nome is not null and (new.nome = upper(new.nome) or new.nome = lower(new.nome)) then
    new.nome := private.nome_proprio(new.nome);
  end if;
  return new;
end;
$$;
drop trigger if exists padronizar_nome on public.membros;
create trigger padronizar_nome before insert or update of nome on public.membros
  for each row execute function private.padronizar_nome_membro();

update public.membros set nome = private.nome_proprio(nome) where nome = upper(nome) or nome = lower(nome);

-- 2) Empresas escritas em maiúsculas/minúsculas ou com erro de digitação (siglas mantidas).
update public.membros set empresa = 'RSM SIG Soluções 360 Contábil, BPO e Consultoria' where id = 'f2424b4d-1473-489b-a753-876d2f62cecb' and empresa = 'RSM SIG SOLUCOES 360 CONTABIL BPO E CONSULTORIA LTDA';
update public.membros set empresa = 'Nosle Capital' where empresa = 'NOSLE CAPITAL';
update public.membros set empresa = 'EcoPav / Loja Dona Bela' where empresa = 'ECOPAV / LOJA DONA BELA';
update public.membros set empresa = 'TSS Treinamento e Desenvolvimento' where empresa = 'TSS TREINAMENTO DESENVOLVIMENTO';
update public.membros set empresa = 'Kaupatez' where empresa = 'KAUPATEZ';
update public.membros set empresa = 'Grupo PDR' where empresa = 'GRUPO PDR';
update public.membros set empresa = 'Farmácias Helirene / Solverh Consultoria' where empresa = 'Farmácias HELIRENE / Solverh Consultoria';
update public.membros set empresa = 'SWS Alimentos / Kasa M Garcia / Escola Casulo' where empresa = 'sws alimentos / kasa m garcia / escola casulo';
update public.membros set empresa = 'Vanessa Bastos Advocacia e Consultoria Jurídica' where empresa = 'Vanessa Bastos Advocacia e Consultoria juríca';
update public.membros set empresa = 'Ecossistema Business' where empresa = 'Ecossistema Bussines';
update public.membros set empresa = 'Pátio São Paulo' where empresa = 'PátiSão Paulo';
-- Telefone digitado no lugar da empresa (fica vazio até a pessoa informar).
update public.membros set empresa = null where id = '77c5202b-6254-4930-ba3a-4363aafcf245' and empresa ~ '^[0-9 ()-]+$';

-- 3) Estado sempre como sigla; segmento e site sem valores sem sentido.
update public.membros set estado = 'BA' where estado in ('BAHIA', 'Bahia', 'bahia');
update public.membros set segmento = 'Software SaaS' where segmento = 'Software SAAS';
update public.membros set site_instagram = null where site_instagram in ('-', 'Instagram', 'instagram');
