-- MCC · Copia lógica de los datos de usuarios (solo lectura).
-- Uso: Supabase › SQL Editor › pegar › Run › «Export» › JSON. Guardar el archivo FUERA del repositorio.
-- Devuelve una fila por tabla con: tabla, filas, md5 (calculado por la base de datos) y datos (JSON).
-- Después, verificar con: node tools/copias/verify.mjs <archivo.json>
--
-- No incluye: contraseñas (solo restaurables con las copias del proveedor), claves de suscripciones push
-- (los dispositivos las recrean al reactivar notificaciones) ni cachés compartidas de USDA (se regeneran).
with t(tabla, datos) as (
  select 'auth_users', (select coalesce(json_agg(x order by x.id), '[]') from (select id, email, created_at, email_confirmed_at, raw_user_meta_data from auth.users) x)::text
  union all select 'mcc_data',          (select coalesce(json_agg(x order by x.user_id), '[]') from public.mcc_data x)::text
  union all select 'notifications',     (select coalesce(json_agg(x order by x.id), '[]') from public.notifications x)::text
  union all select 'gym_exercises',     (select coalesce(json_agg(x order by x.id), '[]') from public.gym_exercises x)::text
  union all select 'gym_routines',      (select coalesce(json_agg(x order by x.id), '[]') from public.gym_routines x)::text
  union all select 'gym_sessions',      (select coalesce(json_agg(x order by x.id), '[]') from public.gym_sessions x)::text
  union all select 'gym_sets',          (select coalesce(json_agg(x order by x.id), '[]') from public.gym_sets x)::text
  union all select 'body_metrics',      (select coalesce(json_agg(x order by x.id), '[]') from public.body_metrics x)::text
  union all select 'gym_profiles',      (select coalesce(json_agg(x order by x.user_id), '[]') from public.gym_profiles x)::text
  union all select 'nutrition_targets', (select coalesce(json_agg(x order by x.id), '[]') from public.nutrition_targets x)::text
  union all select 'gym_audit',         (select coalesce(json_agg(x order by x.id), '[]') from public.gym_audit x)::text
  union all select 'food_logs',         (select coalesce(json_agg(x order by x.id), '[]') from public.food_logs x)::text
  union all select 'water_logs',        (select coalesce(json_agg(x order by x.id), '[]') from public.water_logs x)::text
  union all select 'food_custom',       (select coalesce(json_agg(x order by x.id), '[]') from public.food_custom x)::text
  union all select 'recovery_logs',     (select coalesce(json_agg(x order by x.id), '[]') from public.recovery_logs x)::text
)
select tabla, json_array_length(datos::json) as filas, md5(datos) as md5, datos, now() as exportado_en from t order by tabla;
