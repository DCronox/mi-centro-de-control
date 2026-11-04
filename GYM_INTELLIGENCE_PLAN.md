# Gym Intelligence · Fase A: auditoría y plan

Fecha: 2026-11-05. Estado: **propuesta**. No se modificó código ni base de datos en esta fase.

## 1. Estado actual (auditoría)

**Arquitectura.** Sitio estático (HTML + CSS + JS clásico, sin compilación) publicado en GitHub Pages desde `main`.
Gym vive en `gym.html` con sus scripts en `js/gym/`:

| Archivo | Función |
|---|---|
| `gym-data.js` | Cliente Supabase (config compartida `js/cloud-config.js`), sesión, lectura de «Mi día» |
| `gym-store.js` | Lectura/escritura de tablas `gym_*`, entrenamiento en curso en el navegador, cola de subida offline |
| `gym-calc.js` | Volumen, 1RM (Epley), récords, tendencias de peso (puro, con tests) |
| `gym-muscles.js` | 20 músculos, catálogo de 47 ejercicios con músculos principal/secundario, estímulo estimado (puro, con tests) |
| `gym-map.js` | Mapa anatómico SVG frontal/posterior |
| `gym.js` | Interfaz: Resumen, Rutinas, Entrenar, Progreso, Físico, Nutrición (pendiente) |

**Autenticación.** Supabase Auth (correo y contraseña). La sesión se comparte con la app principal (mismo origen).
Gym exige sesión para guardar; sin sesión solo muestra datos de «Mi día» del dispositivo.

**Base de datos (verificada hoy).** Todas con RLS por `user_id`, sin acceso `anon`:

| Tabla | Contenido | Filas reales |
|---|---|---|
| `gym_exercises` | Biblioteca del usuario (nombre, grupo) | 1 |
| `gym_routines` | Rutinas con ejercicios en `items` (jsonb) | 0 |
| `gym_sessions` | Entrenamientos (inicio, fin, rutina) | 0 |
| `gym_sets` | Series (peso, reps, RPE) | 0 |
| `body_metrics` | Peso y medidas por día | 1 |
| `mcc_data`, `notifications`, `push_subscriptions` | App principal (no se tocan) | — |

**Pendiente de la fase anterior.** Migración `20261105120000_gym_catalogo.sql` (columnas `catalog_key`, `muscles`) **no aplicada**;
la app funciona sin ella. Gym 1.1 no se ha probado con una cuenta real ni está publicado.

**Brechas frente a Gym Intelligence.**
- No hay perfil del usuario (edad, sexo para ecuaciones, estatura, actividad, objetivos, experiencia, sueño, alimentación, seguridad).
- No hay objetivos energéticos ni de macronutrientes, ni registro de alimentos, agua o fibra.
- Las series no guardan RIR ni descanso real; las rutinas no guardan peso objetivo ni incremento por equipo.
- No hay registro de sueño/recuperación ni motor de recomendaciones con trazabilidad.
- No hay sistema de referencias científicas.

## 2. Principios de diseño

1. **Cálculos locales y deterministas** (funciones puras con tests), con la fórmula, los datos usados y la referencia visibles.
2. **Estimación ≠ medición.** Cada cifra calculada muestra su margen de incertidumbre y su método.
3. **El usuario decide.** Nada cambia objetivos ni cargas sin confirmación.
4. **Datos mínimos.** Los datos de salud son opcionales; se guardan como respuestas estructuradas, editables y borrables.
5. **Seguridad clínica.** Menores de edad, embarazo/lactancia o condiciones declaradas → sin déficits ni prescripciones; se recomienda acompañamiento profesional.
6. **Sin navegación web en tiempo de uso.** La app no lee páginas web; solo consulta APIs de datos (USDA) a través de una función del servidor con caché. Las referencias científicas se actualizan como contenido versionado del proyecto.

## 3. Modelo de datos propuesto (nuevo, normalizado, aditivo)

Todas las tablas: `user_id uuid references auth.users on delete cascade`, RLS `(select auth.uid()) = user_id`, sin `anon`,
índices por usuario y fecha. Nada existente se borra ni se renombra.

| Tabla | Propósito | Notas |
|---|---|---|
| `gym_profiles` (1 por usuario) | Evaluación inicial: año de nacimiento, sexo para ecuaciones, estatura, experiencia, días/duración, equipo, actividad cotidiana, hábitos de sueño, preferencias de comida | Respuestas estructuradas (`jsonb` validado) + `assessment_version`, `completed_at` |
| `gym_goals` | Objetivos con prioridad (recomposición, masa, grasa, fuerza, mantenimiento, condición) | Varios por usuario, uno principal |
| `gym_safety` | Banderas de seguridad opcionales (embarazo/lactancia, condición declarada, lesión, medicación relevante) | Solo booleanos y texto opcional; activa el «modo prudente» |
| `nutrition_targets` | Historial de objetivos: kcal, proteína, carbohidratos, grasas, fibra, agua; método, entradas usadas, incertidumbre, estado (`propuesto`/`aceptado`/`manual`), vigencia | Permite revisar y confirmar cambios sin perder el historial |
| `food_reference` (compartida, solo lectura) | Alimentos de referencia por 100 g: fuente (USDA FDC / ICBF / estimación), id externo, nutrientes, porciones típicas, fecha de consulta | Escritura solo con clave de servicio (función del servidor) |
| `food_custom` | Alimentos propios del usuario | — |
| `food_logs` | Registro: fecha, comida, alimento, cantidad, unidad, gramos, **copia de nutrientes**, origen (manual/texto), texto original, `estimated` | La copia evita que cambios en la referencia alteren el pasado |
| `water_logs` | Agua por día (ml) | Puede unirse a un registro diario |
| `recovery_logs` (1 por día) | Hora de acostarse/despertar, horas, calidad, fatiga, energía, dolor, estrés, recuperación (escalas 1–5) | — |
| `gym_insights` | Recomendaciones: observación, datos usados, conclusión, acción, confianza, tipo (observación/estimación/recomendación), fecha, estado | Clave única para no repetir |
| `gym_audit` | Cambios importantes (perfil, objetivos, borrados) | Solo inserción por triggers |
| Ampliaciones aditivas | `gym_sets.rir`, `gym_sets.rest_s`; `gym_routines.items[]` con `target_kg`, `increment_kg`, `equipment` | Columnas opcionales; el historial actual sigue válido |

Las **referencias científicas** se guardan como archivo versionado en el repositorio (`js/gym/references.js`), no en la base de datos:
son iguales para todos los usuarios y deben revisarse en código.

## 4. Motores de cálculo (reglas y referencias)

**Gasto energético.**
- Metabolismo basal: Mifflin-St Jeor para adultos (18 años o más). Con % de grasa medido por un método fiable, alternativa por masa magra (Katch-McArdle).
- Gasto total = basal × nivel de actividad física (PAL), calculado con trabajo, pasos/caminata, actividad cardiovascular y entrenamiento. No se usan solo los días de gimnasio.
- Incertidumbre mostrada como rango (±10 % aprox. en el basal; mayor si faltan datos).

**Objetivo energético por meta.** Todo se recalcula con el peso real:
- **Pérdida de grasa:** déficit prudente que busque ~0,5–1 % del peso por semana. Tope del 20–25 % del gasto y nunca por debajo del basal estimado.
- **Ganancia muscular:** superávit pequeño (≈ 5–10 %).
- **Recomposición, fuerza y mantenimiento:** en torno al mantenimiento.
- **Menores, embarazo, lactancia o una condición declarada:** sin déficit, solo mantenimiento orientativo, y se recomienda un profesional.

**Macronutrientes.**
- **Proteína:** 1,6 g/kg como base (Morton 2018), dentro de 1,4–2,0 g/kg (ISSN 2017). Hasta ≈ 2,2–2,3 g/kg en déficit con experiencia previa. Se usa un peso de referencia ajustado si el IMC es alto.
- **Grasa:** dentro del rango del 20–35 % de la energía.
- **Carbohidratos:** el resto. Se comprueba frente a 3–5 g/kg en entrenamiento moderado (ACSM/AND/DC 2016) y se avisa si queda por debajo.
- **Coherencia:** las kcal de los macronutrientes deben coincidir con el objetivo.

**Fibra y agua.** Fibra: 14 g por cada 1.000 kcal. Agua: referencia diaria orientativa según sexo y actividad.

**Revisión periódica.**
- Tendencia de peso suavizada (media móvil exponencial), revisada cada 2–3 semanas como mínimo.
- Se propone un cambio solo si la tendencia se aparta de lo esperado.
- Si el cambio supera ~5 %, se pide confirmación. Nunca se cambian los objetivos cada día.

**Progresión de cargas (doble progresión).**
- Cada ejercicio tiene un rango de repeticiones, un RIR objetivo y un incremento según el equipo (barra, mancuernas, máquina, peso corporal).
- **Proponer subir:** si todas las series llegaron al máximo del rango con el RIR objetivo.
- **Proponer mantener:** si se está dentro del rango y se mejoró.
- **Proponer revisar el descanso o bajar el peso:** si se falló el mínimo del rango en dos sesiones o el rendimiento cae.
- Considera las 2–3 últimas sesiones, la fatiga declarada y el sueño. Solo propone; no cambia nada sin confirmación.

**Recuperación.** Por músculo: días desde el último estímulo, series ponderadas por semana, tendencia de rendimiento y fatiga/sueño declarados.
Nunca afirma «recuperado al 100 %»; el tiempo es una variable de análisis, no un diagnóstico.

**Proyecciones.** Regresión sobre la tendencia de peso y de 1RM, con intervalo de confianza. Sin una base mínima (p. ej. menos de 4 semanas y 8 registros) se muestra «sin base estadística suficiente». No se proyecta crecimiento muscular ni % de grasa.

**Asistente.** Responde preguntas concretas («¿cuántas calorías me faltan?», «¿qué peso uso hoy en press de banca?») con
reglas locales sobre los datos del usuario y muestra qué datos usó. Un modelo de lenguaje sería opcional y posterior (ver decisiones).

## 5. Alimentos e integraciones

| Fuente | Estado verificado | Uso propuesto |
|---|---|---|
| USDA FoodData Central | API gratuita con clave de data.gov; 1.000 solicitudes/hora por IP; datos de dominio público (CC0) | Búsqueda desde una función Edge (la clave queda en el servidor) con caché en `food_reference` |
| ICBF – Tabla de Composición de Alimentos Colombianos (TCAC 2018, 773 alimentos) | Consultable en el portal del ICBF; **no encontré API ni descarga en datos abiertos** | Subconjunto curado de alimentos colombianos frecuentes (arepa, panela, plátano, fríjol…), citando la fuente, tras verificar las condiciones de reutilización |
| Registro en lenguaje natural | — | Analizador local en español: números en palabras, unidades caseras (vaso, taza, cucharada, unidad), tamaños, coincidencia con el catálogo; las cantidades no dichas se marcan como **estimadas** y se confirman antes de guardar |

## 6. Referencias verificadas en esta fase

| Tema | Fuente | Enlace |
|---|---|---|
| Metabolismo basal | Mifflin MD, St Jeor ST et al. *Am J Clin Nutr* 1990;51(2):241-7 (PMID 2305711) | https://pubmed.ncbi.nlm.nih.gov/2305711/ |
| Proteína | Jäger R et al. ISSN Position Stand: Protein and exercise. *JISSN* 2017;14:20 (PMID 28642676) | https://pubmed.ncbi.nlm.nih.gov/28642676/ |
| Proteína (umbral 1,6 g/kg) | Morton RW et al. *Br J Sports Med* 2018;52(6):376-384 (PMID 28698222) | https://pubmed.ncbi.nlm.nih.gov/28698222/ |
| Nutrición deportiva (carbohidratos, energía) | Thomas DT, Erdman KA, Burke LM. AND/DC/ACSM: Nutrition and Athletic Performance, 2016 (PMID 26917108) | https://pubmed.ncbi.nlm.nih.gov/26917108/ |
| Composición de alimentos | USDA FoodData Central, API Guide | https://fdc.nal.usda.gov/api-guide |
| Alimentos colombianos | ICBF, Tabla de Composición de Alimentos Colombianos | https://www.icbf.gov.co/bienestar/nutricion/tabla-alimentos |

Las que se citan en el plan pero **todavía no se han verificado** (se verificarán antes de usarlas en código):
- Volumen e hipertrofia: Pelland 2024 y Schoenfeld 2017.
- RIR/RPE: Zourdos 2016.
- PAL: FAO/OMS/UNU 2004.
- Rangos de grasa (AMDR) y fibra: IOM/DGA.
- Agua: EFSA.
- Sueño: consenso AASM/SRS 2015.
- Ritmo de pérdida en culturistas: Helms 2014.

## 7. Plan por fases (criterios de aceptación)

| Fase | Entrega | Aceptación |
|---|---|---|
| **B. Evaluación y personalización** | Migración de perfil/objetivos/seguridad/targets · asistente de evaluación por pasos · motor de cálculo puro · pantalla «Tus objetivos» con explicación | Tests de ecuaciones con casos publicados; menores/embarazo sin déficit; datos opcionales vacíos no bloquean; RLS probado con 2 usuarios; editable y borrable |
| **C. Panel nutricional** | Círculos de kcal y macros, fibra, agua, comparación semanal | Valores exactos al registrar; exceso visible (>100 %) sin deformar el círculo |
| **D. Alimentos** | Catálogo, registro manual, texto natural con confirmación, proxy USDA con caché | Cada registro guarda fuente, fecha y marca de estimación; búsqueda sin exponer la clave |
| **E. Progresión** | RIR/descanso en series, objetivos por ejercicio, recomendación antes y después de cada sesión | Casos de prueba: completar rango → subir; fallar → no subir; usuario confirma |
| **F. Recuperación** | Registro diario, análisis por músculo, descansos reales | Sin «recuperado 100 %»; tendencias con datos mínimos |
| **G. Recomendaciones** | Motor con observación → datos → conclusión → acción → confianza | Ninguna recomendación sin datos que la respalden; trazabilidad visible |
| **H. Historial y proyecciones** | 7 días a 12 meses con incertidumbre | «Sin base estadística» cuando falten datos |
| **I. Validación** | Pruebas completas, asesores de Supabase, rendimiento, móvil | Todos los criterios anteriores verificados con cuenta real |

## 8. Riesgos

- **Precisión de las estimaciones:** ecuaciones con error individual; se mitiga con rangos, revisión por tendencia y ajuste manual.
- **Datos sensibles de salud:** opcionales, mínimos, con RLS; se explica para qué se piden.
- **Responsabilidad:** no diagnosticar ni prescribir; «modo prudente» y derivación profesional.
- **Calidad de datos de alimentos:** USDA es de EE. UU.; los alimentos colombianos requieren curación y verificar la licencia del ICBF.
- **Alcance:** es un producto grande; fases pequeñas, probadas y publicadas solo con aprobación.
- **Pendiente previo:** validar Gym 1.1 con cuenta real antes de construir encima.
