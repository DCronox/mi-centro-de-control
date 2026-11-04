# Gym · Fase 2: almacenamiento (propuesta, no aplicada)

**Estado (2026-11-04): aplicado.** La migración `supabase/migrations/20261104120000_gym.sql` está en Supabase con RLS verificado. Nutrición sigue pendiente. Gym solo lee la sesión de Supabase y las tareas de
«Mi día» con categoría Gimnasio guardadas en el navegador.

## Cómo encaja con lo existente

- **Cliente y sesión:** `gym.html` crea su propio cliente con la configuración compartida
  `js/cloud-config.js` (URL y clave publicable). Cada página necesita un cliente, pero la sesión es la misma
  porque ambas viven en el mismo origen. No hay claves secretas en el navegador.
- **Datos actuales:** la app guarda todo en una sola fila JSON por persona (`public.mcc_data.data`). Funciona bien
  para finanzas y tareas, pero el historial de series crece rápido (decenas de filas por entrenamiento).

## Recomendación: tablas propias con RLS

Guardar el entrenamiento en tablas separadas evita que la fila JSON de `mcc_data` crezca sin límite, permite
consultar progreso (volumen, récords) en el servidor y no toca la sincronización existente.

| Tabla | Contenido | Claves |
|---|---|---|
| `gym_exercises` | Biblioteca: nombre, grupo muscular, equipo, notas (propios del usuario) | `id uuid`, `user_id` |
| `gym_routines` | Rutina: nombre, días de la semana, orden, archivada | `id`, `user_id` |
| `gym_routine_items` | Ejercicio dentro de la rutina: orden, series y reps objetivo, descanso | `id`, `routine_id`, `exercise_id` |
| `gym_sessions` | Entrenamiento realizado: inicio, fin, rutina, notas | `id`, `user_id`, `routine_id` |
| `gym_sets` | Serie: ejercicio, nº, peso, reps, RPE, descanso, hecha | `id`, `session_id`, `exercise_id` |
| `body_metrics` | Peso y medidas por fecha | `id`, `user_id`, `date` |
| `nutrition_goals` / `nutrition_logs` | Objetivos diarios y registros de comida | `id`, `user_id` |

Reglas comunes: `user_id uuid references auth.users on delete cascade`, RLS activado con políticas
`(select auth.uid()) = user_id` para select/insert/update/delete, índices por `user_id` y por fecha, `updated_at`
para sincronizar, sin permisos para `anon`.

## Trabajo sin conexión

En el gimnasio puede no haber señal. Propuesta: guardar el entrenamiento en curso en el navegador y subirlo al
terminar (o al recuperar conexión), con `id` generados en el cliente (`crypto.randomUUID()`) para no duplicar.

## Integración con el resto de la app

- Al terminar un entrenamiento, marcar como hecha la tarea de Gimnasio de ese día en «Mi día» (opcional).
- Recordatorios: «tienes entreno de pierna hoy» con el mismo sistema de notificaciones push.

## Antes de aplicarlo

Revisar y aprobar el SQL, aplicarlo como migración incremental en `supabase/migrations/` y probar con dos
cuentas que cada una solo ve lo suyo.
