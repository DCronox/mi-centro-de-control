-- Gym · clasificación muscular estructurada de los ejercicios.
-- Incremental y compatible: solo añade dos columnas opcionales a gym_exercises. No borra ni cambia datos.
--   catalog_key: clave estable del catálogo (js/gym/gym-muscles.js), p. ej. 'press_banca'.
--   muscles:     clasificación propia para ejercicios fuera del catálogo: {"gluteos":"P","isquiotibiales":"S"}.
-- La app enlaza sola al catálogo los ejercicios existentes cuyo nombre coincide.
alter table public.gym_exercises add column if not exists catalog_key text check (catalog_key is null or catalog_key ~ '^[a-z0-9_]{2,40}$');
alter table public.gym_exercises add column if not exists muscles jsonb not null default '{}'::jsonb check (jsonb_typeof(muscles) = 'object');
create unique index if not exists gym_exercises_user_catalog_uq on public.gym_exercises (user_id, catalog_key) where catalog_key is not null;

-- Revertir:
-- drop index if exists public.gym_exercises_user_catalog_uq;
-- alter table public.gym_exercises drop column if exists muscles, drop column if exists catalog_key;
