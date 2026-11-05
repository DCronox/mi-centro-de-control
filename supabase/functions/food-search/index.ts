// Función «food-search»: busca alimentos en USDA FoodData Central sin exponer la clave al navegador.
//
//   POST {"query":"pechuga de pollo"}  cabecera Authorization: Bearer <sesión del usuario>
//   → {ok, results:[{source_id,name_en,kcal,protein_g,carbs_g,fat_g,fiber_g,portions,...}], cached, query_en}
//
// Flujo: traduce la consulta al inglés → mira la caché (30 días) → si no está, consulta USDA
// (búsqueda + detalle para las porciones), guarda en food_reference y devuelve los resultados.
// Límite: 40 búsquedas nuevas a USDA por persona y hora (las de la caché no cuentan).
//
// Secretos (Supabase › Edge Functions › Secrets; nunca en el navegador):
//   USDA_API_KEY (gratuita en https://fdc.nal.usda.gov/api-key-signup). Sin ella se usa DEMO_KEY,
//   que USDA limita a muy pocas peticiones por hora: solo sirve para probar.
//   SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
// Se despliega CON verificación de JWT (solo personas con sesión).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { usdaToRef, toEnglishQuery, normQuery } from '../_shared/usda.mjs';

const env = (k: string) => Deno.env.get(k) ?? '';
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const FDC = 'https://api.nal.usda.gov/fdc/v1';
const CACHE_DAYS = 30, HOURLY_LIMIT = 40, PAGE = 12;
const COLS = 'source_id,name_en,data_type,category,kcal,protein_g,carbs_g,fat_g,fiber_g,energy_source,complete,portions,published';

async function fdc(path: string, key: string) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${FDC}${path}${sep}api_key=${encodeURIComponent(key)}`, { headers: { Accept: 'application/json' } });
  if (res.status === 429) throw Object.assign(new Error('USDA limitó las búsquedas por ahora. Inténtalo más tarde.'), { status: 429 });
  if (!res.ok) throw Object.assign(new Error(`USDA respondió ${res.status}`), { status: 502 });
  return await res.json();
}

async function byIds(ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await admin.from('food_reference').select(COLS).eq('source', 'usda').in('source_id', ids);
  if (error) throw error;
  const m = new Map((data ?? []).map((r) => [r.source_id, r]));
  return ids.map((id) => m.get(id)).filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !u?.user) return json({ ok: false, error: 'Inicia sesión para buscar alimentos.' }, 401);

  let body: { query?: string } = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }
  const q = normQuery(body.query);
  if (q.length < 2) return json({ ok: false, error: 'Escribe al menos 2 letras.' }, 400);
  const qEn = toEnglishQuery(q).replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim() || q;

  try {
    const { data: cached } = await admin.from('food_search_cache').select('source_ids,fetched_at').eq('query_norm', q).maybeSingle();
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_DAYS * 864e5) {
      return json({ ok: true, cached: true, query_en: qEn, results: await byIds(cached.source_ids ?? []) });
    }

    const since = new Date(Date.now() - 3600e3).toISOString();
    const { count } = await admin.from('food_search_log').select('id', { count: 'exact', head: true }).eq('user_id', u.user.id).gte('at', since);
    if ((count ?? 0) >= HOURLY_LIMIT) return json({ ok: false, error: 'Has hecho muchas búsquedas nuevas en la última hora. Inténtalo más tarde.' }, 429);
    await admin.from('food_search_log').insert({ user_id: u.user.id });
    if (Math.random() < 0.05) await admin.from('food_search_log').delete().lt('at', new Date(Date.now() - 2 * 864e5).toISOString());

    const key = env('USDA_API_KEY') || 'DEMO_KEY';
    const search = await fdc(`/foods/search?query=${encodeURIComponent(qEn)}&dataType=${encodeURIComponent('Foundation,SR Legacy')}&pageSize=${PAGE}`, key);
    const ids: string[] = (search.foods ?? []).map((f: { fdcId: number }) => String(f.fdcId));
    let rows = (search.foods ?? []).map(usdaToRef);
    if (ids.length) {
      // El detalle trae las porciones caseras (1 unidad grande = 50 g, 1 taza = …).
      const detail = await fdc(`/foods?${ids.map((i) => 'fdcIds=' + i).join('&')}`, key).catch(() => null);
      if (Array.isArray(detail)) {
        const d = new Map(detail.map((f: { fdcId: number }) => [String(f.fdcId), usdaToRef(f)]));
        // El detalle es la misma fuente con más campos: se prefiere, conservando la categoría de la búsqueda.
        rows = rows.map((r: { source_id: string; category: string }) => { const x = d.get(r.source_id) as Record<string, unknown> | undefined; return x ? { ...x, category: (x.category as string) || r.category } : r; });
      }
      const { error } = await admin.from('food_reference').upsert(rows.map((r: Record<string, unknown>) => ({ ...r, fetched_at: new Date().toISOString() })), { onConflict: 'source,source_id' });
      if (error) throw error;
    }
    await admin.from('food_search_cache').upsert({ query_norm: q, query_en: qEn, source_ids: ids, fetched_at: new Date().toISOString() });
    return json({ ok: true, cached: false, demo_key: !env('USDA_API_KEY'), query_en: qEn, results: await byIds(ids) });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return json({ ok: false, error: (e as Error).message || 'No se pudo buscar' }, status);
  }
});
