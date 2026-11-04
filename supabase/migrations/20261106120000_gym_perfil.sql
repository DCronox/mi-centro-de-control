-- Gym Intelligence · Fase B: evaluación inicial, objetivos nutricionales y auditoría.
-- Migración incremental: solo crea objetos nuevos. No toca tablas ni filas existentes.
-- Cada fila pertenece a una persona (user_id); RLS impide ver o tocar las de otras. Sin acceso anónimo.
-- Simplificación respecto al plan: metas y banderas de seguridad viven en gym_profiles (una fila por persona)
-- en lugar de tablas aparte; así se editan y borran juntas.

-- Evaluación inicial (una por persona). Editable y borrable por su dueño.
create table if not exists public.gym_profiles (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  birth_year       smallint not null check (birth_year between 1900 and 2100),
  sex              text not null check (sex in ('m','f','x')),
  height_cm        numeric(5,1) not null check (height_cm between 120 and 230),
  weight_kg        numeric(5,2) not null check (weight_kg between 30 and 300),
  goal             text not null check (goal in ('fat_loss','muscle_gain','recomp','strength','maintenance','fitness')),
  secondary_goals  text[] not null default '{}' check (secondary_goals <@ array['fat_loss','muscle_gain','recomp','strength','maintenance','fitness']),
  experience       text not null check (experience in ('none','beginner','intermediate','advanced')),
  occupation       text not null check (occupation in ('sedentary','standing','active','heavy')),
  walking          text not null check (walking in ('low','medium','high')),
  training_days    smallint not null check (training_days between 0 and 7),
  session_min      smallint not null check (session_min between 0 and 240),
  cardio_min_week  smallint not null default 0 check (cardio_min_week between 0 and 1500),
  equipment        text not null default 'gym' check (equipment in ('gym','home','bodyweight','mixed')),
  sleep_hours      numeric(3,1) check (sleep_hours is null or sleep_hours between 0 and 16),
  -- Banderas de seguridad opcionales: activan el modo prudente o la recomendación profesional.
  pregnant         boolean not null default false,
  lactating        boolean not null default false,
  condition        boolean not null default false,
  medication       boolean not null default false,
  eating_disorder  boolean not null default false,
  notes            text not null default '' check (length(notes) <= 500),
  assessment_version smallint not null default 1,
  completed_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Historial de objetivos nutricionales. Nunca se sobrescribe: cada cambio es una fila nueva.
create table if not exists public.nutrition_targets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status           text not null check (status in ('proposed','accepted','manual','superseded')),
  effective_from   date not null default ((now() at time zone 'America/Bogota')::date),
  kcal             integer check (kcal is null or kcal between 800 and 8000),
  protein_g        smallint check (protein_g is null or protein_g between 0 and 600),
  carbs_g          smallint check (carbs_g is null or carbs_g between 0 and 1500),
  fat_g            smallint check (fat_g is null or fat_g between 0 and 400),
  fiber_g          smallint check (fiber_g is null or fiber_g between 0 and 150),
  water_ml         integer check (water_ml is null or water_ml between 0 and 10000),
  method           text not null default '' check (length(method) <= 60),
  engine_version   text not null default '' check (length(engine_version) <= 20),
  -- Entradas, rango de incertidumbre, pasos y referencias usados (para explicar el cálculo después).
  details          jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and pg_column_size(details) < 20000),
  created_at       timestamptz not null default now()
);
create index if not exists nutrition_targets_user_created_idx on public.nutrition_targets (user_id, created_at desc);

-- Auditoría: solo metadatos (qué tabla, qué acción, qué campos cambiaron), nunca los valores,
-- para que borrar el perfil borre de verdad los datos de salud. Solo la escriben los triggers.
create table if not exists public.gym_audit (
  id          bigint generated always as identity primary key,
  -- Sin clave foránea a propósito: al eliminar la cuenta (borrado en cascada) el trigger no debe poder
  -- bloquear el borrado. El trigger no escribe si la cuenta ya no existe.
  user_id     uuid not null,
  table_name  text not null,
  action      text not null check (action in ('INSERT','UPDATE','DELETE')),
  fields      text[] not null default '{}',
  at          timestamptz not null default now()
);
create index if not exists gym_audit_user_at_idx on public.gym_audit (user_id, at desc);

create or replace function public.gym_audit_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare changed text[] := '{}'; k text;
begin
  if tg_op = 'UPDATE' then
    for k in select key from jsonb_each(to_jsonb(new)) loop
      if k not in ('updated_at') and (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
        changed := changed || k;
      end if;
    end loop;
    if cardinality(changed) = 0 then return new; end if;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from auth.users u where u.id = old.user_id) then
    delete from public.gym_audit a where a.user_id = old.user_id;
    return old; -- borrado de la cuenta completa: no se deja rastro
  end if;
  insert into public.gym_audit (user_id, table_name, action, fields)
  values (coalesce(new.user_id, old.user_id), tg_table_name, tg_op, changed);
  return coalesce(new, old);
end;
$$;
revoke all on function public.gym_audit_write() from public, anon, authenticated;

drop trigger if exists gym_profiles_touch on public.gym_profiles;
create trigger gym_profiles_touch before update on public.gym_profiles for each row execute function public.gym_touch_updated_at();
drop trigger if exists gym_profiles_audit on public.gym_profiles;
create trigger gym_profiles_audit after insert or update or delete on public.gym_profiles for each row execute function public.gym_audit_write();
drop trigger if exists nutrition_targets_audit on public.nutrition_targets;
create trigger nutrition_targets_audit after insert or update or delete on public.nutrition_targets for each row execute function public.gym_audit_write();

-- Seguridad.
alter table public.gym_profiles      enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.gym_audit         enable row level security;

revoke all on table public.gym_profiles, public.nutrition_targets, public.gym_audit from public, anon;
grant select, insert, update, delete on table public.gym_profiles, public.nutrition_targets to authenticated;
grant select on table public.gym_audit to authenticated;

drop policy if exists gym_profiles_own on public.gym_profiles;
create policy gym_profiles_own on public.gym_profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists nutrition_targets_own on public.nutrition_targets;
create policy nutrition_targets_own on public.nutrition_targets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists gym_audit_read_own on public.gym_audit;
create policy gym_audit_read_own on public.gym_audit for select to authenticated
  using ((select auth.uid()) = user_id);

-- Revertir (borra solo lo creado aquí, con sus datos):
-- drop table if exists public.gym_audit, public.nutrition_targets, public.gym_profiles;
-- drop function if exists public.gym_audit_write();
