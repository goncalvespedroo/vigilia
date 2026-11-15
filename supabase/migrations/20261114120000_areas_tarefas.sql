-- =============================================================================
-- Vigília · Fase 1 · Áreas e Tarefas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.tarefa_tipo as enum ('tarefa', 'prova', 'entrega', 'trabalho_grupo', 'reuniao');
create type public.tarefa_status as enum ('a_fazer', 'fazendo', 'feito');
create type public.tarefa_prioridade as enum ('baixa', 'normal', 'alta', 'maxima');

-- -----------------------------------------------------------------------------
-- Função utilitária: mantém updated_at
-- -----------------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- areas
-- -----------------------------------------------------------------------------
create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome        text not null check (char_length(btrim(nome)) between 1 and 60),
  codigo      text check (codigo ~ '^[A-Z0-9-]{1,12}$'),         -- ex.: OP-0012
  cor         text check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ordem       integer not null default 0,
  arquivada   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, nome),
  -- alvo da FK composta em tarefas (garante área do mesmo dono)
  unique (id, user_id)
);

create index areas_user_ordem_idx on public.areas (user_id, ordem);

create trigger areas_updated_at
  before update on public.areas
  for each row execute function public.tocar_updated_at();

-- -----------------------------------------------------------------------------
-- tarefas
-- -----------------------------------------------------------------------------
create table public.tarefas (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  numero             bigint generated always as identity,          -- código curto exibível (#0042)
  area_id            uuid,
  titulo             text not null check (char_length(btrim(titulo)) between 1 and 300),
  descricao          text,
  tipo               public.tarefa_tipo       not null default 'tarefa',
  status             public.tarefa_status     not null default 'a_fazer',
  prioridade         public.tarefa_prioridade not null default 'normal',
  prazo              timestamptz,
  prazo_dia_inteiro  boolean not null default false,               -- true = "até o fim do dia", sem hora
  ordem              double precision not null default 0,          -- posição na coluna do Kanban
  concluida_em       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- A área precisa ser do mesmo usuário. Se a área for apagada, a tarefa fica sem área.
  constraint tarefas_area_fk
    foreign key (area_id, user_id) references public.areas (id, user_id)
    on delete set null (area_id)
);

-- Fase 2 adiciona: responsavel_id (membros) e a tabela de subtarefas.

create index tarefas_user_status_idx on public.tarefas (user_id, status, ordem);
create index tarefas_user_prazo_idx  on public.tarefas (user_id, prazo) where status <> 'feito';
create index tarefas_area_idx        on public.tarefas (area_id);

create trigger tarefas_updated_at
  before update on public.tarefas
  for each row execute function public.tocar_updated_at();

-- Preenche/limpa concluida_em conforme o status (alimenta "encerradas na semana").
create or replace function public.tarefas_marcar_conclusao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'feito' and (tg_op = 'INSERT' or old.status is distinct from 'feito') then
    new.concluida_em := coalesce(new.concluida_em, now());
  elsif new.status <> 'feito' then
    new.concluida_em := null;
  end if;
  return new;
end;
$$;

create trigger tarefas_conclusao
  before insert or update of status on public.tarefas
  for each row execute function public.tarefas_marcar_conclusao();

-- -----------------------------------------------------------------------------
-- Row Level Security: cada usuário só enxerga e altera o que é seu
-- -----------------------------------------------------------------------------
alter table public.areas   enable row level security;
alter table public.tarefas enable row level security;

create policy "areas: ler as próprias"      on public.areas for select to authenticated using ((select auth.uid()) = user_id);
create policy "areas: criar as próprias"    on public.areas for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "areas: editar as próprias"   on public.areas for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "areas: apagar as próprias"   on public.areas for delete to authenticated using ((select auth.uid()) = user_id);

create policy "tarefas: ler as próprias"    on public.tarefas for select to authenticated using ((select auth.uid()) = user_id);
create policy "tarefas: criar as próprias"  on public.tarefas for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tarefas: editar as próprias" on public.tarefas for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tarefas: apagar as próprias" on public.tarefas for delete to authenticated using ((select auth.uid()) = user_id);

-- Acesso pela Data API apenas para usuários logados.
revoke all on public.areas, public.tarefas from anon;
grant select, insert, update, delete on public.areas, public.tarefas to authenticated;

-- -----------------------------------------------------------------------------
-- Áreas padrão para cada novo usuário (personalizáveis depois)
-- -----------------------------------------------------------------------------
create or replace function public.criar_areas_padrao(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.areas (user_id, nome, codigo, cor, ordem) values
    (p_user_id, 'Faculdade', 'OP-0044', '#8AB4F8', 1),
    (p_user_id, 'Equipe',    'OP-0031', '#E2A336', 2),
    (p_user_id, 'TCC',       'OP-0012', '#E5484D', 3),
    (p_user_id, 'Pessoal',   'OP-0050', '#7CF08A', 4)
  on conflict (user_id, nome) do nothing;
$$;

revoke execute on function public.criar_areas_padrao(uuid) from public, anon, authenticated;

create or replace function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.criar_areas_padrao(new.id);
  return new;
end;
$$;

revoke execute on function public.ao_criar_usuario() from public, anon, authenticated;

create trigger vigilia_ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- Usuários que já existiam antes desta migração também ganham as áreas padrão.
select public.criar_areas_padrao(id) from auth.users;

-- -----------------------------------------------------------------------------
-- Realtime: sincronização entre dispositivos
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.areas, public.tarefas;
