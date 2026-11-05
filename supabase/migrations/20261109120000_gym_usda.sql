-- Gym Intelligence · Fase D2: alimentos de referencia (USDA FoodData Central) con caché en el servidor.
-- Migración incremental: solo crea objetos nuevos. No toca tablas ni filas existentes.
-- La clave de USDA vive solo en la función Edge `food-search` (secreto USDA_API_KEY); el navegador nunca la ve.
-- Solo la función (rol de servicio) escribe en estas tablas.

-- Alimentos de referencia COMPARTIDOS (no son datos personales). Nutrientes por 100 g, tal como los publica FDC.
create table if not exists public.food_reference (
  id             uuid primary key default gen_random_uuid(),
  source         text not null check (source in ('usda')),
  source_id      text not null check (length(source_id) between 1 and 40),
  name_en        text not null check (length(name_en) between 1 and 200),
  data_type      text not null default '' check (length(data_type) <= 40),
  category       text not null default '' check (length(category) <= 80),
  kcal           numeric(6,1) not null default 0 check (kcal between 0 and 1000),
  protein_g      numeric(5,1) not null default 0 check (protein_g between 0 and 100),
  carbs_g        numeric(5,1) not null default 0 check (carbs_g between 0 and 100),
  fat_g          numeric(5,1) not null default 0 check (fat_g between 0 and 100),
  fiber_g        numeric(5,1) not null default 0 check (fiber_g between 0 and 100),
  energy_source  text not null default 'kcal' check (energy_source in ('kcal','atwater_specific','atwater_general','kj')),
  complete       boolean not null default true,
  portions       jsonb not null default '[]'::jsonb check (jsonb_typeof(portions) = 'array'),
  published      text not null default '' check (length(published) <= 20),
  fetched_at     timestamptz not null default now(),
  unique (source, source_id)
);

-- Caché de búsquedas: qué resultados devolvió USDA para cada consulta (30 días).
create table if not exists public.food_search_cache (
  query_norm   text primary key check (length(query_norm) between 1 and 80),
  query_en     text not null default '',
  source_ids   text[] not null default '{}',
  fetched_at   timestamptz not null default now()
);

-- Límite de uso por persona (búsquedas que llegan a USDA). Se limpia solo (se borran filas de más de 2 días).
create table if not exists public.food_search_log (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  at       timestamptz not null default now()
);
create index if not exists food_search_log_user_at_idx on public.food_search_log (user_id, at desc);

alter table public.food_reference    enable row level security;
alter table public.food_search_cache enable row level security;
alter table public.food_search_log   enable row level security;

-- Lectura de referencias para cualquier persona con sesión; nadie escribe desde el navegador.
revoke all on table public.food_reference, public.food_search_cache, public.food_search_log from public, anon, authenticated;
grant select on table public.food_reference to authenticated;
drop policy if exists food_reference_read on public.food_reference;
create policy food_reference_read on public.food_reference for select to authenticated using (true);

-- Revertir (borra solo lo creado aquí, con sus datos):
-- drop table if exists public.food_search_log, public.food_search_cache, public.food_reference;
