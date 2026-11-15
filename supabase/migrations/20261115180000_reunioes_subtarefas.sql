-- =============================================================================
-- Vigília · Fase 2 · Reuniões com pauta e subtarefas
-- =============================================================================

-- tarefas precisa de (id, user_id) único para as FKs compostas abaixo
alter table public.tarefas add constraint tarefas_id_user_unico unique (id, user_id);

-- -----------------------------------------------------------------------------
-- subtarefas
-- -----------------------------------------------------------------------------
create table public.subtarefas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tarefa_id   uuid not null,
  titulo      text not null check (char_length(btrim(titulo)) between 1 and 300),
  feita       boolean not null default false,
  ordem       double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint subtarefas_tarefa_fk
    foreign key (tarefa_id, user_id) references public.tarefas (id, user_id) on delete cascade
);

create index subtarefas_tarefa_idx on public.subtarefas (tarefa_id, ordem);

-- -----------------------------------------------------------------------------
-- reunioes
-- -----------------------------------------------------------------------------
create table public.reunioes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo      text not null check (char_length(btrim(titulo)) between 1 and 200),
  inicio      timestamptz not null,
  fim         timestamptz check (fim is null or fim > inicio),
  local       text check (char_length(local) <= 300),        -- sala ou link da chamada
  area_id     uuid,
  status      text not null default 'agendada' check (status in ('agendada', 'realizada', 'cancelada')),
  ata         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (id, user_id),
  constraint reunioes_area_fk
    foreign key (area_id, user_id) references public.areas (id, user_id) on delete set null (area_id)
);

create index reunioes_user_inicio_idx on public.reunioes (user_id, inicio);

-- Itens da pauta
create table public.reuniao_itens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reuniao_id  uuid not null,
  texto       text not null check (char_length(btrim(texto)) between 1 and 500),
  discutido   boolean not null default false,
  notas       text,
  ordem       double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint reuniao_itens_reuniao_fk
    foreign key (reuniao_id, user_id) references public.reunioes (id, user_id) on delete cascade
);

create index reuniao_itens_reuniao_idx on public.reuniao_itens (reuniao_id, ordem);

-- Convocados e presença (presente: null = não marcado)
create table public.reuniao_participantes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reuniao_id  uuid not null,
  membro_id   uuid not null,
  presente    boolean,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (reuniao_id, membro_id),
  constraint reuniao_participantes_reuniao_fk
    foreign key (reuniao_id, user_id) references public.reunioes (id, user_id) on delete cascade,
  constraint reuniao_participantes_membro_fk
    foreign key (membro_id, user_id) references public.membros (id, user_id) on delete cascade
);

create index reuniao_participantes_reuniao_idx on public.reuniao_participantes (reuniao_id);

-- Encaminhamentos: tarefa nascida numa reunião
alter table public.tarefas
  add column reuniao_id uuid,
  add constraint tarefas_reuniao_fk
    foreign key (reuniao_id, user_id) references public.reunioes (id, user_id)
    on delete set null (reuniao_id);

create index tarefas_reuniao_idx on public.tarefas (reuniao_id) where reuniao_id is not null;

-- -----------------------------------------------------------------------------
-- updated_at, RLS, grants, realtime — iguais para as quatro tabelas
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['subtarefas', 'reunioes', 'reuniao_itens', 'reuniao_participantes'] loop
    execute format('create trigger %1$s_updated_at before update on public.%1$I for each row execute function public.tocar_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: ler os próprios"    on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: criar os próprios"  on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: editar os próprios" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: apagar os próprios" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end
$$;
