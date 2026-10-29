-- Fase 1B: permite que cada usuario elimine su propia cuenta y sus datos desde la aplicación.
-- Ejecutar en Supabase > SQL Editor DESPUÉS de FASE1_MIGRACION_RLS.sql.
-- Solo borra la cuenta del usuario que llama (auth.uid()); mcc_data se borra en cascada
-- porque user_id referencia auth.users(id) con ON DELETE CASCADE.
begin;

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

commit;

-- Verificación: debe devolver una fila con security_definer = true
select p.proname, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'delete_my_account';
