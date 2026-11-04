import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../js/gym/gym-engine.js');
const { GYM_REFS } = require('../js/gym/references.js');

const REF = new Date('2026-11-04T12:00:00-05:00');
const base = { birth_year: 1996, sex: 'm', height_cm: 175, weight_kg: 80, goal: 'maintenance', occupation: 'sedentary', walking: 'low', experience: 'intermediate', training_days: 4, session_min: 60, cardio_min_week: 0, safety: {} };
const P = o => ({ ...base, ...o, safety: { ...(o && o.safety) } });

test('Mifflin-St Jeor coincide con la fórmula publicada', () => {
  // 10*80 + 6.25*175 - 5*30 + 5 = 1748.75
  const b = E.gymBmr(P(), 30);
  assert.equal(Math.round(b.value), 1749);
  assert.equal(Math.round(b.low), Math.round(1748.75 * 0.9));
  const f = E.gymBmr(P({ sex: 'f' }), 30);
  assert.equal(Math.round(f.value), Math.round(1748.75 - 5 - 161));
  const x = E.gymBmr(P({ sex: 'x' }), 30);
  assert.ok(x.low < f.value && x.high > b.value, 'sin sexo indicado el rango cubre ambos');
});

test('PAL dentro de las bandas FAO y creciente con la actividad', () => {
  const lo = E.gymPal(P({ training_days: 0, session_min: 0 }));
  const hi = E.gymPal(P({ occupation: 'heavy', walking: 'high', training_days: 6, session_min: 90, cardio_min_week: 300 }));
  assert.equal(lo.value, 1.45);
  assert.ok(hi.value > lo.value && hi.value <= 2.40);
  assert.ok(lo.value >= 1.40);
});

test('mantenimiento: kcal = gasto y macros coherentes', () => {
  const r = E.gymComputeTargets(P(), REF);
  assert.ok(r.ok);
  assert.equal(r.age, 30);
  assert.equal(r.energy.adjust, 0);
  assert.equal(r.energy.kcal, r.energy.tdee);
  assert.ok(r.energy.tdeeRange[0] < r.energy.tdee && r.energy.tdee < r.energy.tdeeRange[1]);
  assert.equal(r.macros.protein, 128); // 1.6 g/kg × 80
  assert.ok(Math.abs(r.macros.kcalFromMacros - r.energy.kcal) / r.energy.kcal <= 0.02);
  assert.equal(r.macros.fiber, Math.round(r.energy.kcal * 14 / 1000));
  assert.equal(r.water.liters, 2.5);
});

test('pérdida de grasa: déficit ≤ 20 % y nunca bajo el basal; más proteína', () => {
  const r = E.gymComputeTargets(P({ goal: 'fat_loss' }), REF);
  assert.ok(r.energy.adjust < 0);
  assert.ok(-r.energy.adjust <= r.energy.tdee * 0.2 + 1);
  assert.ok(r.energy.kcal >= r.energy.bmr - 10);
  assert.equal(r.macros.proteinPerKg, 2.0);
  assert.ok(r.energy.weeklyKg <= 80 * 0.005 + 0.01);
  // persona de poco gasto: el tope del basal se aplica
  const s = E.gymComputeTargets(P({ goal: 'fat_loss', sex: 'f', weight_kg: 95, height_cm: 160, birth_year: 1970, training_days: 0, session_min: 0 }), REF);
  assert.ok(s.energy.kcal >= s.energy.bmr - 10);
});

test('IMC < 18,5: sin déficit aunque se pida perder grasa', () => {
  const r = E.gymComputeTargets(P({ goal: 'fat_loss', weight_kg: 52, height_cm: 180 }), REF);
  assert.equal(r.energy.adjust, 0);
  assert.ok(r.warnings.some(w => w.includes('18,5')));
});

test('ganancia muscular: superávit 10 % (5 % avanzado)', () => {
  const a = E.gymComputeTargets(P({ goal: 'muscle_gain' }), REF);
  assert.equal(a.energy.adjust, Math.round(a.energy.tdee * 0.10 / 1) || a.energy.adjust);
  assert.ok(Math.abs(a.energy.adjust / (a.energy.kcal - a.energy.adjust) - 0.10) < 0.01);
  const b = E.gymComputeTargets(P({ goal: 'muscle_gain', experience: 'advanced' }), REF);
  assert.ok(b.energy.adjust < a.energy.adjust);
});

test('IMC ≥ 30: proteína por peso de referencia', () => {
  const r = E.gymComputeTargets(P({ weight_kg: 120, height_cm: 175 }), REF);
  assert.equal(r.macros.protein, Math.round(25 * 1.75 * 1.75 * 1.6));
});

test('menor de edad: sin objetivo de kcal y recomendación profesional', () => {
  const r = E.gymComputeTargets(P({ birth_year: 2011, goal: 'fat_loss' }), REF);
  assert.equal(r.safety.mode, 'minor');
  assert.equal(r.energy, null);
  assert.equal(r.macros, null);
  assert.ok(r.warnings.some(w => w.includes('profesional')));
});

test('embarazo, lactancia o TCA: sin objetivos; condición declarada: solo mantenimiento', () => {
  for (const k of ['pregnant', 'lactating', 'eating_disorder']) {
    const r = E.gymComputeTargets(P({ sex: 'f', goal: 'fat_loss', safety: { [k]: true } }), REF);
    assert.equal(r.safety.mode, 'professional'); assert.equal(r.energy, null);
  }
  const c = E.gymComputeTargets(P({ goal: 'fat_loss', safety: { condition: true } }), REF);
  assert.equal(c.safety.mode, 'prudent');
  assert.equal(c.energy.adjust, 0);
  assert.equal(c.energy.goal, 'maintenance');
});

test('validación rechaza datos imposibles', () => {
  const r = E.gymComputeTargets(P({ height_cm: 80, weight_kg: 5, sex: '' }), REF);
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 3);
});

test('todas las referencias usadas existen', () => {
  for (const o of [P(), P({ goal: 'fat_loss' }), P({ goal: 'muscle_gain' }), P({ sex: 'f', safety: { pregnant: true } })]) {
    const r = E.gymComputeTargets(o, REF);
    for (const k of r.refs) assert.ok(GYM_REFS[k], 'falta ' + k);
    for (const s of r.steps) if (s.ref) assert.ok(GYM_REFS[s.ref], 'falta ' + s.ref);
  }
});

test('cambio relativo de objetivo', () => {
  assert.equal(E.gymTargetChange(2000, 2120), 6);
  assert.equal(E.gymTargetChange(null, 2000), null);
});
