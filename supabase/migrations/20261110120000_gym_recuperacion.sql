-- Gym Intelligence · Fase F: registro diario de recuperación (sueño y sensaciones).
-- Migración incremental: solo crea una tabla nueva. No toca tablas ni filas existentes.
-- Una fila por persona y día. Todos los campos son opcionales salvo la fecha: se registra lo que se quiera.
-- Escalas 1–5: calidad del sueño y energía (5 = mejor); fatiga, dolor muscular y estrés (5 = peor).

create table if not exists public.recovery_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date           date not null,
  bed_time       time,
  wake_time      time,
  sleep_h        numeric(3,1) check (sleep_h is null or sleep_h between 0 and 16),
  sleep_quality  smallint check (sleep_quality is null or sleep_quality between 1 and 5),
  energy         smallint check (energy is null or energy between 1 and 5),
  fatigue        smallint check (fatigue is null or fatigue between 1 and 5),
  soreness       smallint check (soreness is null or soreness between 1 and 5),
  stress         smallint check (stress is null or stress between 1 and 5),
  sore_muscles   text[] not null default '{}' check (cardinality(sore_muscles) <= 20),
  notes          text not null default '' check (length(notes) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, date)
);

drop trigger if exists recovery_logs_touch on public.recovery_logs;
create trigger recovery_logs_touch before update on public.recovery_logs for each row execute function public.gym_touch_updated_at();

alter table public.recovery_logs enable row level security;
revoke all on table public.recovery_logs from public, anon;
revoke truncate on table public.recovery_logs from authenticated;
grant select, insert, update, delete on table public.recovery_logs to authenticated;

drop policy if exists recovery_logs_own on public.recovery_logs;
create policy recovery_logs_own on public.recovery_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Revertir (borra solo lo creado aquí, con sus datos):
-- drop table if exists public.recovery_logs;
