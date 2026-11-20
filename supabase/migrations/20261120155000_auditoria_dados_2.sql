-- AUDITORIA (20/11/2026), parte 2.
-- WhatsApp de celular da Bahia com 10 dígitos (faltando o 9): sem ele o código de acesso não chega.
update public.membros
   set telefone_whatsapp = substr(regexp_replace(telefone_whatsapp, '\D', '', 'g'), 1, 2) || '9' || substr(regexp_replace(telefone_whatsapp, '\D', '', 'g'), 3)
 where id in ('ac89d2a3-41e7-4e8c-b6cd-1311551e6b5a', 'bcda4515-a105-49f0-84a4-c28b92ba318e', '7bad9c61-e6d1-478a-8726-635562ea32eb',
              '630b072c-33a6-407e-96fd-07f1de64889f', '20249da9-c205-44b5-b19d-88c369bc6f01')
   and length(regexp_replace(telefone_whatsapp, '\D', '', 'g')) = 10;

-- Cadastro só da empresa Legran (os sócios Bruna e Tiago já têm cadastro próprio): marcado como duplicado e oculto,
-- no mesmo padrão dos outros duplicados. Nada é apagado.
update public.membros set nome = '[duplicado] ' || nome, ativo = false
 where id = '3ec33ebb-7dc8-484d-a78e-c83d8471872d' and nome not like '[duplicado]%';
