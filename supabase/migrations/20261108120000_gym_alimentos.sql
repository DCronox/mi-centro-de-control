-- Gym Intelligence · Fase D1: alimentos propios de cada persona.
-- Migración incremental: solo crea una tabla nueva. No toca tablas ni filas existentes.
-- Los nutrientes son los que la persona escribe para UNA porción (p. ej. 100 g, 1 unidad, 1 vaso).
-- grams_per_serving (opcional) permite convertir esa porción a gramos. Los registros de food_logs guardan
-- su propia copia de los nutrientes, así que editar o borrar un alimento propio no cambia el historial.

create table if not exists public.food_custom (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name               text not null check (length(btrim(name)) between 1 and 120),
  aliases            text[] not null default '{}' check (cardinality(aliases) <= 10),
  serving_qty        numeric(7,2) not null default 100 check (serving_qty > 0 and serving_qty <= 10000),
  serving_unit       text not null default 'g' check (length(btrim(serving_unit)) between 1 and 30),
  grams_per_serving  numeric(7,1) check (grams_per_serving is null or grams_per_serving between 0.1 and 10000),
  kcal               numeric(6,1) not null default 0 check (kcal between 0 and 5000),
  protein_g          numeric(5,1) not null default 0 check (protein_g between 0 and 500),
  carbs_g            numeric(5,1) not null default 0 check (carbs_g between 0 and 1000),
  fat_g              numeric(5,1) not null default 0 check (fat_g between 0 and 500),
  fiber_g            numeric(5,1) not null default 0 check (fiber_g between 0 and 200),
  notes              text not null default '' check (length(notes) <= 300),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists food_custom_user_name_uq on public.food_custom (user_id, lower(btrim(name)));

drop trigger if exists food_custom_touch on public.food_custom;
create trigger food_custom_touch before update on public.food_custom for each row execute function public.gym_touch_updated_at();

alter table public.food_custom enable row level security;
revoke all on table public.food_custom from public, anon;
revoke truncate on table public.food_custom from authenticated;
grant select, insert, update, delete on table public.food_custom to authenticated;

drop policy if exists food_custom_own on public.food_custom;
create policy food_custom_own on public.food_custom for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Revertir (borra solo lo creado aquí, con sus datos):
-- drop table if exists public.food_custom;
