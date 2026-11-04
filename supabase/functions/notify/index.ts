// Función «notify»: calcula los recordatorios de cada persona y los envía como notificaciones push.
//
//   POST {"action":"run"}   cabecera x-cron-secret: CRON_SECRET  → la llama pg_cron cada 5 minutos.
//   POST {"action":"test"}  cabecera Authorization: Bearer <sesión del usuario> → aviso de prueba
//                           a los dispositivos de esa persona.
//
// Secretos (Supabase › Edge Functions › Secrets; nunca en el navegador):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), CRON_SECRET.
//   SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
// Se despliega sin verificación de JWT (verify_jwt = false) porque pg_cron no tiene sesión;
// cada acción comprueba su propia credencial.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';
import { computeReminders } from '../_shared/reminders-core.mjs';

const env = (k: string) => Deno.env.get(k) ?? '';
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
webpush.setVapidDetails(env('VAPID_SUBJECT') || 'mailto:admin@example.com', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; fail_count: number };
type Note = { id: number; dedupe_key: string; category: string; title: string; body: string; tab: string };

/* Comparación en tiempo constante para el secreto del cron. */
function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* Envía un aviso a todos los dispositivos activos de la persona y anota el resultado. */
async function deliver(note: Note, subs: Sub[]) {
  let delivered = 0;
  const payload = JSON.stringify({ id: note.id, title: note.title, body: note.body, tab: note.tab, tag: note.dedupe_key, category: note.category });
  const urgency = note.category === 'trabajo' || note.category === 'organizacion' ? 'high' : 'normal';
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency, topic: String(note.id) });
      delivered++;
      await admin.from('push_subscriptions').update({ last_seen: new Date().toISOString(), fail_count: 0, last_error: null }).eq('id', s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode ?? 0;
      if (code === 404 || code === 410) {
        // La suscripción ya no existe (el navegador la revocó o se desinstaló la app).
        await admin.from('push_subscriptions').delete().eq('id', s.id);
      } else {
        await admin.from('push_subscriptions').update({ fail_count: (s.fail_count || 0) + 1, last_error: String((e as Error).message || e).slice(0, 300) }).eq('id', s.id);
      }
    }
  }
  await admin.from('notifications').update({
    sent_at: new Date().toISOString(), delivered,
    status: subs.length === 0 ? 'sin_dispositivos' : delivered > 0 ? 'enviada' : 'fallida',
  }).eq('id', note.id);
  return delivered;
}

/* Registra los recordatorios nuevos (los repetidos se ignoran por la clave única) y los envía. */
async function processUser(userId: string, subs: Sub[], now: number) {
  const { data: row, error } = await admin.from('mcc_data').select('data').eq('user_id', userId).maybeSingle();
  if (error || !row?.data) return { created: 0, delivered: 0 };
  const reminders = computeReminders(row.data, row.data.notifPrefs, now, { windowMs: 3 * 3600 * 1000 });
  if (!reminders.length) return { created: 0, delivered: 0 };
  const rows = reminders.map((r) => ({ user_id: userId, dedupe_key: r.key.slice(0, 200), category: r.category, title: r.title.slice(0, 200), body: r.body.slice(0, 500), tab: r.tab, fire_at: new Date(r.fireAt).toISOString() }));
  const { data: inserted, error: insErr } = await admin.from('notifications')
    .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
    .select('id,dedupe_key,category,title,body,tab');
  if (insErr || !inserted) return { created: 0, delivered: 0, error: insErr?.message };
  let delivered = 0;
  for (const n of inserted as Note[]) delivered += await deliver(n, subs);
  return { created: inserted.length, delivered };
}

async function runAll() {
  const now = Date.now();
  const { data: subs, error } = await admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth,fail_count').eq('enabled', true);
  if (error) return json({ ok: false, error: error.message }, 500);
  const byUser = new Map<string, Sub[]>();
  for (const s of (subs ?? []) as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  let created = 0, delivered = 0;
  for (const [userId, list] of byUser) {
    try { const r = await processUser(userId, list, now); created += r.created; delivered += r.delivered; }
    catch (e) { console.error('notify user error', userId, (e as Error).message); }
  }
  if (Math.random() < 0.02) await admin.rpc('prune_old_notifications');
  return json({ ok: true, users: byUser.size, created, delivered });
}

async function sendTest(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u, error } = await admin.auth.getUser(token);
  if (error || !u?.user) return json({ ok: false, error: 'Sesión no válida' }, 401);
  const { data: subs } = await admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth,fail_count').eq('user_id', u.user.id).eq('enabled', true);
  const { data: note, error: e2 } = await admin.from('notifications').insert({
    user_id: u.user.id, dedupe_key: 'test:' + Date.now(), category: 'sistema',
    title: 'Notificaciones activadas', body: 'Así te llegarán los recordatorios de Mi Centro de Control.', tab: 'notif',
  }).select('id,dedupe_key,category,title,body,tab').single();
  if (e2 || !note) return json({ ok: false, error: e2?.message ?? 'No se pudo registrar' }, 500);
  const delivered = await deliver(note as Note, (subs ?? []) as Sub[]);
  return json({ ok: true, devices: subs?.length ?? 0, delivered });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);
  let body: { action?: string } = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }
  if (body.action === 'run') {
    if (!safeEqual(req.headers.get('x-cron-secret') ?? '', env('CRON_SECRET'))) return json({ ok: false, error: 'No autorizado' }, 401);
    return await runAll();
  }
  if (body.action === 'test') return await sendTest(req);
  return json({ ok: false, error: 'Acción desconocida' }, 400);
});
