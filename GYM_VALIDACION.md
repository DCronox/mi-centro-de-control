# Gym Intelligence · Validación final (fase I)

Fecha: 2026-11-04 · Rama `evolucion-v2` · 129 pruebas automáticas en verde (`node --test tests/`).

## Resumen

| Fase | Criterio de aceptación (plan) | Estado | Cómo se verificó |
|---|---|---|---|
| B. Evaluación | Ecuaciones con casos publicados | ✅ | `gym-engine.test.mjs`: Mifflin-St Jeor exacto, rangos ±10 % |
| | Menores / embarazo / lactancia sin déficit | ✅ | Pruebas de modo seguro + navegador |
| | Datos opcionales vacíos no bloquean | ✅ | Sueño, cardio, notas opcionales en pruebas y navegador |
| | RLS probado con 2 usuarios | ✅ lectura · ⚠️ escritura | Lectura: un segundo usuario ve 0 filas de las 8 tablas personales (dueño ve las suyas). Escritura: lo garantiza la cláusula `with check` de cada política; la prueba de escritura en vivo no se ejecutó (la bloqueó el control de seguridad, aunque iba en una transacción revertida) |
| | Editable y borrable | ✅ | Navegador: editar evaluación, historial de objetivos, «Borrar evaluación y objetivos» |
| | **Cuenta real** | ✅ | Evaluación y objetivo aceptado guardados y comprobados en Supabase |
| C. Panel | Valores exactos al registrar | ✅ | Pruebas de totales + navegador |
| | Exceso > 100 % sin deformar el círculo | ✅ | Anillo lleno en color de aviso y «+X %» en texto |
| | **Cuenta real** | ✅ | Agua y comida guardadas y borradas con la cuenta real |
| D. Alimentos | Cada registro guarda fuente, fecha y marca de estimación | ✅ | `source`, `source_ref`, `original_text`, `estimated` comprobados en la base de datos |
| | Búsqueda sin exponer la clave | ✅ | La clave está solo en el secreto `USDA_API_KEY`; búsqueda real con la clave del usuario (`demo_key:false`) |
| E. Progresión | Completar rango → subir; fallar → no subir; el usuario confirma | ✅ | 15 casos de prueba; botón «Usar» solo rellena series pendientes |
| | Recomendación antes y después de cada sesión | ✅ | Antes: en cada ejercicio. Después: «Próxima vez» en el resumen al terminar (añadido en esta fase) |
| F. Recuperación | Sin «recuperado 100 %» | ✅ | Prueba que comprueba que ningún texto dice «recuperado» |
| | Tendencias con datos mínimos | ✅ | ≥3 registros por semana; si no, «sin base» |
| G. Recomendaciones | Ninguna sin datos que la respalden; trazabilidad visible | ✅ | Pruebas por regla con y sin datos mínimos; con los datos reales actuales no aparece ninguna |
| H. Historial | «Sin base estadística» cuando falten datos | ✅ | ≥8 registros en 4 semanas; intervalo del 95 % comprobado a mano en las pruebas |

## Seguridad (Supabase)

- **16 tablas con RLS.** Todas las personales usan `(select auth.uid()) = user_id`; `anon` no puede leer ni escribir ninguna.
- `food_reference` (USDA) es compartida y de solo lectura; `food_search_cache` y `food_search_log` solo las usa la función del servidor (un usuario con sesión recibe «permiso denegado»).
- Asesor de seguridad: sin avisos nuevos de Gym. Los 4 que quedan son anteriores: `pg_net` en `public`, `rls_auto_enable()` ejecutable por anónimos, protección de contraseñas filtradas desactivada y `delete_my_account()` (intencional).
- **Hallazgo:** 7 tablas creadas antes conservan `TRUNCATE` para usuarios con sesión (la API no lo permite, pero conviene retirarlo). Corregido: `20261111120000_gym_revoke_truncate.sql` aplicada el 2026-11-04; ninguna tabla de Gym conserva TRUNCATE.

## Rendimiento

Con un año de datos simulados intensos (208 entrenamientos, 7.488 series, 122 pesos, 140 comidas, 90 registros de recuperación), tiempo de dibujo por pestaña en escritorio:

| Pestaña | Antes | Después |
|---|---|---|
| Historial 3 meses / 12 meses | 972 / 1.095 ms | 52 / 103 ms |
| Progreso | 226 ms | 56 ms |
| Resumen | 162 ms | 67 ms |
| Recuperación | 36 ms | 10 ms |
| Resto | < 20 ms | < 20 ms |

Causa: se convertían fechas y se clasificaban ejercicios por cada serie; ahora se hace una vez por sesión o por ejercicio.
Asesor de rendimiento: sin avisos de Gym. Las políticas de `mcc_data` (app principal) reevalúan `auth.uid()` por fila; con una fila por persona el impacto es mínimo (mejora opcional).

## Móvil y accesibilidad (375 px)

Las 9 pestañas y 3 estados con formularios abiertos: sin desplazamiento horizontal, sin errores de JavaScript, todos los campos con etiqueta, gráficos con descripción, idioma `es`. Se añadieron etiquetas descriptivas a los botones «Ocultar esta semana».

## Funcionamiento sin conexión

Prueba automática: todo lo que carga `gym.html` está en la caché del service worker y existe; cada módulo de `js/gym` está cargado.

## Desviaciones respecto al plan (decididas y documentadas)

- Metas y banderas de seguridad viven en `gym_profiles` (no tablas aparte).
- Las recomendaciones se recalculan y no se guardan (`gym_insights` no se creó); «ocultar» se recuerda por dispositivo.
- RIR se obtiene del RPE (RIR = 10 − RPE); no hay columna de descanso real por serie: **los descansos reales no se registran** (solo el objetivo de la rutina).
- Alimentos colombianos del ICBF no incluidos: no se verificó la licencia de reutilización. Se usan alimentos propios + USDA.

## Pendiente

1. ~~Retirar TRUNCATE~~ — aplicada y comprobada (2026-11-04).
2. ~~Catálogo de ejercicios~~ — `20261105120000_gym_catalogo.sql` aplicada; el ejercicio existente quedó enlazado a `press_banca` (2026-11-04).
3. Publicar en `main` (con autorización).
4. Uso real prolongado: recomendaciones, tendencias y proyecciones necesitan semanas de registros para activarse.
