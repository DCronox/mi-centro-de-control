-- Gym · Fase 2: ejercicios, rutinas, entrenamientos, series y medidas corporales.
-- Migración incremental: solo crea objetos nuevos. No modifica mcc_data, notificaciones ni sus filas.
-- Cada fila pertenece a una persona (user_id) y RLS impide ver o tocar las de otras.
-- Revertir: ver el bloque al final (borra solo lo creado aquí, con sus datos).

-- Biblioteca de ejercicios propia de cada persona.
create table if not exists public.gym_exercises (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  muscle      text not null default 'Otro' check (length(muscle) <= 40),
  notes       text not null default '' check (length(notes) <= 300),
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists gym_exercises_user_name_uq on public.gym_exercises (user_id, lower(btrim(name)));

-- Rutinas: los ejercicios van en items (jsonb) con su orden y objetivos.
--   items = [{ "exercise_id": uuid, "sets": 3, "reps_min": 8, "reps_max": 12, "rest_s": 90, "notes": "" }, ...]
create table if not exists public.gym_routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 60),
  days        smallint[] not null default '{}' check (days <@ array[0,1,2,3,4,5,6]::smallint[]),
  items       jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 40),
  position    integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists gym_routines_user_idx on public.gym_routines (user_id);

-- Entrenamientos realizados. El id lo genera el navegador para poder reintentar sin duplicar.
create table if not exists public.gym_sessions (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id  uuid references public.gym_routines(id) on delete set null,
  name        text not null default '' check (length(name) <= 60),
  started_at  timestamptz not null,
  ended_at    timestamptz,
  notes       text not null default '' check (length(notes) <= 500),
  created_at  timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index if not exists gym_sessions_user_started_idx on public.gym_sessions (user_id, started_at desc);
create index if not exists gym_sessions_routine_idx on public.gym_sessions (routine_id);

-- Series de cada entrenamiento.
create table if not exists public.gym_sets (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id  uuid not null references public.gym_sessions(id) on delete cascade,
  exercise_id uuid not null references public.gym_exercises(id) on delete restrict,
  set_index   smallint not null check (set_index between 1 and 50),
  weight_kg   numeric(6,2) not null default 0 check (weight_kg between 0 and 1000),
  reps        smallint not null check (reps between 0 and 500),
  rpe         numeric(3,1) check (rpe is null or rpe between 1 and 10),
  created_at  timestamptz not null default now()
);
create index if not exists gym_sets_session_idx on public.gym_sets (session_id);
create index if not exists gym_sets_user_exercise_idx on public.gym_sets (user_id, exercise_id);
create index if not exists gym_sets_exercise_idx on public.gym_sets (exercise_id);

-- Peso y medidas corporales (una fila por día).
create table if not exists public.body_metrics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  weight_kg   numeric(5,2) check (weight_kg is null or weight_kg between 20 and 400),
  body_fat    numeric(4,1) check (body_fat is null or body_fat between 2 and 70),
  waist_cm    numeric(5,1) check (waist_cm is null or waist_cm between 30 and 250),
  chest_cm    numeric(5,1) check (chest_cm is null or chest_cm between 30 and 250),
  arm_cm      numeric(5,1) check (arm_cm is null or arm_cm between 10 and 100),
  thigh_cm    numeric(5,1) check (thigh_cm is null or thigh_cm between 20 and 150),
  hip_cm      numeric(5,1) check (hip_cm is null or hip_cm between 30 and 250),
  notes       text not null default '' check (length(notes) <= 300),
  created_at  timestamptz not null default now(),
  unique (user_id, date)
);

-- updated_at automático.
create or replace function public.gym_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists gym_exercises_touch on public.gym_exercises;
create trigger gym_exercises_touch before update on public.gym_exercises for each row execute function public.gym_touch_updated_at();
drop trigger if exists gym_routines_touch on public.gym_routines;
create trigger gym_routines_touch before update on public.gym_routines for each row execute function public.gym_touch_updated_at();

-- Seguridad.
alter table public.gym_exercises enable row level security;
alter table public.gym_routines  enable row level security;
alter table public.gym_sessions  enable row level security;
alter table public.gym_sets      enable row level security;
alter table public.body_metrics  enable row level security;

revoke all on table public.gym_exercises, public.gym_routines, public.gym_sessions, public.gym_sets, public.body_metrics from public, anon;
grant select, insert, update, delete on table public.gym_exercises, public.gym_routines, public.gym_sessions, public.gym_sets, public.body_metrics to authenticated;

do $$
declare t text;
begin
  foreach t in array array['gym_exercises','gym_routines','gym_sessions','body_metrics'] loop
    execute format('drop policy if exists %I on public.%I', t||'_own', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t||'_own', t);
  end loop;
end $$;

-- Las series además deben colgar de un entrenamiento y un ejercicio de la misma persona.
drop policy if exists gym_sets_own on public.gym_sets;
create policy gym_sets_own on public.gym_sets for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.gym_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.gym_exercises e where e.id = exercise_id and e.user_id = (select auth.uid()))
  );

-- Revertir (solo si hace falta; borra todos los datos de Gym):
-- drop table if exists public.gym_sets, public.gym_sessions, public.gym_routines, public.gym_exercises, public.body_metrics;
-- drop function if exists public.gym_touch_updated_at();
