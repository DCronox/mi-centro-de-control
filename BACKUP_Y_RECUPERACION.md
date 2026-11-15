# Copia de seguridad y recuperación — Mi Centro de Control

Regla: **ninguna migración se aplica en producción sin una copia verificada del mismo día** y sin haberla probado antes en staging.

## 1. Hacer la copia (solo lectura, ~2 minutos)

1. Supabase › proyecto «Mi centro de control» › **SQL Editor** › nueva consulta.
2. Pega el contenido de [`tools/backup/export.sql`](tools/backup/export.sql) y pulsa **Run**. Devuelve una fila por tabla (15 tablas) con `tabla`, `filas`, `md5` y `datos`.
3. Pulsa **Export › JSON** y guarda el archivo **fuera del repositorio**, por ejemplo
   `C:\Users\<usuario>\Documents\MCC_respaldos\mcc-AAAA-MM-DD.json`.
   Contiene datos personales de todos los usuarios (incluidos datos de salud): no lo subas a GitHub, a chats ni a servicios en la nube sin cifrar.
4. Verifica la copia:
   ```
   node tools/backup/verify.mjs "C:\Users\<usuario>\Documents\MCC_respaldos\mcc-AAAA-MM-DD.json"
   ```
   Debe terminar con «Copia verificada: todas las tablas coinciden». Si alguna tabla dice FALLO, la copia **no sirve** (por ejemplo, el panel recortó un valor); repítela.

Qué incluye: cuentas (id, correo, fechas, metadatos de registro), `mcc_data`, notificaciones y todas las tablas de Gym, nutrición y recuperación.
Qué **no** incluye y por qué:
- Contraseñas: solo se pueden recuperar con las copias del propio Supabase (plan de pago) o pidiendo a cada persona que restablezca su contraseña.
- Claves de suscripción push: los dispositivos las recrean al reactivar las notificaciones.
- Cachés compartidas de USDA (`food_reference`, `food_search_cache`) y el registro de límites (`food_search_log`): se regeneran solas.

## 2. Probar la restauración (staging)

Una copia solo está verificada cuando se ha restaurado con éxito en otro proyecto:
1. Proyecto de staging en Supabase con las mismas migraciones (`supabase/migrations/` en orden).
2. Crear en staging las cuentas de la copia (mismo `id`) con la API de administración.
3. Insertar cada tabla desde el JSON (script de restauración: se preparará cuando exista el proyecto de staging).
4. Repetir `tools/backup/export.sql` en staging: los MD5 de cada tabla deben coincidir con los de la copia.

## 3. Recuperación ante un problema

| Situación | Acción |
|---|---|
| Una migración salió mal (permisos, políticas, columnas) | Ejecutar el bloque «Revertir» del final de esa migración. No toca filas. |
| Datos de un usuario dañados en `mcc_data` | Restaurar solo su fila desde la copia (`update mcc_data set data = … where user_id = …`), tras confirmarlo con la persona. La app de cada dispositivo guarda además una copia local previa a cada cambio grande (`mcc1-backup-before-cloud`). |
| Pérdida general de datos | Restaurar desde la copia verificada más reciente siguiendo el punto 2 sobre producción, con la app en mantenimiento. |

## 4. Frecuencia

- Antes de cada migración de producción (obligatorio).
- Semanal mientras haya usuarios reales, guardando las 4 últimas.
- Recomendado antes del lanzamiento comercial: plan de Supabase con copias automáticas y recuperación a un punto en el tiempo.
