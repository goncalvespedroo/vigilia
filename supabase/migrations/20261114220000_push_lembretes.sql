-- =============================================================================
-- Vigília · Fase 1 · Notificações push e lembretes
-- =============================================================================

-- Extensões (plano gratuito): agendador e HTTP de saída
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- -----------------------------------------------------------------------------
-- push_subscriptions: um registro por navegador/dispositivo com push ativo
-- -----------------------------------------------------------------------------
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  fuso         text not null default 'America/Sao_Paulo',   -- fuso IANA do dispositivo
  dispositivo  text,                                         -- rótulo amigável (ex.: "Chrome · Linux")
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.tocar_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "push: ler as próprias"    on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "push: criar as próprias"  on public.push_subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "push: editar as próprias" on public.push_subscriptions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "push: apagar as próprias" on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- -----------------------------------------------------------------------------
-- lembretes: registro do que já foi enviado (evita notificação duplicada)
--   tipo: '1h' (1h antes) · 'dia' (8h do dia) · 'vespera' (20h da véspera) · 'resumo' (7h30)
--   referencia: prazo da tarefa (ISO) ou a data local do resumo — se o prazo
--   mudar, a referência muda e o lembrete volta a valer.
-- -----------------------------------------------------------------------------
create table public.lembretes (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  tarefa_id   uuid references public.tarefas (id) on delete cascade,
  tipo        text not null check (tipo in ('1h', 'dia', 'vespera', 'resumo')),
  referencia  text not null,
  enviado_em  timestamptz not null default now(),

  constraint lembretes_unico unique nulls not distinct (user_id, tarefa_id, tipo, referencia)
);

create index lembretes_user_idx on public.lembretes (user_id, enviado_em desc);

-- Só leitura pelo app; quem escreve é a Edge Function (service role ignora RLS).
alter table public.lembretes enable row level security;
create policy "lembretes: ler os próprios" on public.lembretes for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.lembretes from anon;
grant select on public.lembretes to authenticated;

-- -----------------------------------------------------------------------------
-- Agendamento: a cada 5 minutos, chama a Edge Function "lembretes".
-- URL e segredo ficam no Vault (configurados uma vez, fora das migrações):
--   vigilia_url_funcao   → https://<ref>.supabase.co/functions/v1/lembretes
--   vigilia_cron_secret  → mesmo valor de VIGILIA_CRON_SECRET da função
-- -----------------------------------------------------------------------------
select cron.schedule(
  'vigilia-lembretes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'vigilia_url_funcao'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-vigilia-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'vigilia_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  )
  where exists (select 1 from public.push_subscriptions);
  $$
);
