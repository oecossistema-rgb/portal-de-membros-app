-- WhatsApp no portal (26/11/2026): disparo em massa para membros e conversas com o membro, pelo mesmo número da Z-API.
-- Só administradores veem e usam. Nada aqui envia mensagem sozinho: o envio só começa quando alguém clica em Disparar.

-- Modelos de mensagem salvos (boas-vindas, lembrete de evento, aviso geral...).
create table if not exists public.wa_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 60),
  texto text not null check (char_length(texto) between 1 and 4000),
  midia_url text, midia_tipo text check (midia_tipo in ('imagem', 'documento')),
  criado_em timestamptz not null default now()
);

-- Um disparo = uma mensagem para um público.
create table if not exists public.wa_disparos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  texto text not null check (char_length(texto) between 1 and 4000),
  midia_url text, midia_tipo text check (midia_tipo in ('imagem', 'documento')), midia_nome text,
  publico jsonb not null,                      -- {tipo: todos|segmento|nao_acessou|evento|contrato_vencendo|lista, valor?, ids?}
  status text not null default 'enviando' check (status in ('agendado', 'enviando', 'pausado', 'concluido', 'cancelado')),
  agendado_para timestamptz,
  criado_por uuid references public.membros(id),
  criado_em timestamptz not null default now(),
  iniciado_em timestamptz, concluido_em timestamptz,
  proximo_envio_em timestamptz not null default now()
);

-- Cada pessoa do disparo (o relatório).
create table if not exists public.wa_envios (
  id uuid primary key default gen_random_uuid(),
  disparo_id uuid not null references public.wa_disparos(id) on delete cascade,
  membro_id uuid not null references public.membros(id) on delete cascade,
  telefone text not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'entregue', 'lido', 'falha', 'pulado')),
  motivo text,
  zapi_id text,
  enviado_em timestamptz, entregue_em timestamptz, lido_em timestamptz,
  unique (disparo_id, membro_id)
);
create index if not exists wa_envios_pend_idx on public.wa_envios (disparo_id) where status = 'pendente';
create index if not exists wa_envios_zapi_idx on public.wa_envios (zapi_id);

-- Conversas com o membro (o que chega pela Z-API e o que a equipe responde pelo portal).
create table if not exists public.wa_mensagens (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros(id) on delete cascade,
  direcao text not null check (direcao in ('entrada', 'saida')),
  texto text, midia_url text, midia_tipo text,
  zapi_id text unique,
  status text,                                  -- saída: enviado / entregue / lido / falha
  origem text not null default 'chat' check (origem in ('chat', 'disparo')),
  enviado_por uuid references public.membros(id),
  momento timestamptz not null default now(),
  lida boolean not null default false           -- entrada: a equipe já viu
);
create index if not exists wa_mensagens_membro_idx on public.wa_mensagens (membro_id, momento desc);

-- Quem respondeu SAIR não recebe mais disparos (conversas continuam).
alter table public.membros add column if not exists whatsapp_sem_disparo boolean not null default false;

alter table public.wa_modelos enable row level security;
alter table public.wa_disparos enable row level security;
alter table public.wa_envios enable row level security;
alter table public.wa_mensagens enable row level security;
create policy "wa_modelos_admin" on public.wa_modelos for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "wa_disparos_admin" on public.wa_disparos for select to authenticated using ((select private.is_admin()));
create policy "wa_envios_admin" on public.wa_envios for select to authenticated using ((select private.is_admin()));
create policy "wa_mensagens_admin" on public.wa_mensagens for select to authenticated using ((select private.is_admin()));
create policy "wa_mensagens_admin_lida" on public.wa_mensagens for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
grant select, insert, update, delete on public.wa_modelos to authenticated;
grant select on public.wa_disparos, public.wa_envios, public.wa_mensagens to authenticated;
grant update (lida) on public.wa_mensagens to authenticated;
grant select, insert, update, delete on public.wa_modelos, public.wa_disparos, public.wa_envios, public.wa_mensagens to service_role;

-- Limites do disparo (editáveis sem mexer no código).
insert into public.portal_config (chave, valor) values
  ('whatsapp_disparo', '{"intervalo_min_seg":20,"intervalo_max_seg":60,"limite_dia":300}')
on conflict (chave) do nothing;

-- A fila só chama a função quando existe disparo para andar (sem custo parado).
create or replace function private.whatsapp_fila() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.wa_disparos d
              where (d.status = 'enviando' or (d.status = 'agendado' and d.agendado_para <= now()))
                and d.proximo_envio_em <= now()) then
    perform private.chamar_funcao('whatsapp', '{"fila": true}'::jsonb);
  end if;
end; $$;
select cron.unschedule('whatsapp-fila') where exists (select 1 from cron.job where jobname = 'whatsapp-fila');
select cron.schedule('whatsapp-fila', '* * * * *', 'select private.whatsapp_fila()');

-- Atualização ao vivo das conversas na tela.
alter publication supabase_realtime add table public.wa_mensagens;

-- Disparo com PDF: a pasta de mídia do portal passa a aceitar PDF.
update storage.buckets set allowed_mime_types = array_append(allowed_mime_types, 'application/pdf') where id = 'portal-midia' and not ('application/pdf' = any(allowed_mime_types));
