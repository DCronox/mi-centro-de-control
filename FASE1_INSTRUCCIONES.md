# Fase 1 — seguridad y conservación de datos

## Qué confirma el esquema recibido

`public.mcc_data` tiene una fila por usuario: `user_id` es su clave primaria y referencia `auth.users(id)` con borrado en cascada. Por eso las filas existentes ya pertenecen al UUID indicado en `user_id`. La migración no cambia filas, UUID ni datos JSON.

La aplicación conserva datos locales en el navegador. Esos datos no están en Supabase hasta que se elige guardarlos en una cuenta.

## Aplicar la migración

1. En Supabase, abre **SQL Editor** y ejecuta primero esta consulta de solo lectura para revisar las políticas actuales:

   ```sql
   select c.relrowsecurity as rls_enabled,
          p.policyname, p.cmd, p.roles, p.qual, p.with_check
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
   where n.nspname = 'public' and c.relname = 'mcc_data';
   ```

2. Revisa y ejecuta `FASE1_MIGRACION_RLS.sql`. El script solo sustituye políticas y permisos de `public.mcc_data`; no elimina ni reasigna filas. Las políticas antiguas de esa tabla se reemplazan porque una política permisiva anterior podría anular la protección al combinarse con una nueva.
3. Ejecuta las dos consultas de verificación que aparecen al final del archivo. Debe salir RLS activado y las políticas `mcc_data_select_own`, `mcc_data_insert_own` y `mcc_data_update_own`.

## Conservar los datos existentes

- **Datos ya guardados en la nube:** la clave foránea obliga a que cada fila tenga un usuario existente. Para comprobar el vínculo de tu cuenta, sustituye el correo en esta consulta:

  ```sql
  select u.id, u.email, d.updated_at
  from auth.users u
  left join public.mcc_data d on d.user_id = u.id
  where lower(u.email) = lower('TU_CORREO');
  ```

  No edites `user_id` si ya aparece una fila: la sincronización ya la identifica por la cuenta autenticada. Si la fila aparece ligada a otra cuenta, detente y revisa cuál cuenta usabas antes de cambiar nada.

- **Datos locales del navegador:** inicia sesión en la cuenta correcta. La aplicación mostrará opciones antes de subir o reemplazar datos. Si hay una copia en la nube, elige cargarla o reemplazarla conscientemente. Si no hay copia, podrás guardar los datos actuales o comenzar sin ellos. Antes de reemplazar la nube se solicita confirmación y se conserva una copia local de respaldo.
- **Respaldo adicional:** antes de migrar, usa **Copia de seguridad → Descargar copia** y guarda el JSON en un lugar privado. No lo subas a GitHub ni lo compartas; contiene información personal.

No hay que insertar filas manualmente ni cambiar el UUID de la tabla para migrar los datos del navegador.

## Hallazgos del frontend revisado

- La URL del proyecto y la clave `sb_publishable_...` son valores públicos para el cliente web. No encontré una clave `service_role` en los archivos de la aplicación revisados. No publiques nunca una clave secreta.
- No encontré etiquetas de analítica, píxeles de seguimiento ni iframes en `index.html`. Sí carga Supabase JS desde jsDelivr y fuentes desde Google Fonts; esos servicios reciben solicitudes del navegador. Se deben considerar en la política de privacidad/cookies antes de cerrar el trabajo legal.
- La sincronización segura depende de que ejecutes y verifiques esta migración. El código por sí solo no activa RLS en Supabase.

## Alcance

Esta entrega prepara los cambios locales y el SQL revisable. No ejecuta cambios en el proyecto Supabase ni publica el sitio. Tras aplicar la migración, verifica inicio de sesión, carga, guardado y aislamiento entre dos cuentas antes de distribuir la nueva versión.
