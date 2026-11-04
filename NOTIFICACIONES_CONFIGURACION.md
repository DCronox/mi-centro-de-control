# Notificaciones push: configuración

Las notificaciones con la app cerrada necesitan tres piezas en Supabase. El código ya está en el
proyecto; **nada de esto se ha aplicado todavía** en tu proyecto de Supabase.

| Pieza | Archivo | Qué hace |
|---|---|---|
| Tablas | `supabase/migrations/20261103120000_notificaciones.sql` | `push_subscriptions` (dispositivos) y `notifications` (historial), con RLS. No toca `mcc_data`. |
| Función | `supabase/functions/notify/` | Calcula los recordatorios de cada persona (mismas reglas que la app, `_shared/reminders-core.mjs`) y los envía con Web Push. |
| Programación | `supabase/cron-notify.sql` | Llama a la función cada 5 minutos con `pg_cron` + `pg_net`. |
| Secretos | `supabase/.env` (no se sube a GitHub) | Claves VAPID y `CRON_SECRET`. La clave pública también está en `js/push-config.js`. |

## Orden de instalación

1. **Respaldo:** descarga una copia desde la app (Cuenta › Copia de seguridad).
2. **Tablas:** en Supabase › SQL Editor ejecuta la migración. Luego las consultas de verificación del final.
3. **Secretos de la función:** Supabase › Edge Functions › Secrets: agrega `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` y `CRON_SECRET` con los valores de `supabase/.env`.
   (Con la CLI: `supabase secrets set --env-file supabase/.env`.)
4. **Función:** despliega `notify` **sin verificación de JWT** (la llama `pg_cron`, que no tiene sesión;
   la función comprueba su propio secreto). Con la CLI:
   `supabase functions deploy notify --no-verify-jwt --project-ref xruxsuobpctyekkyracr`.
   Debe incluir la carpeta `_shared`.
5. **Programación:** en `supabase/cron-notify.sql` pega el `CRON_SECRET` donde dice `PEGA_AQUI_CRON_SECRET`,
   ejecútalo y **no guardes el archivo con el secreto**.
6. **Publica la app** (HTTPS; GitHub Pages sirve). Las notificaciones push no funcionan desde `file://`.
7. **En cada dispositivo:** abre la app › Notificaciones › «Activar notificaciones» › «Enviar notificación de prueba».
   - Android (Chrome): funciona desde el navegador o con la app instalada.
   - iPhone: solo con la app instalada en la pantalla de inicio (iOS 16.4 o posterior).

## Cómo comprobar que funciona

- La prueba debe llegar como notificación del sistema. Luego cierra la app por completo y espera un aviso
  real (por ejemplo, crea una tarea con hora dentro de 20 minutos y recordatorio «10 min antes»).
- En SQL: `select status_code, created from net._http_response order by created desc limit 5;` debe mostrar `200`.
- En la app, el historial muestra cada aviso y si se entregó.

## Qué se envía y cuándo (hora de Colombia)

- **Finanzas:** pago próximo (N días antes, a la hora del resumen), el día del vencimiento, vencido (día siguiente 9:00);
  presupuesto al 80 % y 100 %; gasto importante; recordatorio de ahorro el día elegido si vas por debajo de lo planeado.
- **Trabajo:** inicio de turno (minutos antes), turno terminado sin registrar (+30 min), turno abierto sin salida
  (fin programado +20 min o 9 h), resumen semanal de horas.
- **Metas:** días antes de la fecha objetivo, el día de la fecha, avances del 25/50/75/100 %.
- **Organización:** tareas y rutinas con recordatorio; resumen del día.

Cada aviso tiene una clave única: no se repite aunque la función corra cada 5 minutos. «No molestar» pausa los
avisos inmediatos (presupuesto, gastos, metas); los de turnos y tareas con recordatorio sí llegan.

## Límites conocidos

- Solo recibe push quien tiene la sesión iniciada: el servidor lee los datos sincronizados en la nube.
- El sistema operativo puede retrasar o bloquear avisos (ahorro de batería, modo no molestar, permisos del navegador).
- Si el navegador no admite push, la app muestra los mismos recordatorios mientras está abierta y los guarda en el historial.
