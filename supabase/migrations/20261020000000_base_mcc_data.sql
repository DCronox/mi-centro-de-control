-- MCC · Línea base: objetos que existían en producción antes de que el repositorio tuviera migraciones
-- (creados a mano en octubre de 2026). Reproduce EXACTAMENTE el estado observado en producción el 2026-11-15,
-- para que un proyecto nuevo (staging) quede igual que producción al aplicar las migraciones en orden.
-- Idempotente: en producción no cambia nada (la tabla, las políticas y la función ya existen así).
-- La migración 20261115120000_mcc_data_rls.sql es la que endurece estos permisos.

create table if not exists public.mcc_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.mcc_data enable row level security;

-- Políticas originales (solo se crean si la tabla no tiene ninguna).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mcc_data') then
    create policy "Cada usuario puede ver sus propios datos" on public.mcc_data for select to authenticated using (auth.uid() = user_id);
    create policy "Cada usuario puede guardar sus propios datos" on public.mcc_data for insert to authenticated with check (auth.uid() = user_id);
    create policy "Cada usuario puede actualizar sus propios datos" on public.mcc_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
    create policy "Cada usuario puede eliminar sus propios datos" on public.mcc_data for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- Permisos observados en producción (los concede Supabase por defecto a las tablas nuevas de public).
grant all on table public.mcc_data to anon, authenticated;

-- Eliminación de la propia cuenta (antes en FASE1B_ELIMINAR_CUENTA.sql). mcc_data y el resto caen en cascada.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- No incluido a propósito: el cron «mcc-notify», el secreto de Vault y notify_cron_secret()
-- (supabase/cron-notify.sql). En staging enviarían notificaciones reales.
