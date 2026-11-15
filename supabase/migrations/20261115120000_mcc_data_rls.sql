-- MCC 0.3 · Fase 0: seguridad de public.mcc_data (basada en FASE1_MIGRACION_RLS.sql, nunca aplicada).
-- NO modifica ni elimina filas. Solo cambia permisos y políticas.
--
-- Cambios:
--  1. anon pierde todo permiso sobre mcc_data (hoy conserva SELECT/INSERT/DELETE, bloqueados solo por RLS).
--  2. authenticated queda con SELECT, INSERT y UPDATE (la app nunca borra mcc_data: el borrado de cuenta
--     usa delete_my_account(), que elimina auth.users y la fila cae por ON DELETE CASCADE).
--  3. Políticas con (select auth.uid()) para evaluarse una vez por consulta (aviso del asesor de rendimiento).
--  4. rls_auto_enable() (disparador de eventos de la plataforma) deja de ser ejecutable por clientes;
--     el disparador sigue funcionando porque lo ejecuta el sistema.
--
-- Requisitos antes de aplicar en producción: copia de seguridad verificada (BACKUP_Y_RECUPERACION.md)
-- y prueba en staging con dos usuarios (lectura y escritura cruzadas rechazadas).
begin;

alter table public.mcc_data enable row level security;

-- Sustituye todas las políticas actuales (incluidas posibles permisivas que darían acceso por OR).
do $$
declare policy_row record;
begin
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'mcc_data' loop
    execute format('drop policy %I on public.mcc_data', policy_row.policyname);
  end loop;
end $$;

revoke all on table public.mcc_data from public, anon, authenticated;
grant select, insert, update on table public.mcc_data to authenticated;

create policy mcc_data_select_own on public.mcc_data for select to authenticated
  using ((select auth.uid()) = user_id);
create policy mcc_data_insert_own on public.mcc_data for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy mcc_data_update_own on public.mcc_data for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

commit;

-- Verificación (debe devolver rls=true, 3 políticas, anon sin permisos, authenticated sin DELETE/TRUNCATE):
-- select c.relrowsecurity rls,
--   (select count(*) from pg_policies p where p.tablename = 'mcc_data') politicas,
--   has_table_privilege('anon', c.oid, 'select') anon_sel,
--   has_table_privilege('authenticated', c.oid, 'delete') auth_del,
--   has_table_privilege('authenticated', c.oid, 'truncate') auth_trunc
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'mcc_data';

-- Revertir (restaura exactamente el estado observado el 2026-11-15):
-- begin;
-- drop policy if exists mcc_data_select_own on public.mcc_data;
-- drop policy if exists mcc_data_insert_own on public.mcc_data;
-- drop policy if exists mcc_data_update_own on public.mcc_data;
-- create policy "Cada usuario puede ver sus propios datos" on public.mcc_data for select to authenticated using (auth.uid() = user_id);
-- create policy "Cada usuario puede guardar sus propios datos" on public.mcc_data for insert to authenticated with check (auth.uid() = user_id);
-- create policy "Cada usuario puede actualizar sus propios datos" on public.mcc_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "Cada usuario puede eliminar sus propios datos" on public.mcc_data for delete to authenticated using (auth.uid() = user_id);
-- grant all on table public.mcc_data to anon, authenticated;  -- estado observado: ambos roles con todos los permisos
-- grant execute on function public.rls_auto_enable() to public, anon, authenticated;
-- commit;
