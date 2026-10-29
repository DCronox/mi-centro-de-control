# Fase 1 — configuración que debe completar el propietario

## 1. Textos legales
Los avisos locales ya están diligenciados con Estiben Caro, Medellín, Colombia, esticarored@gmail.com y Supabase us-east-1 (North Virginia). Verifica que sigan siendo correctos antes de cambiar la URL o el proveedor de alojamiento. El contenido es informativo y no reemplaza una revisión jurídica profesional.

## 2. Supabase (acciones aún pendientes de verificación)
1. SQL Editor: ejecuta `FASE1_MIGRACION_RLS.sql` y luego `FASE1B_ELIMINAR_CUENTA.sql`. Corre las consultas de verificación de cada archivo.
2. Authentication > Sign In / Providers > Email: deja activada la confirmación de correo y sube la longitud mínima de contraseña a 8.
3. Authentication > URL Configuration: pon como Site URL la dirección publicada y agrégala en Redirect URLs (sin esto no funciona «Olvidé mi contraseña»).
4. Prueba con dos cuentas: cada una debe ver solo sus datos.

## 3. Librería de Supabase sin CDN (recomendado; aún pendiente)
La app carga `@supabase/supabase-js@2` desde jsDelivr con versión flotante y sin verificación de integridad. Desde mi entorno no tengo internet para descargarla y calcular el hash, así que queda pendiente:
descarga esa librería, guárdala como `vendor/supabase.js`, cambia el `src` del `<script>` en `index.html` a `./vendor/supabase.js`, agrega la ruta a `CORE` en `service-worker.js` y quita `https://cdn.jsdelivr.net` de la política CSP y de la política de privacidad.

## 4. Funcionalidad ya incluida
- Insights usa la fuente financiera existente y no requiere una migración de esquema.
- La importación Nu permite revisar movimientos extraídos en el dispositivo antes de guardarlos; no hace OCR.

## 5. Cambios visibles que debes saber
- Se quitó Google Fonts (enviaba la IP de cada visitante a Google). La app usa Inter si está instalada o la fuente del sistema.
- El tema por defecto ahora es claro; el botón «Tema» alterna con el oscuro y recuerda tu elección.
- Los iconos de instalación cambiaron al nuevo color. Si ya instalaste la app, quítala y vuelve a instalarla para ver el icono nuevo.
