import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Carga gym-calc.js y gym-muscles.js como en el navegador (scripts clásicos que comparten ámbito).
const ctx = {}; vm.createContext(ctx);
for (const f of ['gym-calc.js', 'gym-muscles.js']) vm.runInContext(fs.readFileSync(new URL('../js/gym/' + f, import.meta.url), 'utf8') + '\n;', ctx);
const run = code => vm.runInContext(code, ctx);
const M = run('({GYM_MUSCLE_LIST,GYM_MUSCLES_BY_ID,GYM_CATALOG,GYM_CATALOG_BY_KEY,gymCatalogByName,gymExerciseMuscles,gymEffort,gymMuscleStats,gymStimulusBand,gymMuscleTrend})');

test('incluye los 20 músculos pedidos con ids únicos', () => {
  const ids = M.GYM_MUSCLE_LIST.map(m => m[0]);
  for (const id of ['pectoral_mayor','dorsal_ancho','trapecio','romboides','erectores','deltoide_anterior','deltoide_lateral','deltoide_posterior','biceps','triceps','braquial','antebrazos','cuadriceps','isquiotibiales','gluteos','gemelos','soleo','aductores','recto_abdominal','oblicuos']) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
});
test('catálogo: claves únicas, nombres únicos, solo músculos conocidos y al menos un principal', () => {
  const keys = new Set(), names = new Set();
  for (const c of M.GYM_CATALOG) {
    assert.ok(!keys.has(c.key), 'clave repetida ' + c.key); keys.add(c.key);
    assert.ok(!names.has(c.name.toLowerCase()), 'nombre repetido ' + c.name); names.add(c.name.toLowerCase());
    const roles = Object.entries(c.muscles);
    assert.ok(roles.some(([, r]) => r === 'P'), c.key + ' sin principal');
    for (const [m, r] of roles) { assert.ok(M.GYM_MUSCLES_BY_ID[m], c.key + ': músculo desconocido ' + m); assert.ok(r === 'P' || r === 'S'); }
  }
});
test('todos los músculos están cubiertos por algún ejercicio del catálogo', () => {
  const covered = new Set(M.GYM_CATALOG.flatMap(c => Object.keys(c.muscles)));
  for (const [id] of M.GYM_MUSCLE_LIST) assert.ok(covered.has(id), id + ' sin ejercicio');
});
test('clasificación: catálogo por clave, por nombre (ignorando tildes/mayúsculas) y por grupo antiguo', () => {
  assert.equal(M.gymExerciseMuscles({ catalog_key: 'press_banca' }).map.pectoral_mayor, 'P');
  const byName = M.gymExerciseMuscles({ name: '  PRESS DE BANCA ' });
  assert.equal(byName.source, 'catalog'); assert.equal(byName.map.triceps, 'S');
  assert.equal(M.gymExerciseMuscles({ name: 'Jalon al pecho' }).map.dorsal_ancho, 'P');
  const own = M.gymExerciseMuscles({ name: 'Mi ejercicio', muscles: { gluteos: 'P', nada: 'P' } });
  assert.deepEqual({ ...own.map }, { gluteos: 'P' }); assert.equal(own.source, 'custom');
  assert.deepEqual({ ...M.gymExerciseMuscles({ name: 'Raro', muscle: 'Pecho' }).map }, { pectoral_mayor: 'P' });
  assert.equal(M.gymExerciseMuscles({ name: 'Raro', muscle: 'Otro' }).source, 'none');
});
test('esfuerzo: RPE ≥ 7 cuenta completo, menos cuenta la mitad, sin RPE se asume completo', () => {
  assert.equal(M.gymEffort(8), 1); assert.equal(M.gymEffort(7), 1); assert.equal(M.gymEffort(6), 0.5); assert.equal(M.gymEffort(null), 1);
});
const ex = [{ id: 'bp', name: 'Press de banca', catalog_key: 'press_banca' }, { id: 'cu', name: 'Curl martillo', catalog_key: 'curl_martillo' }];
const ses = [{ id: 's1', started_at: '2026-11-02T12:00:00Z' }, { id: 'old', started_at: '2026-09-01T12:00:00Z' }];
const sets = [
  { session_id: 's1', exercise_id: 'bp', weight_kg: 60, reps: 10, rpe: 8 },
  { session_id: 's1', exercise_id: 'bp', weight_kg: 60, reps: 8, rpe: 6 },
  { session_id: 's1', exercise_id: 'cu', weight_kg: 14, reps: 12, rpe: null },
  { session_id: 'old', exercise_id: 'bp', weight_kg: 100, reps: 5, rpe: null },
];
test('series ponderadas, volumen con coeficientes y roles por músculo', () => {
  const st = M.gymMuscleStats(ses, sets, ex, '2026-10-28', '2026-11-04');
  // Pectoral (P): 1×1 + 1×0,5 (RPE 6) = 1,5 series; volumen 600+480 = 1080
  assert.equal(st.pectoral_mayor.sets, 2); assert.equal(st.pectoral_mayor.weightedSets, 1.5); assert.equal(st.pectoral_mayor.volume, 1080);
  // Tríceps (S): 0,5×1 + 0,5×0,5 = 0,75 → 0,8; volumen (600+480)×0,5 = 540
  assert.equal(st.triceps.weightedSets, 0.8); assert.equal(st.triceps.volume, 540); assert.equal(st.triceps.secondarySets, 2);
  // Braquial principal en curl martillo, bíceps secundario
  assert.equal(st.braquial.primarySets, 1); assert.equal(st.biceps.secondarySets, 1); assert.equal(st.biceps.weightedSets, 0.5);
  assert.equal(st.gluteos.sets, 0, 'músculos no trabajados quedan en cero');
  assert.equal(st.pectoral_mayor.exercises[0].name, 'Press de banca'); assert.deepEqual([...st.pectoral_mayor.dates], ['2026-11-02']);
});
test('la ventana de fechas excluye sesiones fuera de rango', () => {
  const st = M.gymMuscleStats(ses, sets, ex, '2026-08-30', '2026-09-05');
  assert.equal(st.pectoral_mayor.sets, 1); assert.equal(st.pectoral_mayor.volume, 500);
});
test('bandas de estímulo', () => {
  assert.deepEqual([0, 3, 7, 12, 20, 25].map(M.gymStimulusBand), [0, 1, 2, 3, 3, 4]);
});
test('tendencia: sin periodo anterior no afirma progreso; con datos compara', () => {
  const t1 = M.gymMuscleTrend(ses.slice(0, 1), sets.slice(0, 2), ex, '2026-11-04', 'pectoral_mayor');
  assert.match(t1.label, /hace poco/);
  const sesT = [{ id: 'a', started_at: '2026-10-01T12:00:00Z' }, { id: 'b', started_at: '2026-11-01T12:00:00Z' }];
  const setsT = [{ session_id: 'a', exercise_id: 'bp', weight_kg: 60, reps: 8 }, { session_id: 'b', exercise_id: 'bp', weight_kg: 70, reps: 8 }];
  const t2 = M.gymMuscleTrend(sesT, setsT, ex, '2026-11-04', 'pectoral_mayor');
  assert.equal(t2.tone, 'ok'); assert.ok(t2.strength[0].change > 0);
  assert.equal(M.gymMuscleTrend([], [], ex, '2026-11-04', 'gluteos').label, 'Sin entrenamiento registrado');
});
