-- Programa la función «notify» cada 5 minutos con pg_cron + pg_net.
-- Ejecutar en Supabase › SQL Editor DESPUÉS de aplicar la migración de notificaciones
-- y de desplegar la función con sus secretos.
--
-- 1) Sustituye PEGA_AQUI_CRON_SECRET por el valor de CRON_SECRET de supabase/.env
--    (el mismo que cargaste como secreto de la función). Queda guardado cifrado en Vault.
--    No guardes este archivo con el secreto pegado.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('PEGA_AQUI_CRON_SECRET', 'mcc_notify_cron_secret', 'Secreto para que pg_cron llame a la función notify');

-- 2) Programa la tarea (si ya existía con este nombre, se reemplaza).
select cron.unschedule('mcc-notify') where exists (select 1 from cron.job where jobname = 'mcc-notify');
select cron.schedule(
  'mcc-notify',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://xruxsuobpctyekkyracr.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mcc_notify_cron_secret')
    ),
    body := '{"action":"run"}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- Verificación:
-- select jobname, schedule, active from cron.job where jobname = 'mcc-notify';
-- select status_code, created from net._http_response order by created desc limit 5;
--
-- Pausar:   select cron.unschedule('mcc-notify');
