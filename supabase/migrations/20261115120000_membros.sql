-- =============================================================================
-- Vigília · Fase 2 · Equipe (Agentes) e responsável por tarefa
-- =============================================================================

create table public.membros (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome        text not null check (char_length(btrim(nome)) between 1 and 60),
  funcao      text check (char_length(funcao) <= 40),           -- ex.: Design, Redação
  telefone    text check (telefone ~ '^[0-9]{10,15}$'),          -- só dígitos, com DDI (ex.: 5583999990000)
  ativo       boolean not null default true,
  ordem       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, nome),
  unique (id, user_id)   -- alvo da FK composta em tarefas
);

create index membros_user_ordem_idx on public.membros (user_id, ordem);

create trigger membros_updated_at
  before update on public.membros
  for each row execute function public.tocar_updated_at();

alter table public.membros enable row level security;

create policy "membros: ler os próprios"    on public.membros for select to authenticated using ((select auth.uid()) = user_id);
create policy "membros: criar os próprios"  on public.membros for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "membros: editar os próprios" on public.membros for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "membros: apagar os próprios" on public.membros for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.membros from anon;
grant select, insert, update, delete on public.membros to authenticated;

-- Responsável pela tarefa (nulo = o próprio usuário).
-- Mesmo dono obrigatório; se o membro for apagado, a tarefa fica sem responsável.
alter table public.tarefas
  add column responsavel_id uuid,
  add constraint tarefas_responsavel_fk
    foreign key (responsavel_id, user_id) references public.membros (id, user_id)
    on delete set null (responsavel_id);

create index tarefas_responsavel_idx on public.tarefas (responsavel_id) where responsavel_id is not null;

alter publication supabase_realtime add table public.membros;
