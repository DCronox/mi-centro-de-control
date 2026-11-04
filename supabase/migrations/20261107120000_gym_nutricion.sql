-- Gym Intelligence · Fase C: registro de comidas y agua (base del panel nutricional).
-- Migración incremental: solo crea objetos nuevos. No toca tablas ni filas existentes.
-- La fase D (catálogo, texto natural, USDA) reutiliza food_logs: por eso ya guarda fuente, texto original
-- y marca de estimación. Cada registro guarda una COPIA de los nutrientes para que el pasado no cambie.

create table if not exists public.food_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date           date not null,
  meal           text not null check (meal in ('breakfast','lunch','dinner','snack')),
  name           text not null check (length(btrim(name)) between 1 and 120),
  quantity       numeric(7,2) check (quantity is null or quantity between 0 and 10000),
  unit           text not null default '' check (length(unit) <= 30),
  grams          numeric(7,1) check (grams is null or grams between 0 and 10000),
  kcal           numeric(6,1) not null default 0 check (kcal between 0 and 5000),
  protein_g      numeric(5,1) not null default 0 check (protein_g between 0 and 500),
  carbs_g        numeric(5,1) not null default 0 check (carbs_g between 0 and 1000),
  fat_g          numeric(5,1) not null default 0 check (fat_g between 0 and 500),
  fiber_g        numeric(5,1) not null default 0 check (fiber_g between 0 and 200),
  source         text not null default 'manual' check (source in ('manual','text','usda','icbf','custom')),
  source_ref     text not null default '' check (length(source_ref) <= 80),
  original_text  text not null default '' check (length(original_text) <= 300),
  estimated      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists food_logs_user_date_idx on public.food_logs (user_id, date desc);

-- Agua: varias entradas por día (así «deshacer» quita solo la última).
create table if not exists public.water_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  ml          integer not null check (ml between 1 and 5000),
  created_at  timestamptz not null default now()
);
create index if not exists water_logs_user_date_idx on public.water_logs (user_id, date desc);

drop trigger if exists food_logs_touch on public.food_logs;
create trigger food_logs_touch before update on public.food_logs for each row execute function public.gym_touch_updated_at();

alter table public.food_logs  enable row level security;
alter table public.water_logs enable row level security;

revoke all on table public.food_logs, public.water_logs from public, anon;
revoke truncate on table public.food_logs, public.water_logs from authenticated;
grant select, insert, update, delete on table public.food_logs, public.water_logs to authenticated;

drop policy if exists food_logs_own on public.food_logs;
create policy food_logs_own on public.food_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists water_logs_own on public.water_logs;
create policy water_logs_own on public.water_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Revertir (borra solo lo creado aquí, con sus datos):
-- drop table if exists public.food_logs, public.water_logs;
