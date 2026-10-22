-- Fase 1: seguridad de la tabla public.mcc_data
-- No modifica ni elimina filas. Sustituye todas las políticas actuales de esta tabla.
-- Ejecutar en Supabase > SQL Editor, después de revisar el estado actual.
begin;

alter table public.mcc_data enable row level security;

-- Elimina políticas anteriores de esta tabla, incluidas políticas permisivas que
-- podrían seguir dando acceso por OR aunque existiera una política más estricta.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mcc_data'
  loop
    execute format('drop policy %I on public.mcc_data', policy_row.policyname);
  end loop;
end
$$;

revoke all on table public.mcc_data from public, anon;
grant select, insert, update on table public.mcc_data to authenticated;

create policy "mcc_data_select_own"
  on public.mcc_data for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "mcc_data_insert_own"
  on public.mcc_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "mcc_data_update_own"
  on public.mcc_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;

-- Verificación manual posterior: RLS debe aparecer activado y deben existir
-- únicamente las tres políticas propias de arriba.
select c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'mcc_data';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'mcc_data'
order by policyname;
