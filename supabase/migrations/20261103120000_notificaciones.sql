-- Notificaciones push: dispositivos suscritos e historial de avisos.
-- Migración incremental: solo crea objetos nuevos. No modifica public.mcc_data ni sus filas.
-- Reversión: ver el bloque «Revertir» al final (borra solo lo creado aquí).
begin;

-- Dispositivos (navegadores) que aceptaron recibir notificaciones.
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh      text not null check (length(p256dh) between 40 and 200),
  auth        text not null check (length(auth) between 10 and 100),
  device      text not null default 'Dispositivo' check (length(device) <= 80),
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  last_error  text,
  fail_count  integer not null default 0
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Historial: una fila por aviso. La clave (user_id, dedupe_key) impide enviar dos veces lo mismo.
create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  dedupe_key  text not null check (length(dedupe_key) <= 200),
  category    text not null check (category in ('finanzas','trabajo','metas','organizacion','sistema')),
  title       text not null check (length(title) <= 200),
  body        text not null default '' check (length(body) <= 500),
  tab         text not null default 'dash' check (length(tab) <= 20),
  fire_at     timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  delivered   integer not null default 0,
  status      text not null default 'pendiente' check (status in ('pendiente','enviada','sin_dispositivos','fallida')),
  read_at     timestamptz,
  unique (user_id, dedupe_key)
);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- Seguridad: cada persona solo ve y gestiona lo suyo. El envío lo hace la función del servidor
-- con la clave de servicio, que nunca llega al navegador.
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;

revoke all on table public.push_subscriptions from public, anon;
revoke all on table public.notifications from public, anon;
grant select, insert, delete on table public.push_subscriptions to authenticated;
grant update (enabled, device, last_seen) on table public.push_subscriptions to authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

drop policy if exists push_subs_select_own on public.push_subscriptions;
drop policy if exists push_subs_insert_own on public.push_subscriptions;
drop policy if exists push_subs_update_own on public.push_subscriptions;
drop policy if exists push_subs_delete_own on public.push_subscriptions;
create policy push_subs_select_own on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy push_subs_insert_own on public.push_subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy push_subs_update_own on public.push_subscriptions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy push_subs_delete_own on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
create policy notifications_update_own on public.notifications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Mantenimiento: borra avisos de más de 120 días (lo llama la función del servidor).
create or replace function public.prune_old_notifications()
returns integer language sql security definer set search_path = '' as $$
  with d as (delete from public.notifications where created_at < now() - interval '120 days' returning 1)
  select count(*)::integer from d;
$$;
revoke all on function public.prune_old_notifications() from public, anon, authenticated;

commit;

-- Verificación (solo lectura):
-- select relname, relrowsecurity from pg_class where relname in ('push_subscriptions','notifications');
-- select tablename, policyname, cmd from pg_policies where tablename in ('push_subscriptions','notifications') order by 1,2;

-- Revertir (solo si hace falta; borra el historial de notificaciones y los dispositivos suscritos):
-- begin;
-- drop function if exists public.prune_old_notifications();
-- drop table if exists public.notifications;
-- drop table if exists public.push_subscriptions;
-- commit;
