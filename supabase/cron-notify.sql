-- Programa la función «notify» cada 5 minutos con pg_cron + pg_net.
-- No contiene secretos: el secreto del cron se genera aquí mismo con valores aleatorios y queda
-- cifrado en Vault. La función lo lee con public.notify_cron_secret() (solo la clave de servicio).
-- La función mantiene la verificación de JWT, así que la llamada lleva la clave pública «anon»
-- (legacy) del proyecto: sustituye PEGA_AQUI_ANON_KEY por esa clave (Settings › API Keys › Legacy).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'mcc_notify_cron_secret', 'Secreto para que pg_cron llame a la función notify')
where not exists (select 1 from vault.secrets where name = 'mcc_notify_cron_secret');

create or replace function public.notify_cron_secret()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'mcc_notify_cron_secret' limit 1;
$$;
revoke all on function public.notify_cron_secret() from public, anon, authenticated;
grant execute on function public.notify_cron_secret() to service_role;

select cron.unschedule('mcc-notify') where exists (select 1 from cron.job where jobname = 'mcc-notify');
select cron.schedule(
  'mcc-notify',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://xruxsuobpctyekkyracr.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer PEGA_AQUI_ANON_KEY',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mcc_notify_cron_secret')
    ),
    body := '{"action":"run"}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- Verificación:
-- select jobname, schedule, active from cron.job where jobname = 'mcc-notify';
-- select status_code, content, created from net._http_response order by created desc limit 5;
-- Pausar:   select cron.unschedule('mcc-notify');
