/* ---- Reglas de recordatorios (fuente única) ----
   La usan el navegador (avisos mientras la app está abierta) y la función del servidor
   (notificaciones push con la app cerrada). supabase/functions/_shared/reminders-core.mjs
   debe ser una copia idéntica de este archivo; un test lo comprueba.
   Todo se calcula en hora de Bogotá (UTC−5, sin horario de verano). Función pura: no lee el reloj
   ni el DOM; recibe `now` en milisegundos. */

export const DEFAULT_NOTIF_PREFS = Object.freeze({
  enabled: true,
  categories: { finanzas: true, trabajo: true, metas: true, organizacion: true },
  paymentLeadDays: 1,      // días antes del vencimiento
  shiftLeadMin: 60,        // minutos antes del turno
  goalLeadDays: 7,         // días antes de la fecha objetivo
  summaryTime: '07:00',    // resumen diario y avisos de pagos/metas
  weeklyDay: 0,            // 0 = domingo
  weeklyTime: '19:00',     // resumen semanal de horas
  quietStart: '22:00',     // no molestar (solo avisos inmediatos)
  quietEnd: '07:00',
  bigExpense: 300000,      // gasto importante (COP)
  savingsDay: 25           // día del mes para recordar el ahorro
});

const OFFSET_MS = 5 * 3600 * 1000; // Bogotá = UTC−5
const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = s => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);

/* Fecha y hora de Bogotá para un instante. */
export function bogota(ms) {
  const d = new Date(ms - OFFSET_MS);
  return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`, dow: d.getUTCDay() };
}
/* Instante (ms) de una fecha y hora de Bogotá. */
export function atBogota(date, time = '00:00') {
  const [y, m, d] = date.split('-').map(Number), [h, mi] = (isTime(time) ? time : '00:00').split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, mi) + OFFSET_MS;
}
const addDays = (date, n) => { const x = new Date(date + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dowOf = date => new Date(date + 'T12:00:00Z').getUTCDay();
const money = n => { const v = Math.round(Number(n) || 0); return (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('es-CO') + ' COP'; };
const minutes = t => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
function shiftHours(s) {
  if (!isTime(s.in) || !isTime(s.out)) return 0;
  let m = minutes(s.out) - minutes(s.in); if (m <= 0) m += 1440;
  return Math.max(0, m - (Number(s.brk) || 0)) / 60;
}
function shiftEndMs(s) { const start = atBogota(s.date, s.in); let end = atBogota(s.date, s.out); if (end <= start) end += DAY; return end; }
function inQuiet(time, start, end) {
  if (!isTime(start) || !isTime(end) || start === end) return false;
  return start < end ? (time >= start && time < end) : (time >= start || time < end);
}
function dayLabel(target, today) {
  if (target === today) return 'hoy';
  if (target === addDays(today, 1)) return 'mañana';
  const n = Math.round((Date.parse(target) - Date.parse(today)) / DAY);
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}
export function normalizePrefs(p) {
  const out = { ...DEFAULT_NOTIF_PREFS, ...(p && typeof p === 'object' ? p : {}) };
  out.categories = { ...DEFAULT_NOTIF_PREFS.categories, ...(p && p.categories && typeof p.categories === 'object' ? p.categories : {}) };
  for (const k of ['paymentLeadDays', 'shiftLeadMin', 'goalLeadDays', 'weeklyDay', 'bigExpense', 'savingsDay']) {
    const n = Number(out[k]); out[k] = Number.isFinite(n) && n >= 0 ? n : DEFAULT_NOTIF_PREFS[k];
  }
  for (const k of ['summaryTime', 'weeklyTime', 'quietStart', 'quietEnd']) if (!isTime(out[k])) out[k] = DEFAULT_NOTIF_PREFS[k];
  return out;
}

/* Devuelve los recordatorios que deben salir ahora: su hora ya llegó y no tiene más de `windowMs` de retraso.
   Cada uno lleva una `key` estable para no enviarlo dos veces. */
export function computeReminders(data, prefsIn, now, { windowMs = 3 * 3600 * 1000 } = {}) {
  const prefs = normalizePrefs(prefsIn), out = [];
  if (!data || typeof data !== 'object' || !prefs.enabled) return out;
  const { date: today, time: nowTime } = bogota(now), month = today.slice(0, 7), cat = prefs.categories;
  const quiet = inQuiet(nowTime, prefs.quietStart, prefs.quietEnd);
  const tx = Array.isArray(data.tx) ? data.tx : [], goals = Array.isArray(data.goals) ? data.goals : [];
  const scheduled = Array.isArray(data.scheduledShifts) ? data.scheduledShifts.filter(x => x && isDate(x.date) && isTime(x.in) && isTime(x.out)) : [];
  const shifts = Array.isArray(data.shifts) ? data.shifts.filter(x => x && isDate(x.date)) : [];
  const inst = data.inst && typeof data.inst === 'object' ? data.inst : {};
  const routines = Array.isArray(data.routines) ? data.routines : [];
  const rate = Number(data.rate) || 0;
  /* at: hora programada; exempt: se envía aunque esté en horario de no molestar. */
  const push = (key, category, title, body, tab, at, exempt = false) => {
    if (!cat[category]) return;
    if (at === 'now') { if (quiet && !exempt) return; at = now; }
    if (at > now || at <= now - windowMs) return;
    out.push({ key, category, title, body, tab, fireAt: at });
  };

  /* ---- Finanzas ---- */
  for (const t of tx) {
    if (!t || t.type !== 'gasto' || !isDate(t.date)) continue;
    if (t.status === 'pendiente') {
      const name = String(t.name || 'Pago'), amt = money(t.amount);
      if (prefs.paymentLeadDays > 0) {
        const d = addDays(t.date, -prefs.paymentLeadDays);
        push(`pay-lead:${t.id}:${t.date}`, 'finanzas', `Pago próximo: ${name}`, `Vence ${dayLabel(t.date, d)} · ${amt}`, 'mov', atBogota(d, prefs.summaryTime));
      }
      push(`pay-today:${t.id}:${t.date}`, 'finanzas', `Hoy vence: ${name}`, `${amt} · márcalo como pagado cuando lo hagas`, 'mov', atBogota(t.date, prefs.summaryTime));
      push(`pay-over:${t.id}:${t.date}`, 'finanzas', `Pago vencido: ${name}`, `Venció ayer · ${amt}`, 'mov', atBogota(addDays(t.date, 1), '09:00'));
    } else if (t.status === 'pagado' && prefs.bigExpense > 0 && Number(t.amount) >= prefs.bigExpense && Number(t.u) > now - DAY && Number(t.u) <= now) {
      push(`big:${t.id}`, 'finanzas', 'Gasto importante registrado', `${String(t.name || 'Gasto')} · ${money(t.amount)}`, 'mov', 'now');
    }
  }
  const budgets = Array.isArray(data.budgets) ? data.budgets.filter(b => b && typeof b.cat === 'string' && Number(b.amount) > 0) : [];
  for (const b of budgets) {
    const key = b.cat.trim().toLocaleLowerCase('es-CO');
    const rows = tx.filter(t => t && isDate(t.date) && t.date.slice(0, 7) === month && String(t.cat || 'Otros').trim().toLocaleLowerCase('es-CO') === key);
    const used = Math.max(0, rows.filter(t => t.type === 'gasto' && t.status === 'pagado').reduce((s, t) => s + (Number(t.amount) || 0), 0) - rows.filter(t => t.type === 'devolucion' && (t.status === 'recibido' || t.status === 'pagado')).reduce((s, t) => s + (Number(t.amount) || 0), 0));
    const pct = used / Number(b.amount) * 100;
    if (pct >= 100) push(`budget100:${key}:${month}`, 'finanzas', `Superaste el presupuesto de ${b.cat}`, `${money(used)} de ${money(b.amount)} este mes`, 'mov', 'now');
    else if (pct >= 80) push(`budget80:${key}:${month}`, 'finanzas', `Vas en el ${Math.round(pct)}% del presupuesto de ${b.cat}`, `${money(used)} de ${money(b.amount)} este mes`, 'mov', 'now');
  }
  const moneyGoals = goals.filter(g => g && g.kind !== 'personal' && Number(g.target) > 0);
  const planned = moneyGoals.reduce((s, g) => s + (Number(g.monthly) || 0), 0);
  if (planned > 0 && prefs.savingsDay >= 1 && prefs.savingsDay <= 31) {
    const [y, m] = month.split('-').map(Number), last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const d = `${month}-${pad(Math.min(prefs.savingsDay, last))}`;
    const saved = moneyGoals.reduce((s, g) => s + (Array.isArray(g.aportes) ? g.aportes : []).filter(a => a && String(a.date || '').slice(0, 7) === month).reduce((x, a) => x + (Number(a.amount) || 0), 0), 0);
    if (saved < planned) push(`save:${month}`, 'finanzas', 'Recordatorio de ahorro', `Este mes llevas ${money(saved)} de ${money(planned)} planeados para tus metas`, 'metas', atBogota(d, prefs.summaryTime));
  }

  /* ---- Trabajo ---- */
  const active = data.activeShift && data.activeShift.on ? data.activeShift : null;
  for (const s of scheduled) {
    const start = atBogota(s.date, s.in), hrs = shiftHours(s);
    const lead = prefs.shiftLeadMin, leadTxt = lead >= 60 ? `${Math.round(lead / 6) / 10} h` : `${lead} min`;
    push(`shift-start:${s.id}:${s.date}:${s.in}`, 'trabajo', lead > 0 ? `Tu turno empieza en ${leadTxt}` : 'Tu turno empieza ahora', `${s.in}–${s.out} · ${hrs.toFixed(1)} h · ${money(hrs * (Number(s.rate) || rate))} estimados`, 'turnos', start - lead * 60000, true);
    if (!(active && active.scheduledId === s.id)) push(`shift-rec:${s.id}`, 'trabajo', 'Registra tu turno', `Terminó tu turno de ${s.in} a ${s.out}. Regístralo como realizado o cancélalo.`, 'turnos', shiftEndMs(s) + 30 * 60000);
  }
  if (active && Number(active.startedAt) > 0) {
    const linked = scheduled.find(s => s.id === active.scheduledId);
    const due = linked ? shiftEndMs(linked) + 20 * 60000 : Number(active.startedAt) + 9 * 3600000;
    push(`clockout:${active.startedAt}`, 'trabajo', '¿Ya saliste del turno?', `Tienes un turno abierto desde las ${active.in || '—'}. Marca la salida para calcular tus horas.`, 'turnos', due, true);
  }
  if (prefs.weeklyDay === bogota(now).dow) {
    const from = addDays(today, -6), week = shifts.filter(s => s.date >= from && s.date <= today);
    if (week.length) {
      const hrs = week.reduce((x, s) => x + shiftHours(s), 0), pay = week.reduce((x, s) => x + shiftHours(s) * (Number(s.rate) || rate), 0);
      const unpaid = shifts.filter(s => !s.paid).reduce((x, s) => x + shiftHours(s) * (Number(s.rate) || rate), 0);
      push(`week:${today}`, 'trabajo', 'Resumen de tu semana', `${hrs.toFixed(1)} h trabajadas · ${money(pay)} estimados${unpaid > 0 ? ' · por cobrar ' + money(unpaid) : ''}`, 'turnos', atBogota(today, prefs.weeklyTime));
    }
  }

  /* ---- Metas ---- */
  for (const g of goals) {
    if (!g || !(Number(g.target) > 0)) continue;
    const log = (g.kind === 'personal' ? g.progress : g.aportes) || [], done = log.reduce((s, x) => s + (Number(x && x.amount) || 0), 0);
    const rest = Math.max(0, Number(g.target) - done), unit = g.kind === 'personal' ? (v => `${Math.round(v * 100) / 100} ${g.unit || ''}`.trim()) : money;
    if (rest > 0 && isDate(g.targetDate)) {
      if (prefs.goalLeadDays > 0) { const d = addDays(g.targetDate, -prefs.goalLeadDays); push(`goal-lead:${g.id}:${g.targetDate}`, 'metas', `Faltan ${prefs.goalLeadDays} días para «${g.name}»`, `Te falta ${unit(rest)} para cumplirla`, 'metas', atBogota(d, prefs.summaryTime)); }
      push(`goal-day:${g.id}:${g.targetDate}`, 'metas', `Hoy es la fecha de «${g.name}»`, `Te falta ${unit(rest)}. Puedes ajustar la fecha o el ritmo.`, 'metas', atBogota(g.targetDate, prefs.summaryTime));
    }
    const pct = done / Number(g.target) * 100, m = [100, 75, 50, 25].find(x => pct >= x);
    const recent = log.some(x => x && isDate(x.date) && x.date >= addDays(today, -1));
    if (m && recent) push(`goal-m${m}:${g.id}`, 'metas', m === 100 ? `¡Cumpliste «${g.name}»!` : `Llevas el ${m}% de «${g.name}»`, m === 100 ? 'Meta completada.' : `Te falta ${unit(rest)}.`, 'metas', 'now');
  }

  /* ---- Organización ---- */
  const todayItems = [];
  for (const [d, list] of Object.entries(inst)) {
    if (!isDate(d) || !Array.isArray(list)) continue;
    for (const t of list) {
      if (!t || t.done) continue;
      if (d === today) todayItems.push(t);
      if (!isTime(t.time) || t.remind === undefined || t.remind === '' || t.remind === null) continue;
      const key = t.rid ? `task-r:${t.rid}:${d}` : `task:${t.id}:${d}`, lead = Number(t.remind) || 0;
      push(key, 'organizacion', lead > 0 ? `En ${lead >= 60 ? lead / 60 + ' h' : lead + ' min'}: ${t.name}` : `Ahora: ${t.name}`, `Empieza a las ${t.time}`, 'dia', atBogota(d, t.time) - lead * 60000, true);
    }
  }
  /* Rutinas de hoy que aún no se generaron (la app no se abrió hoy). */
  const todayList = Array.isArray(inst[today]) ? inst[today] : [], dow = dowOf(today);
  for (const r of routines) {
    if (!r || !r.active || !Array.isArray(r.days) || !r.days.includes(dow) || (isDate(r.from) && today < r.from) || (isDate(r.to) && today > r.to)) continue;
    if (todayList.some(t => t && t.rid === r.id)) continue;
    todayItems.push(r);
    if (!isTime(r.time) || r.remind === undefined || r.remind === '' || r.remind === null) continue;
    const lead = Number(r.remind) || 0;
    push(`task-r:${r.id}:${today}`, 'organizacion', lead > 0 ? `En ${lead >= 60 ? lead / 60 + ' h' : lead + ' min'}: ${r.name}` : `Ahora: ${r.name}`, `Empieza a las ${r.time}`, 'dia', atBogota(today, r.time) - lead * 60000, true);
  }
  const shiftsToday = scheduled.filter(s => s.date === today).length, paysToday = tx.filter(t => t && t.type === 'gasto' && t.status === 'pendiente' && t.date === today).length;
  if (todayItems.length || shiftsToday || paysToday) {
    const parts = [];
    if (todayItems.length) parts.push(`${todayItems.length} ${todayItems.length === 1 ? 'tarea' : 'tareas'}`);
    if (shiftsToday) parts.push(`${shiftsToday} ${shiftsToday === 1 ? 'turno' : 'turnos'}`);
    if (paysToday) parts.push(`${paysToday} ${paysToday === 1 ? 'pago' : 'pagos'}`);
    push(`daily:${today}`, 'organizacion', 'Tu día', `Hoy tienes ${parts.join(', ')}.`, 'dash', atBogota(today, prefs.summaryTime));
  }
  return out.sort((a, b) => a.fireAt - b.fireAt);
}
