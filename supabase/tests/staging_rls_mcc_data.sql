-- MCC 0.3 · Prueba de seguridad en STAGING (nunca en producción).
-- Requiere aplicadas 20261115120000_mcc_data_rls.sql y 20261115130000_gym_consentimiento.sql.
-- Crea dos usuarios ficticios (A y B), actúa como cada uno con el rol «authenticated» y como «anon»,
-- y comprueba que cada persona solo ve y modifica lo suyo y que la app sigue pudiendo leer y guardar.
-- Al final borra los usuarios ficticios (sus filas caen en cascada). No toca ningún otro dato.
-- Resultado: una fila por prueba con OK o FALLO.

create temp table if not exists _resultado (n int, prueba text, resultado text);
truncate _resultado;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000000a';
  b uuid := '00000000-0000-4000-8000-00000000000b';
  res text[] := '{}';
  cnt int;
  t timestamptz;
begin
  if exists (select 1 from auth.users where id in (a, b)) then
    raise exception 'Ya existen usuarios de prueba: ejecuta antes  delete from auth.users where id in (''%'', ''%'');', a, b;
  end if;
  insert into auth.users (id, aud, role, email, created_at, updated_at) values
    (a, 'authenticated', 'authenticated', 'prueba-a@example.test', now(), now()),
    (b, 'authenticated', 'authenticated', 'prueba-b@example.test', now(), now());

  -- Estructura tras la migración
  res := res || ('Políticas de mcc_data = 3: ' || case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'mcc_data') = 3 then 'OK' else 'FALLO' end);
  res := res || ('anon sin ningún permiso en mcc_data: ' || case when not (has_table_privilege('anon', 'public.mcc_data', 'select') or has_table_privilege('anon', 'public.mcc_data', 'insert') or has_table_privilege('anon', 'public.mcc_data', 'update') or has_table_privilege('anon', 'public.mcc_data', 'delete')) then 'OK' else 'FALLO' end);
  res := res || ('authenticated sin DELETE ni TRUNCATE en mcc_data: ' || case when not (has_table_privilege('authenticated', 'public.mcc_data', 'delete') or has_table_privilege('authenticated', 'public.mcc_data', 'truncate')) then 'OK' else 'FALLO' end);
  res := res || ('Columnas de consentimiento en gym_profiles: ' || case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'gym_profiles' and column_name in ('health_consent_at', 'health_consent_version')) = 2 then 'OK' else 'FALLO' end);

  -- ===== Usuario A =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    insert into public.mcc_data (user_id, data) values (a, '{"prueba":1}');
    res := res || 'A crea su fila (primer inicio de sesión): OK'::text;
  exception when others then res := res || ('A crea su fila: FALLO ' || sqlerrm); end;

  begin
    insert into public.mcc_data (user_id, data, updated_at) values (a, '{"prueba":2}', now())
      on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at;
    res := res || 'A guarda con upsert (como store.js): OK'::text;
  exception when others then res := res || ('A guarda con upsert: FALLO ' || sqlerrm); end;

  begin
    select updated_at into t from public.mcc_data where user_id = a;
    update public.mcc_data set data = '{"prueba":3}', updated_at = clock_timestamp() where user_id = a and updated_at = t;
    get diagnostics cnt = row_count;
    res := res || ('A guarda con control de versión (update … eq updated_at): ' || case when cnt = 1 then 'OK' else 'FALLO (' || cnt || ' filas)' end);
  exception when others then res := res || ('A guarda con control de versión: FALLO ' || sqlerrm); end;

  begin
    select count(*) into cnt from public.mcc_data where user_id = a and data ->> 'prueba' = '3';
    res := res || ('A lee su fila: ' || case when cnt = 1 then 'OK' else 'FALLO' end);
  exception when others then res := res || ('A lee su fila: FALLO ' || sqlerrm); end;

  begin
    insert into public.mcc_data (user_id, data) values (b, '{"intruso":true}');
    res := res || 'A no puede crear la fila de B: FALLO (se permitió)'::text;
  exception when others then res := res || ('A no puede crear la fila de B: ' || case when sqlstate = '42501' then 'OK' else 'FALLO ' || sqlerrm end); end;

  begin
    insert into public.gym_profiles (birth_year, sex, height_cm, weight_kg, goal, experience, occupation, walking, training_days, session_min, health_consent_at, health_consent_version)
      values (1995, 'x', 170, 70, 'fitness', 'beginner', 'sedentary', 'medium', 3, 60, now(), '2026-11-15');
    res := res || 'A guarda su evaluación Gym con consentimiento: OK'::text;
  exception when others then res := res || ('A guarda su evaluación Gym con consentimiento: FALLO ' || sqlerrm); end;

  begin
    update public.gym_profiles set health_consent_version = repeat('x', 21) where user_id = a;
    res := res || 'Versión de consentimiento > 20 caracteres rechazada: FALLO (se permitió)'::text;
  exception when others then res := res || ('Versión de consentimiento > 20 caracteres rechazada: ' || case when sqlstate = '23514' then 'OK' else 'FALLO ' || sqlerrm end); end;

  -- ===== Usuario B =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  begin
    insert into public.mcc_data (user_id, data) values (b, '{"soy":"B"}');
    res := res || 'B crea su fila: OK'::text;
  exception when others then res := res || ('B crea su fila: FALLO ' || sqlerrm); end;

  begin
    select count(*) into cnt from public.mcc_data;
    res := res || ('B solo ve su propia fila de mcc_data: ' || case when cnt = 1 and exists (select 1 from public.mcc_data where user_id = b) then 'OK' else 'FALLO (ve ' || cnt || ')' end);
  exception when others then res := res || ('B solo ve su propia fila: FALLO ' || sqlerrm); end;

  begin
    update public.mcc_data set data = '{"hackeado":true}' where user_id = a;
    get diagnostics cnt = row_count;
    res := res || ('B no puede modificar la fila de A: ' || case when cnt = 0 then 'OK' else 'FALLO (' || cnt || ' filas)' end);
  exception when others then res := res || ('B no puede modificar la fila de A: OK (' || sqlstate || ')'); end;

  begin
    insert into public.mcc_data (user_id, data) values (a, '{"hackeado":true}')
      on conflict (user_id) do update set data = excluded.data;
    res := res || 'B no puede sobrescribir a A con upsert: FALLO (se permitió)'::text;
  exception when others then res := res || ('B no puede sobrescribir a A con upsert: ' || case when sqlstate = '42501' then 'OK' else 'FALLO ' || sqlerrm end); end;

  begin
    delete from public.mcc_data where user_id = b;
    res := res || 'Nadie puede borrar filas de mcc_data directamente: FALLO (se permitió)'::text;
  exception when others then res := res || ('Nadie puede borrar filas de mcc_data directamente: ' || case when sqlstate = '42501' then 'OK' else 'FALLO ' || sqlerrm end); end;

  begin
    select count(*) into cnt from public.gym_profiles;
    res := res || ('B no ve la evaluación Gym de A: ' || case when cnt = 0 then 'OK' else 'FALLO (ve ' || cnt || ')' end);
  exception when others then res := res || ('B no ve la evaluación Gym de A: FALLO ' || sqlerrm); end;

  -- ===== Visitante sin sesión (anon) =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';

  begin
    select count(*) into cnt from public.mcc_data;
    res := res || 'anon no puede leer mcc_data: FALLO (se permitió)'::text;
  exception when others then res := res || ('anon no puede leer mcc_data: ' || case when sqlstate = '42501' then 'OK' else 'FALLO ' || sqlerrm end); end;

  begin
    insert into public.mcc_data (user_id, data) values (a, '{}');
    res := res || 'anon no puede escribir en mcc_data: FALLO (se permitió)'::text;
  exception when others then res := res || ('anon no puede escribir en mcc_data: ' || case when sqlstate = '42501' then 'OK' else 'FALLO ' || sqlerrm end); end;

  -- ===== Borrado de cuenta de A (como «Eliminar mi cuenta y mis datos») =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.delete_my_account();
    res := res || 'A puede eliminar su cuenta: OK'::text;
  exception when others then res := res || ('A puede eliminar su cuenta: FALLO ' || sqlerrm); end;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  res := res || ('Al eliminar la cuenta de A desaparecen sus datos (mcc_data y Gym): ' || case when not exists (select 1 from public.mcc_data where user_id = a) and not exists (select 1 from public.gym_profiles where user_id = a) and not exists (select 1 from auth.users where id = a) then 'OK' else 'FALLO' end);
  res := res || ('Los datos de B siguen intactos: ' || case when exists (select 1 from public.mcc_data where user_id = b and data ->> 'soy' = 'B') then 'OK' else 'FALLO' end);

  -- Limpieza: borra los usuarios ficticios (sus filas caen en cascada).
  delete from auth.users where id in (a, b);

  insert into _resultado select i, split_part(res[i], ': ', 1), substr(res[i], length(split_part(res[i], ': ', 1)) + 3) from generate_subscripts(res, 1) i;
end $$;

select n, prueba, resultado from _resultado
union all
select 99, '=== RESUMEN ===', (select count(*) filter (where resultado like 'OK%') || ' de ' || count(*) || ' pruebas superadas' from _resultado)
order by n;
