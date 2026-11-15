# Mi Centro de Control 0.3 — Auditoría técnica y arquitectura

Fecha: 2026-11-15 · Autor: arquitectura MCC · Alcance: repositorio, Supabase (solo lectura) y requisitos externos.
**En esta etapa no se modificó código ni base de datos.** Todas las consultas a Supabase fueron de lectura (una prueba de escritura entre usuarios fue bloqueada por el control de seguridad y no se ejecutó).

Leyenda de verificación: ✅ funcionando y verificada · 🟡 implementada, no verificada · 🟠 incompleta · ⚪ pendiente · 🔴 con errores.

---

## 1. Estado real del repositorio

| Elemento | Estado verificado |
|---|---|
| Rama actual | `evolucion-v2`, limpia, sincronizada con `origin`. |
| `main` | Igual a `evolucion-v2` (`b29d15d`, 0 commits de diferencia). Publicada en GitHub Pages (service worker `v27`). |
| `origin/mcc-v0.3-integrations` | Existe en el remoto y **es idéntica a `main`** (sin commits propios). Sirve como rama base de 0.3. |
| `evolucion/v2` (local) | Rama antigua (`656f4f0`, 3-nov). No publicada; no se usa. |
| Cambios sin confirmar | Ninguno. Ignorados: `supabase/.env` (secretos, correcto) y `work/synthetic-nu.pdf` (PDF sintético de pruebas). |
| Historial | 37 commits en `main`. |
| Herramientas | **No hay `package.json`, CI (`.github/`), carpeta `android/` ni configuración de Capacitor.** Sin paso de compilación. |
| Pruebas | 129 pruebas con `node --test tests/` → **129/129 en verde** (530 ms). |
| Número de versión | **No existe en ningún archivo** (ni en la interfaz, ni en el manifiesto, ni en el README). |

Tamaño del código: app principal ≈157 KB de JS, Gym ≈253 KB de JS, CSS ≈69 KB. Sin dependencias externas salvo `lib/supabase-2.118.0.js` (copia local fijada) y la fuente Manrope local.

## 2. Arquitectura actual

```
GitHub Pages (estático) ──► index.html + gym.html (PWA, scripts clásicos en ámbito global, sin bundler)
                             │  CSP estricta: script-src 'self'; connect-src solo Supabase
                             │  service-worker.js: caché de la app (red primero para js/css)
                             ▼
Supabase (us-east-1)
  Auth: solo correo y contraseña (3 usuarios, 3 confirmados)
  PostgreSQL: mcc_data (1 documento JSONB por usuario) + 17 tablas normalizadas (Gym, notificaciones, alimentos)
  Edge Functions: notify (push web, sin verify_jwt, protegida por secreto de cron) · food-search (USDA, con verify_jwt)
  pg_cron: «mcc-notify» cada 5 min → notify  ·  Vault: mcc_notify_cron_secret
  Storage: sin buckets
```

**Modelo de datos de la app principal** (`js/sync-model.js`, `js/store.js`): un único documento por usuario en `public.mcc_data.data` con
`tx, goals, routines, inst, budgets, obligations, scheduledShifts, rate, shifts, deleted, activeShift, notifPrefs` (comprobado en la base de datos).
Cada elemento lleva marca `u`; los borrados usan *tombstones* (`deleted`). La sincronización:
- guarda con **control optimista** (`update … where updated_at = <la última conocida>`), reintenta 3 veces fusionando si otro dispositivo escribió (`cloudPush`/`cloudMergeRemote`);
- consulta cambios **cada 10 s** si la pestaña está visible (`js/cloud-auth.js:50`);
- conserva campos desconocidos al fusionar (`Object.assign(defaultData(), remote, local)`), lo que permite añadir campos opcionales sin romper clientes antiguos.

**Gym** usa tablas normalizadas por usuario con RLS (ver §5) y su propio almacén (`js/gym/gym-store.js`).

Acoplamientos relevantes:
- Todos los scripts comparten el ámbito global (hay una prueba que impide nombres duplicados, `tests/gym-globals.test.mjs`, solo para Gym).
- `reminders-core.mjs` existe **duplicado** en `js/` y `supabase/functions/_shared/` (una prueba verifica que sean idénticos).
- `notify` lee `mcc_data` completo de cada usuario en cada ejecución de cron.

## 3. Inventario de módulos y funcionalidades

### App principal (`index.html`, pestañas de `js/shell.js`)

| Módulo | Funcionalidad | Estado | Evidencia |
|---|---|---|---|
| Cuenta | Registro e inicio de sesión (correo) | ✅ | Usado con la cuenta real en esta etapa |
| | Recuperar contraseña | 🟡 | `resetPasswordForEmail` con `redirectTo` = URL web; depende de *Site URL* en Supabase (pendiente de verificar según `FASE1_PENDIENTES.md`) |
| | Eliminar cuenta (`delete_my_account`) | 🟡 | Función instalada (2026-11-03) y UI con confirmación escrita; **nunca probada de extremo a extremo** |
| | Copia JSON (exportar/importar) | 🟡 | `exportBackup`/`importData` en `js/store.js`; sin prueba automática |
| Sincronización | Guardado automático, fusión, borrados, multi-dispositivo | ✅ | `autosave.test.mjs`, `sync-rate.test.mjs`, uso real |
| | Tarifa al iniciar sesión en dispositivo nuevo | ✅ | Corregido (`rateU`) y con 6 pruebas |
| Inicio | Resumen del día, pagos vencidos y próximos, turnos próximos | 🟡 | Código en `js/views/dashboard.js`; sin prueba de interfaz |
| Dinero | Movimientos, filtros y búsqueda | 🟡 | `js/views/money.js`, `FASE5_PULIDO.md` |
| | Presupuestos y obligaciones recurrentes (genera gasto pendiente mensual) | ✅ | `financial-integration.test.mjs` |
| | Categorías | 🟡 | Lista fija de 11 en `js/util.js`; **sin clasificación automática** |
| | Importación de extractos Nu | ⚪ | **Existió y fue retirada** (commit `a580b47`, 2026-10-30; 435 líneas recuperables del historial). El modelo aún muestra y exporta `nuProduct`, `importedFrom`, `bankReference` (campos huérfanos: nada los crea hoy) |
| Mi día | Tareas, rutinas recurrentes, instancias diarias | 🟡 | `js/views/day.js`; fusión de instancias probada en `autosave.test.mjs` |
| Metas | Metas de ahorro, aportes, retiros | 🟡 | `js/views/goals.js`; fusión de aportes probada |
| Turnos | Fichar entrada/salida, turnos programados, tarifa por hora | 🟡 | `js/views/shifts.js` |
| Informes | Informe mensual, comparativos, CSV, imprimir a PDF | 🟡 | `js/views/reports.js`; exportación no probada |
| Insights | Tendencias, distribución, flujo neto, recomendaciones | ✅ | `insights.test.mjs` |
| Notificaciones | Push web (VAPID) con cron cada 5 min, preferencias, horario de no molestar, prueba de envío | ✅ | Verificado en Android Chrome (2026-11-03); `reminders.test.mjs` |
| Preferencias | Tema claro/oscuro, sonidos, animaciones | 🟡 | Visual; sin prueba |
| Legales | Privacidad, términos, cookies | 🟠 | Vigentes desde 28-oct-2026: **no cubren Gym (salud, embarazo, sueño, peso), push ni USDA** |

### Gym (`gym.html`, fases A–I)

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Rutinas, entrenamiento, series con RPE, mapa muscular, progreso, físico | ✅ | Datos reales en Supabase (54 series) |
| Catálogo de ejercicios enlazado | ✅ | Migración aplicada; ejercicio real enlazado a `press_banca` |
| Evaluación inicial y objetivos | ✅ | Verificado con cuenta real |
| Panel nutricional, agua, comidas, texto en español | ✅ | Guardado y borrado verificados con cuenta real |
| Mis alimentos | 🟡 | Solo verificado con datos simulados |
| USDA FoodData Central (servidor, caché, límites) | ✅ | Búsqueda real con la clave del usuario (`demo_key:false`) |
| Progresión, recuperación, recomendaciones, historial y proyecciones | 🟡 | 50+ pruebas y navegador con datos simulados; con datos reales aún no hay base suficiente |
| Borrador de comida al cambiar de día | 🔴 (menor) | Al cambiar de día con algo escrito, el borrador se descarta sin aviso |

## 4. Estado de Supabase (verificado en solo lectura)

- Proyecto `xruxsuobpctyekkyracr`, PostgreSQL 17, región us-east-1.
- Extensiones: `pg_cron 1.6.4`, `pg_net 0.20.4`, `pgcrypto`, `uuid-ossp`, `supabase_vault`, `pg_stat_statements`.
- Auth: **solo proveedor `email`**; 3 usuarios confirmados. Configuración de Auth (longitud mínima, *Site URL*, protección de contraseñas filtradas) **no es legible por SQL**: el asesor indica que la protección de contraseñas filtradas está **desactivada**; el resto queda **sin verificar**.
- Edge Functions: `notify` v6 (`verify_jwt=false`, valida secreto de Vault o JWT según la acción) y `food-search` v3 (`verify_jwt=true`).
- Cron: `mcc-notify` (`*/5 * * * *`, activo). Vault: un secreto. Storage: **sin buckets**.
- Plan de Supabase y política de copias de seguridad: **no verificables desde aquí** (dato necesario antes del lanzamiento comercial; ver §13).
- Migraciones: las 9 del repositorio están aplicadas. **`FASE1_MIGRACION_RLS.sql` y `FASE1B` viven fuera de `supabase/migrations`; la primera NO está aplicada** (las políticas de `mcc_data` conservan los nombres y la forma originales).

## 5. Esquema de base de datos conocido

| Tabla | Propósito | Filas aprox. | RLS | Notas |
|---|---|---|---|---|
| `mcc_data` | Documento JSONB por usuario (PK `user_id`, FK `auth.users` ON DELETE CASCADE) | 3 | Sí (4 políticas) | **anon conserva SELECT/INSERT/DELETE** (bloqueado por RLS) |
| `push_subscriptions` | Suscripciones Web Push | — | Sí (4) | Sin campo de plataforma (web solamente) |
| `notifications` | Historial de avisos enviados | 24 | Sí (2) | Limpieza por `prune_old_notifications` |
| `gym_exercises`, `gym_routines`, `gym_sessions`, `gym_sets`, `body_metrics` | Gym base | 1 / — / — / 54 / — | Sí | `gym_sets` exige sesión y ejercicio del mismo usuario |
| `gym_profiles`, `nutrition_targets`, `gym_audit` | Evaluación, objetivos, auditoría | — | Sí | Auditoría solo por triggers, sin valores |
| `food_logs`, `water_logs`, `food_custom` | Nutrición | — | Sí | Sin TRUNCATE |
| `food_reference` | USDA compartida (solo lectura) | 101 | Sí (lectura) | Escribe solo la Edge Function |
| `food_search_cache`, `food_search_log` | Caché y límite USDA | — | Sí, sin políticas | Solo rol de servicio (intencional) |
| `recovery_logs` | Recuperación diaria | — | Sí | Sin TRUNCATE |

Funciones `public`: `delete_my_account` (SECURITY DEFINER, ejecutable por usuarios con sesión), `gym_audit_write`, `gym_touch_updated_at`, `notify_cron_secret`, `prune_old_notifications` (no ejecutables por clientes), y `rls_auto_enable` (disparador de eventos de la plataforma que activa RLS en tablas nuevas; **ejecutable por anon**, aviso del asesor).

## 6. Políticas RLS

- **Gym, nutrición, recuperación, notificaciones:** `(select auth.uid()) = user_id` en lectura y escritura. Comprobado el 2026-11-04 con dos identidades en una transacción revertida: un segundo usuario ve **0 filas** de 8 tablas personales.
- **`mcc_data`:** cuatro políticas con `auth.uid() = user_id` (sin `select`), que el asesor de rendimiento marca como reevaluadas por fila; impacto bajo (una fila por usuario). Permisos de tabla aún concedidos a `anon`.
- **Escritura entre usuarios:** protegida por las cláusulas `with check`; la prueba en vivo no se ejecutó (bloqueada) y debe hacerse en un entorno de *staging*.

## 7. Integraciones

| Integración | Estado | Detalle |
|---|---|---|
| Supabase Auth/DB/Edge/Cron/Vault | ✅ | En uso |
| Web Push (VAPID) | ✅ | Funciona en navegador; **no funciona dentro de una app Capacitor** (el WebView de Android no admite Web Push) |
| USDA FoodData Central | ✅ | Edge Function con clave en secreto, caché 30 días, 40 búsquedas/h por usuario |
| Importación PDF/CSV de Nu | ⚪ | Retirada; código en el historial (lector PDF del lado del cliente) |
| Google Calendar | ⚪ | No existe código |
| Gmail | ⚪ | No existe código |
| Firebase Cloud Messaging | ⚪ | No existe código ni proyecto Firebase |
| Supabase Storage | ⚪ | Sin buckets |

## 8. Errores y problemas encontrados

1. 🔴 `FASE1_MIGRACION_RLS.sql` nunca se aplicó: `mcc_data` mantiene permisos de `anon` y políticas sin `(select auth.uid())`.
2. 🔴 Política de privacidad desactualizada: no declara datos de salud de Gym (sensibles según la Ley 1581 de Colombia), push ni USDA. Bloquea la publicación en Play y la verificación OAuth de Google.
3. 🟠 Protección de contraseñas filtradas desactivada; longitud mínima y *Site URL* sin verificar.
4. 🟠 Campos de importación Nu huérfanos (`nuProduct`, `importedFrom`, `bankReference`): se muestran y exportan, pero nada los crea.
5. 🟠 Eliminación de cuenta sin prueba de extremo a extremo.
6. 🔴 (menor) Borrador de comida descartado al cambiar de día.
7. 🟠 Sin número de versión, sin CI: no hay forma de saber qué versión tiene un usuario ni de bloquear un cambio con pruebas fallidas.

## 9. Deuda técnica

- Scripts en ámbito global y código en líneas muy largas: difícil de revisar y de modularizar; sin *linter*.
- `mcc_data` como documento único: perfecto para un usuario y pocos dispositivos, pero **no permite que el servidor escriba de forma segura** (cualquier escritura del servidor compite con el cliente). Impacta directamente a importaciones, Gmail y automatizaciones (ver §14).
- Sondeo cada 10 s por cliente activo: coste lineal con usuarios.
- `notify` recorre todos los usuarios cada 5 minutos: coste lineal; sin lotes.
- Copia duplicada de `reminders-core.mjs`.
- Pruebas de interfaz de la app principal casi inexistentes (las de Gym usan un cliente simulado manual).

## 10. Riesgos de seguridad

| # | Riesgo | Severidad | Mitigación propuesta |
|---|---|---|---|
| S1 | Permisos de `anon` en `mcc_data` | Media (RLS lo bloquea hoy) | Migración versionada basada en `FASE1_MIGRACION_RLS.sql` |
| S2 | Contraseñas filtradas permitidas | Media | Activar en Auth |
| S3 | Datos de salud sin consentimiento explícito documentado | Alta (legal) | Consentimiento explícito en la evaluación + política actualizada + revisión jurídica |
| S4 | Tokens de sesión en `localStorage` del WebView | Baja-media | En Android, almacenamiento seguro para el token de refresco |
| S5 | `rls_auto_enable` ejecutable por anon | Baja (función de plataforma) | Revocar `execute` a anon/authenticated |
| S6 | Tokens OAuth de Google (futuro) | Alta | Solo en servidor, cifrados, tabla sin acceso de clientes, revocables |
| S7 | Ámbito restringido de Gmail | Alta (cumplimiento) | Ver §11 y §G |

No se encontraron claves secretas en el código ni en el historial de los últimos cambios (revisión del 2026-11-04 antes de publicar). `supabase/.env` está ignorado.

## 11. Compatibilidad con Android y Capacitor

Requisitos externos verificados:
- **Google Play exige `targetSdk` 36 (Android 16) para apps nuevas desde el 31-ago-2026** ([Google Play](https://support.google.com/googleplay/android-developer/answer/11926878), [Android Developers](https://developer.android.com/google/play/requirements/target-sdk)).
- **Capacitor 8** usa `compileSdk`/`targetSdk` 36 y `minSdk` 24; exige Android Studio Otter 2025.2.1+, JDK 21 y Node 22+, y activa *edge-to-edge* ([guía de actualización a Capacitor 8](https://capacitorjs.com/docs/updating/8-0), [Capawesome](https://capawesome.io/blog/how-to-upgrade-your-capacitor-app-to-capacitor-8/)). Capacitor 7 apunta a SDK 35 y **no cumple**.
- Notificaciones en Android: `@capacitor/push-notifications` con FCM; permiso en tiempo de ejecución desde Android 13 ([Capacitor](https://capacitorjs.com/docs/v7/apis/push-notifications)).
- Cuentas personales de desarrollador nuevas: **prueba cerrada con 12 testers durante 14 días seguidos** antes de producción ([Google Play](https://support.google.com/googleplay/android-developer/answer/14151465)).
- Cuentas con registro: enlace web para solicitar el borrado de cuenta y datos; apps con datos de salud: declaración de *Health apps* ([Google Play](https://support.google.com/googleplay/android-developer/answer/13327111)).

Compatibilidad del código actual (comprobada por búsqueda en el código):

| Aspecto | Hoy | En Capacitor |
|---|---|---|
| Rutas | Relativas (`./`) | ✅ Compatible |
| CSP | `connect-src` solo Supabase | ✅ Compatible; ampliar para FCM no es necesario (nativo) |
| Áreas seguras | `safe-area-inset` ya usado en CSS | ✅ Base para *edge-to-edge* (revisar en dispositivo) |
| Descargas (copia JSON, CSV) | `Blob` + `<a download>` (`js/store.js`, `js/views/reports.js`) | ❌ No descarga en WebView → plugin Filesystem/Share |
| Imprimir a PDF | `window.print()` (`js/events.js`) | ❌ No disponible → generar PDF o compartir |
| Push | Web Push + service worker (`js/notifications.js`) | ❌ → FCM nativo; `notify` debe enviar también a FCM |
| Avisos locales | `showNotification` del service worker | ❌ → plugin Local Notifications |
| Recuperar contraseña | `redirectTo` = URL web | ⚠️ Requiere App Links o abrir en navegador; `assetlinks.json` debe estar en la **raíz del dominio** (`dcronox.github.io/.well-known/`), no en la subcarpeta |
| Service worker | Caché offline | ⚠️ Innecesario en la app nativa (los archivos van empaquetados); desactivarlo allí |
| `alert`/`confirm` | Solo como respaldo en `js/ui.js` | ✅ |

Conclusión: **Capacitor es viable sin reescribir la app**; no hay ninguna necesidad técnica que justifique Kotlin, React Native ni Flutter. Hace falta una capa de plataforma pequeña para 5 puntos (descargas, impresión, push, avisos locales, enlaces de autenticación).

## 12. Preparación para múltiples usuarios comerciales

| Aspecto | Estado |
|---|---|
| Aislamiento por usuario (RLS) | ✅ en tablas normalizadas; 🟠 `mcc_data` (permisos de anon) |
| Registro y verificación de correo | ✅ |
| Borrado de cuenta | 🟡 sin prueba completa; falta **página web pública** para solicitarlo (exigida por Play) |
| Límites de uso | Solo USDA (40/h). Sin límites generales |
| Planes, pagos, organizaciones | ⚪ No existen (fuera de alcance de 0.3 salvo que se decida) |
| Escalabilidad | Adecuada para cientos de usuarios; sondeo de 10 s y cron global de `notify` son los primeros cuellos de botella |
| Observabilidad | Sin monitoreo ni alertas propias |
| Copias de seguridad | **Sin verificar** (depende del plan de Supabase) |

## 13. Estrategia de protección de los datos actuales

1. **Copia antes de cualquier cambio:** exportación lógica de `mcc_data` y de todas las tablas de Gym/nutrición (CLI `supabase db dump` o exportación SQL) a un archivo fuera del repositorio, más una prueba de **restauración en un proyecto de staging**. Ninguna migración de producción sin ambas.
2. **Proyecto de staging** de Supabase para todo el desarrollo de 0.3 (Android, integraciones, automatizaciones). Producción solo recibe migraciones ya probadas allí.
3. **Solo migraciones aditivas y versionadas** en `supabase/migrations/` (incluida la de RLS de `mcc_data`), cada una con bloque de reversión.
4. **No cambiar el formato de `mcc_data`.** Los campos nuevos serán opcionales; el validador (`validData`) y la fusión ya conservan campos desconocidos, así que los clientes antiguos no pierden datos. Se añadirá `schemaVersion` solo cuando exista una migración que lo necesite.
5. **El servidor no escribe en `mcc_data`.** Importaciones, Gmail y automatizaciones dejan *propuestas* en tablas propias; el cliente las aplica al documento tras la confirmación del usuario (ver §14). Así se evita competir con la sincronización y se respeta la confirmación de operaciones sensibles.
6. Respaldo local existente (copia JSON) se mantiene y se adapta a Android (plugin de archivos).

## 14. Arquitectura recomendada para MCC 0.3

```
                ┌──────────────── Cliente (web y Android con Capacitor 8) ─────────────────┐
                │ HTML/CSS/JS actual + js/platform.js (capa de plataforma: archivos,       │
                │ impresión, push FCM/Web Push, avisos locales, enlaces)                   │
                │ mcc_data (documento) ◄── aplica propuestas confirmadas ── Bandeja        │
                └──────────────┬───────────────────────────────────────────▲──────────────┘
                               │ eventos del cliente (con clave idempotente) │ propuestas
                               ▼                                             │
Supabase ── mcc_events (registro central, append-only, dedupe_key único) ───┤
          ── mcc_automation_rules (evento → condición → acción; pausa; límites)
          ── mcc_automation_runs (ejecución, reintentos, idempotencia, resultado, error)
          ── mcc_inbox (propuestas: movimientos importados, eventos de calendario, recibos)
          ── mcc_imports + mcc_import_items (archivo, filas, hash de duplicado, estado)
          ── mcc_integrations (proveedor, estado, permisos, revocación) [visible al usuario]
          ── mcc_integration_tokens (tokens cifrados) [solo rol de servicio]
          ── mcc_sync_state (cursor/syncToken por integración)
          ── mcc_settings (pausa global de automatizaciones, límites) [1 fila por usuario]
Edge Functions: notify (+FCM), automation-runner (cron), google-oauth, calendar-sync,
                food-search (existente)
```

Decisiones y su justificación:
- **Mantener HTML/CSS/JS sin bundler**; añadir `package.json` solo para la herramienta de Capacitor y un script que copie la app a la carpeta web de Capacitor (excluye `tests/`, `supabase/`, documentación). Justificación: la app no depende de npm y funciona; un *framework* no aporta nada que Capacitor no resuelva.
- **Capa de plataforma (`js/platform.js`)**: las cinco incompatibilidades de §11 se resuelven en un único archivo; el resto del código no sabe si está en web o en Android.
- **Bandeja de propuestas** en lugar de escrituras del servidor en `mcc_data`: compatible con el modelo actual, idempotente, y cumple «confirmación para operaciones sensibles».
- **Eventos con `dedupe_key` único** (`origen|tipo|id|versión`) y **ejecuciones con clave única (`rule_id`, `event_id`)**: impiden ejecuciones duplicadas aunque haya reintentos.
- **Tokens OAuth** solo en tabla sin acceso de clientes, cifrados con una clave en secretos de Edge; revocación = borrar token + revocar en Google + marcar integración.
- **No crear las 6 tablas a la vez**: se crean cuando una fase las necesita (ver roadmap).

## 15. Roadmap ordenado por dependencias

| Fase | Objetivo | Depende de | Entrega verificable |
|---|---|---|---|
| **0. Base segura** | Copia y restauración probadas, staging, RLS de `mcc_data`, ajustes de Auth, política de privacidad, versión, CI, arreglo del borrador | — | Restauración probada; asesores sin avisos de MCC; CI en verde |
| **1. App Android** | Capacitor 8, capa de plataforma, FCM, enlaces, iconos; prueba interna | 0 | APK/AAB en prueba interna funcionando en dispositivo real |
| **2. Motor de automatización** | `mcc_events`, reglas, ejecuciones, bandeja, pausa global, historial | 0 | Regla de ejemplo idempotente, pausable y auditada |
| **3. Finanzas: importación** | PDF/CSV de Nu (cliente), duplicados, revisión, conciliación, clasificación | 2 (bandeja) | Importar un extracto real sin duplicar al repetir |
| **4. Google Calendar** | OAuth, lectura, creación, sincronización incremental, sin duplicados | 1, 2 | Turnos ↔ calendario sin duplicados tras 2 sincronizaciones |
| **5. Gmail** | Recibos y comprobantes | 2, 3 y **decisión sobre CASA** | Ver §G |
| **6. Publicación en Play** | Ficha, seguridad de datos, salud, borrado de cuenta, 12 testers × 14 días, producción | 0, 1 | App aprobada en producción |

USDA y Gym ya están integrados; en 0.3 solo se adaptan a Android (fase 1).

---

## A. Diagnóstico general

La base es **sólida y funcional**: aislamiento por usuario en todas las tablas normalizadas, sincronización con control de conflictos, push real funcionando, Gym completo y 129 pruebas en verde. Los problemas no están en lo construido sino en lo que falta para ser **producto**: seguridad pendiente en `mcc_data`, política de privacidad que no cubre datos de salud, sin entorno de staging ni copia de restauración probada, sin versión ni CI, y cinco incompatibilidades concretas con Android. La importación bancaria existió y fue retirada; el modelo de datos aún la espera.

## B. Arquitectura recomendada

La de §14: conservar la app actual, añadir Capacitor 8 con una capa de plataforma, mantener `mcc_data` intacto y construir automatizaciones, importaciones e integraciones sobre tablas nuevas con una **bandeja de propuestas** como único camino del servidor hacia los datos del usuario.

## C. Plan de migración sin pérdida de datos

1. Exportar `mcc_data` y tablas de Gym; guardar fuera del repositorio con fecha.
2. Crear proyecto de staging; restaurar ahí la copia y comprobar recuentos y una sesión real.
3. Pasar `FASE1_MIGRACION_RLS.sql` a `supabase/migrations/` (sin cambiar su lógica), probar en staging con dos usuarios (lectura **y escritura**), aplicar en producción con la copia del día.
4. Tablas nuevas solo aditivas, una fase a la vez, siempre en staging primero.
5. Ningún cambio de formato en `mcc_data`; campos nuevos opcionales y probados con datos antiguos (prueba automática con una copia real anonimizada).
6. Recuperación: cada migración con bloque de reversión; para datos, restaurar desde la copia del paso 1.

## D. Primer conjunto de tareas (fase 0)

1. Procedimiento de copia y restauración documentado y ejecutado (staging).
2. Migración versionada de RLS para `mcc_data` (basada en `FASE1_MIGRACION_RLS.sql`) + revocar `execute` de `rls_auto_enable`.
3. Ajustes de Auth: contraseñas filtradas, longitud mínima 8, *Site URL* y URLs de redirección.
4. Política de privacidad y términos: Gym/salud (dato sensible, consentimiento explícito), push, USDA, conservación y borrado; página pública de **solicitud de borrado de cuenta**.
5. Consentimiento explícito para datos de salud en la evaluación de Gym.
6. Número de versión visible (`0.3.0-dev`) y en el manifiesto.
7. CI en GitHub Actions que ejecute `node --test tests/` en cada push y PR.
8. Arreglar el borrador de comida al cambiar de día.
9. Decidir dominio propio (recomendado, ver H).

## E. Archivos que se modificarán en la fase 0

| Archivo | Cambio |
|---|---|
| `supabase/migrations/2026111X_mcc_data_rls.sql` (nuevo) | RLS y permisos de `mcc_data` |
| `privacidad.html`, `terminos.html`, `cookies.html` | Actualización de contenido |
| `borrar-cuenta.html` (nuevo) | Página pública de solicitud de borrado |
| `js/gym/gym-perfil.js` | Consentimiento explícito de datos de salud |
| `js/gym/gym-nutri-ui.js` | Borrador al cambiar de día |
| `js/util.js` o `js/version.js` (nuevo), `index.html`, `gym.html`, `manifest.webmanifest`, `service-worker.js` | Versión |
| `.github/workflows/tests.yml` (nuevo) | CI |
| `BACKUP_Y_RECUPERACION.md` (nuevo) | Procedimiento |
| Configuración de Auth en el panel de Supabase | Sin archivo |

## F. Pruebas necesarias antes de aceptar cambios

- Las 129 actuales en verde + CI.
- RLS con dos usuarios en staging: lectura **y escritura** cruzadas rechazadas.
- Restauración de la copia en staging con recuentos idénticos.
- Compatibilidad: datos reales anonimizados de `mcc_data` abiertos por la versión nueva y por la anterior sin pérdida.
- Eliminación de cuenta de extremo a extremo con una cuenta de prueba.
- Recuperación de contraseña con la *Site URL* configurada.
- En fase 1: dispositivo físico Android (al menos Android 13 y 16), modo sin conexión, push FCM, descarga de copia, borde a borde.

## G. Riesgos y bloqueos

| Riesgo / bloqueo | Impacto | Respuesta |
|---|---|---|
| **Gmail `gmail.readonly` es un ámbito restringido**: si los datos pasan por un servidor exige **evaluación de seguridad CASA** además de la verificación ([Google](https://developers.google.com/workspace/gmail/api/auth/scopes), [ámbitos restringidos](https://support.google.com/cloud/answer/13464325)) | Coste y tiempo altos para un desarrollador individual | Empezar por alternativas sin ámbito restringido: «Compartir con MCC» desde Android y reenvío de recibos; reservar Gmail API para cuando el producto lo justifique |
| Google Calendar `calendar.events` es **sensible**: verificación con justificación y vídeo ([Google](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)) | Semanas de revisión | Preparar desde el inicio; requiere política de privacidad y dominio verificados |
| Formato real de los extractos de Nu **no confirmado** públicamente | Sin muestra real no se puede validar el lector | Necesito 1–2 extractos reales (anonimizados por ti) en PDF y, si existe, CSV |
| Cuenta personal de Play: **12 testers × 14 días** | ≥2 semanas antes de producción | Reclutar testers durante la fase 1 |
| `assetlinks.json` en la raíz de `dcronox.github.io` y verificación de dominio para OAuth | Enlaces de autenticación y OAuth | Dominio propio |
| Plan de Supabase y copias **sin verificar** | Riesgo de pérdida en lanzamiento comercial | Confirmar plan; restauración probada |
| Datos de salud (Ley 1581: dato sensible) | Legal y Play (*Health apps*) | Consentimiento explícito + revisión jurídica profesional |
| Firebase requiere un proyecto de Google y su archivo de configuración | Bloquea push en Android | Crear el proyecto (lo haces tú; las claves nunca van al repositorio) |

## H. Recomendación como arquitecto principal

1. **No empezar por las integraciones**, aunque sean la prioridad de negocio: todas dependen de la fase 0 (privacidad, dominio, staging, RLS) y de la fase 1 (enlaces y push en Android). Empezar por ahí no es retrasarlas, es desbloquearlas.
2. **Primera integración: importación de finanzas.** No necesita aprobación de terceros, es la de mayor valor diario, el modelo de datos ya la espera y existe código previo recuperable como punto de partida (se revisará, no se reutilizará a ciegas).
3. **Google Calendar después**, con la verificación de Google iniciada en paralelo durante la fase 1.
4. **Gmail al final y por la vía sin ámbito restringido**, salvo que decidas asumir CASA.
5. **Comprar un dominio propio** antes de la fase 1 (resuelve App Links, verificación OAuth y URLs legales estables).
6. **Capacitor 8 sobre la app actual**; no hay razón técnica para reescribir.
7. **Mantener `mcc_data` intacto** y canalizar todo lo automático por la bandeja de propuestas.

**Espero tu aprobación del diagnóstico y de la fase 0 antes de modificar cualquier archivo.**
