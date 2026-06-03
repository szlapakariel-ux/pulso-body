# PB-14A — Contrato documental de datos nutricionales, mediciones, objetivos y rutina

Microciclo: **PB-14A** (documental, sin código).
Base: beta privada cerrada (PB-13D/E), material real aportado por
Laura (nutricionista) vía Ariel.

> Documento de **contrato conceptual**. No toca Prisma, ni DB, ni
> código. Traduce el material clínico real en un mapa de datos
> futuros, separando qué se modela, qué se posterga y qué se
> descarta, **antes** de cualquier migración.

---

## 1. Resumen ejecutivo

Pulso Body hoy modela tres dominios de **registro** del paciente
(comida con foto, mediciones, ejercicio) + un dominio de
**programación** mínima (`MealSchedule`) con adherencia derivada.

El material de Laura introduce un nivel superior que la app aún
no tiene: el **plan profesional estructurado** — objetivos
semanales, plan alimentario con hoja de ruta diaria, plan de
medidas con condiciones de toma, y rutina de entrenamiento con
prescripción de series/reps. Es decir: hoy la app captura "lo que
el paciente hizo"; falta capturar "lo que la profesional
prescribió" más allá de los horarios de comida.

La brecha principal: **no existe la noción de Plan** (alimentario,
de objetivos, de entrenamiento). Todo lo prescriptivo vive hoy en
PDFs fuera de la app. El contrato propone una familia de
entidades `*Plan` / `*Prescription` paralela a las `*Entry`
existentes, manteniendo la regla heredada (PB-8A): **modelo
propio por dominio, nunca extender `TimelineEntry`**.

**Dictamen**: A) Contrato documental apto para diseñar PB-14B.

---

## 2. Material fuente analizado

Aportado por Ariel, producido por Laura. **No se commitea** al
repo (datos clínicos personales). Se analiza su **estructura**,
no su contenido individual:

1. **OBJETIVOS.pdf** — objetivos por semanas 1–4. Cada objetivo
   con: *Qué quiero lograr · Para qué · Cómo · Comentarios*.
2. **Ariel Szlapak Mes 1.pdf** — plan alimentario: nombre, fecha,
   objetivo (recomposición corporal), peso inicial, % grasa
   corporal, hoja de ruta diaria (agua 2 L, ejercicio 30–45 min,
   visualización, desayuno con proteína, almuerzo estructurado,
   merienda saciante, cena liviana, ayuno nocturno), grupos
   alimentarios, cantidades, menú orientativo, recomendaciones,
   suplementos.
3. **Ariel Szlapak Rutina 1.pdf** — rutina 3 días/semana
   (Día 1: pecho/hombros/tríceps; Día 2: piernas/abdominales/
   relajación; Día 3: espalda/bíceps/abdominales), con series,
   repeticiones, duración en segundos, entrada en calor, cardio
   suave al final.
4. **Medidas.pdf** — instructivo de medidas corporales: cuello,
   pecho, cintura, cadera, muslo, brazo, altura, peso; condición
   de medición (mañana, en ayunas, después de ir al baño).
5. **Capturas de la app / uso real** — evidencia de uso, sin
   dato estructural nuevo.

> Ningún dato personal (valores, fechas, contenidos individuales)
> se transcribe en este documento.

---

## 3. Entidades actuales de Pulso Body relevantes

Verificadas en `prisma/schema.prisma` (default `af2c936`):

**Registro (lo que el paciente hizo)**
- `TimelineEntry` con `entryKind = MEAL` + `mealSlot` + foto
  (comida registrada).
- `MeasurementEntry`: `type` (`WEIGHT/WAIST/HIP/CHEST/ARM/
  PROGRESS_PHOTO/CUSTOM`) + `value` + `unit` + `note` + foto +
  `recordedAt`.
- `ExerciseEntry`: `type` (`WALK/RUN/BIKE/STRENGTH/MOBILITY/
  SPORT/CUSTOM`) + `durationMinutes` + `intensity` + `note` +
  foto + `recordedAt`.

**Programación (lo prescripto, mínimo)**
- `MealSchedule`: `mealSlot` + `targetTime "HH:mm"` +
  `daysOfWeek Int[]` + `status` + ventana opcional + `note`.

**Adherencia**
- Derivada en runtime (`resolveMealAdherence`), no persistida.
  Solo para comidas.

**Lo que NO existe hoy**
- Ningún `*Plan` (alimentario, objetivos, entrenamiento).
- Ninguna prescripción de ejercicio (series/reps).
- Ningún checklist diario de hábitos (agua, ayuno, visualización).
- Ningún plan/registro de suplementos.
- Medidas: faltan `NECK`, `THIGH`, `HEIGHT`, `BODY_FAT`.

---

## 4. Brecha entre app actual y material de Laura

| Dominio del material | ¿Existe en la app? | Brecha |
|----------------------|--------------------|--------|
| Objetivos semanales 1–4 | No | Falta familia `GoalPlan/WeeklyGoal/GoalCheckIn`. |
| Plan alimentario (encabezado: nombre, fecha, objetivo, peso/% grasa iniciales) | No | Falta `NutritionPlan` como contenedor. |
| Hoja de ruta diaria (agua, ejercicio, visualización, ayuno) | No | Falta `DailyChecklist` / hábitos no atados a slot de comida. |
| Estructura de comidas (desayuno proteico, almuerzo, merienda, cena) | Parcial | Hay `MealSchedule` por horario, pero no guía de contenido (grupos, cantidades, menú). |
| Grupos alimentarios + cantidades + menú orientativo | No | Falta `MealGuideline` / `FoodGroupTarget`. |
| Suplementos | No | Falta `SupplementPlan`. |
| Medidas corporales (cuello, muslo, altura, % grasa) | Parcial | `MeasurementType` no tiene `NECK/THIGH/HEIGHT/BODY_FAT`. |
| Condición de medición (ayunas, mañana, post-baño) | No | Falta campo de "protocolo de medición". |
| Rutina (3 días, grupos musculares) | No | Falta `TrainingPlan/TrainingDay`. |
| Prescripción de ejercicio (series, reps, segundos) | No | Falta `ExercisePrescription`. |
| Registro contra prescripción (completó la rutina) | No | Falta `ExerciseCompletion` / vínculo `ExerciseEntry → prescription`. |

Conclusión: la app tiene la **capa de registro** madura y la
**capa de programación** apenas iniciada (solo comidas por
horario). El material de Laura es, casi en su totalidad, **capa
de plan**.

---

## 5. Contrato conceptual de datos

Principios rectores (heredados + nuevos):

1. **Plan ≠ Registro ≠ Adherencia.** Tres capas separadas:
   - **Plan** (`*Plan`): lo que la profesional prescribe. Escribe
     la profesional, lee el paciente.
   - **Registro** (`*Entry`): lo que el paciente hizo. Ya existe.
   - **Adherencia**: cruce derivado plan↔registro. Hoy solo
     comidas; se extenderá.
2. **Modelo propio por dominio.** No extender `TimelineEntry` ni
   los `*Entry` con campos de plan. Tabla nueva cuando el dominio
   lo amerita (regla PB-8A).
3. **Texto libre donde la estructura no aporta.** El "menú
   orientativo" y las "recomendaciones" de Laura son prosa
   clínica: se guardan como texto, no como filas estructuradas.
4. **Un plan vigente por paciente y dominio**, con versionado por
   fechas (`startsAt/endsAt` + `status`), igual patrón que
   `MealSchedule`.
5. **`HEIGHT` y datos casi-estáticos** no son una medición
   periódica: van al perfil del paciente o a un campo del plan,
   no a `MeasurementEntry` recurrente.
6. **Adherencia descriptiva, nunca prescriptiva ni juicio
   clínico** (regla PB-11B-C). Ningún cálculo de calorías, IA
   nutricional ni recomendación automática.

---

## 6. Objetivos semanales

**Material**: 4 semanas, cada objetivo con *Qué / Para qué / Cómo
/ Comentarios*.

**Modelo conceptual propuesto** (futuro):

- `GoalPlan` — contenedor: `patientId`, `psychologistId`,
  `title`, `startsAt`, `status`.
- `WeeklyGoal` — `goalPlanId`, `weekNumber` (1–4+), `what`
  (qué lograr), `why` (para qué), `how` (cómo), `comments`,
  `status`.
- `GoalCheckIn` (opcional, más adelante) — registro del paciente
  marcando avance sobre un `WeeklyGoal`: `weeklyGoalId`,
  `recordedAt`, `note`, `achieved Boolean?`.

**Decisión**: los 4 campos del objetivo son **texto libre**
(prosa clínica). La estructura útil es `weekNumber` + `status`
para poder mostrar "objetivos de esta semana" en `Hoy`.

**Capa**: Plan (escribe profesional). `GoalCheckIn` es registro
(escribe paciente) — se posterga.

---

## 7. Plan alimentario

**Material**: encabezado (nombre, fecha, objetivo: recomposición,
peso inicial, % grasa) + grupos alimentarios + cantidades + menú
orientativo + recomendaciones + suplementos.

**Modelo conceptual propuesto** (futuro):

- `NutritionPlan` — contenedor maestro: `patientId`,
  `psychologistId`, `name`, `goal` (texto, ej. "recomposición
  corporal"), `startDate`, `initialWeightKg Float?`,
  `initialBodyFatPct Float?`, `generalNotes` (texto:
  recomendaciones), `status`, ventana de vigencia.
- `MealGuideline` — guía de contenido por slot, paralela a
  `MealSchedule` (que es solo horario): `nutritionPlanId`,
  `mealSlot`, `description` (texto: "desayuno con proteína…"),
  `foodGroups` (texto o relación a `FoodGroupTarget`),
  `exampleMenu` (texto: menú orientativo).
- `FoodGroupTarget` (opcional, postergable) — si se quiere
  estructurar cantidades: `mealGuidelineId`, `group`
  (proteína/verdura/carbohidrato…), `portion` (texto o número +
  unidad).

**Decisión**:
- `NutritionPlan` y `MealGuideline` **estructurados** (necesarios
  para que el paciente vea "qué debería tener cada comida").
- `FoodGroupTarget` / cantidades exactas: **texto libre** dentro
  de `MealGuideline.description` por ahora. Estructurar cantidades
  es un dominio nutricional grande (porciones, equivalencias) que
  no conviene modelar sin validación de la profesional.
- `peso inicial` y `% grasa inicial`: atributos del
  `NutritionPlan` (snapshot del arranque), **no** mediciones
  recurrentes.

**Capa**: Plan.

---

## 8. Hoja de ruta diaria

**Material**: agua 2 L, ejercicio 30–45 min, visualización,
desayuno proteico, almuerzo, merienda, cena, ayuno nocturno.

Estos son **hábitos diarios** heterogéneos: algunos son comidas
(ya cubiertos por `MealSchedule`), otros son métricas (agua),
otros son prácticas (visualización), otro es una ventana
(ayuno nocturno).

**Modelo conceptual propuesto** (futuro):

- `DailyChecklistItem` — `nutritionPlanId` (o `patientId`
  directo), `kind` enum (`WATER / EXERCISE / VISUALIZATION /
  FASTING / CUSTOM`), `label`, `targetValue` (texto o número:
  "2 L", "30–45 min"), `daysOfWeek`, `status`.
- El registro del cumplimiento diario sería un
  `DailyChecklistCheck` (paciente marca hecho/no hecho) — se
  posterga.

**Decisión**:
- El **agua** y el **ayuno nocturno** son los candidatos más
  claros a registro estructurado (agua: número acumulable;
  ayuno: ventana horaria). Pero modelarlos bien (agua acumulable
  durante el día, ayuno como rango) es un mini-dominio cada uno.
- **PB-14A no los modela.** Se documentan como `DailyChecklistItem`
  conceptual; la implementación se evalúa recién en PB-14C+, y
  el "agua" probablemente merezca su propio microciclo.
- "Ejercicio 30–45 min" ya tiene registro vía `ExerciseEntry`;
  lo que falta es la **prescripción** (ver §11).

**Capa**: mezcla de Plan (el ítem) + Registro (el check). Ambos
postergados.

---

## 9. Comidas y adherencia

**Estado**: `MealSchedule` (horario) + `resolveMealAdherence`
(derivada) ya cubren "esperabas comer a tal hora, ¿lo hiciste?".

**Brecha del material**: Laura no solo prescribe horarios, sino
**contenido** (grupos, cantidades, menú). Eso es `MealGuideline`
(§7), no adherencia.

**Decisión sobre adherencia**:
- La adherencia seguirá siendo **temporal** (registró el slot sí/
  no, a horario/tarde) — no se intenta medir "adherencia de
  contenido" (¿comió proteína?), porque eso requeriría que el
  paciente clasifique su comida o IA de imagen, ambos fuera de
  alcance y de la filosofía del producto.
- `MealGuideline` aparece como **guía visible** junto al slot en
  `Hoy` ("Desayuno · sugerido: proteína + fruta"), pero **no**
  entra al cómputo de adherencia.

---

## 10. Mediciones corporales

**Material (Medidas.pdf)**: cuello, pecho, cintura, cadera,
muslo, brazo, altura, peso + condición (mañana, ayunas,
post-baño). El plan alimentario además menciona **% grasa
corporal**.

**Comparación con `MeasurementType` actual**
(`WEIGHT/WAIST/HIP/CHEST/ARM/PROGRESS_PHOTO/CUSTOM`):

| Medida del material | En enum hoy | Acción |
|---------------------|-------------|--------|
| Peso | `WEIGHT` ✓ | — |
| Cintura | `WAIST` ✓ | — |
| Cadera | `HIP` ✓ | — |
| Pecho | `CHEST` ✓ | — |
| Brazo | `ARM` ✓ | — |
| Cuello | ✗ | agregar `NECK` |
| Muslo | ✗ | agregar `THIGH` |
| Altura | ✗ | **no** como medición recurrente — ver abajo |
| % grasa corporal | ✗ | agregar `BODY_FAT` (unit `%`) |
| Foto progreso | `PROGRESS_PHOTO` ✓ | — |

**Decisiones**:
- **`NECK`, `THIGH`, `BODY_FAT`**: candidatos a agregar al enum
  `MeasurementType` en PB-14B. Migración aditiva de enum (igual
  patrón que PB-4 agregó `PHOTO`). No destructiva.
- **`HEIGHT`**: la altura es **casi estática**. No es una medición
  periódica de seguimiento. Va a un campo de perfil
  (`PatientProfile.heightCm Float?`) o como atributo del
  `NutritionPlan`, no como `MeasurementEntry` recurrente.
  Decisión final entre las dos opciones: PB-14B.
- **Condición de medición** (mañana/ayunas/post-baño): es un
  **protocolo**, no un dato variable por registro. Opciones:
  (a) texto fijo en la guía/`MeasurementGuideline`,
  (b) campo `condition` opcional en `MeasurementEntry`.
  Recomendación: **(a)** — el protocolo es del plan, no del
  registro individual; el paciente lo lee una vez. Si se quiere
  trazar "esta medición fue en ayunas", se evalúa `condition`
  enum opcional en PB-14C.

**Capa**: Registro (ya existe) + ampliación de enum (PB-14B).

---

## 11. Entrenamiento / rutina

**Material (Rutina 1.pdf)**: 3 días/semana, grupos musculares por
día, series, repeticiones, duración (segundos), entrada en calor,
cardio suave final.

**Estado**: `ExerciseEntry` registra actividad **suelta**
(`WALK/RUN/STRENGTH/…` + duración + intensidad). No hay
prescripción ni estructura de rutina.

**Modelo conceptual propuesto** (futuro):

- `TrainingPlan` — `patientId`, `psychologistId`, `name`,
  `daysPerWeek`, `startsAt`, `status`, `notes` (entrada en calor,
  cardio final como texto).
- `TrainingDay` — `trainingPlanId`, `dayNumber` (1–3),
  `label` (ej. "Pecho, hombros, tríceps"), `order`.
- `ExercisePrescription` — `trainingDayId`, `name`
  (ej. "press banca"), `sets Int?`, `reps Int?`,
  `durationSeconds Int?`, `order`, `notes`.
- `ExerciseCompletion` (postergable) — registro del paciente
  marcando una prescripción como hecha: `exercisePrescriptionId`,
  `recordedAt`, `setsDone?`, `note`. **O** vincular el
  `ExerciseEntry` existente a una `ExercisePrescription` opcional
  (`ExerciseEntry.prescriptionId String?`).

**Decisiones**:
- `TrainingPlan / TrainingDay / ExercisePrescription`
  **estructurados** (el paciente necesita ver "hoy toca Día 1:
  press banca 3×12"). Son el corazón del dominio rutina.
- "Entrada en calor" y "cardio suave final": **texto libre** en
  `TrainingDay.notes` o `TrainingPlan.notes`. No vale estructurar.
- `ExerciseCompletion` vs `ExerciseEntry.prescriptionId`:
  decisión técnica para PB-14B/C. Preferencia inicial:
  **no tocar `ExerciseEntry`** todavía; el "completó la rutina"
  puede ser derivado (hubo `ExerciseEntry STRENGTH` ese día) o
  un modelo nuevo. Igual criterio que adherencia de comidas.

**Capa**: Plan (prescripción) + Registro (completion, postergado).

---

## 12. Suplementos

**Material**: el plan lista suplementos.

**Modelo conceptual propuesto** (futuro):

- `SupplementPlan` — `nutritionPlanId` (o `patientId`), `name`,
  `dose` (texto), `schedule` (texto o `targetTime` + `daysOfWeek`),
  `notes`, `status`.
- Registro de toma (`SupplementIntake`): postergado.

**Decisión**: **postergar entero**. Los suplementos son una lista
corta y estable; en el corto plazo pueden vivir como **texto** en
`NutritionPlan.generalNotes` (sección "Suplementos"). Estructurar
+ recordar tomas es un dominio con su propia complejidad
(adherencia de suplementos, horarios) que no entra en la primera
ola.

**Capa**: Plan (hoy texto, estructura postergada).

---

## 13. Qué entra en PB-14B

Criterio: **lo de mayor valor, menor riesgo y menor superficie de
migración**. Propuesta para PB-14B (implementación):

1. **Ampliar `MeasurementType`** con `NECK`, `THIGH`, `BODY_FAT`
   (`BODY_FAT` con `unit = "%"`). Migración aditiva de enum +
   labels en `src/lib/measurements.ts` + opción en
   `/patient/measurements/new`. Bajo riesgo, alto valor inmediato
   (Ariel ya tiene esas medidas en papel).
2. **`HEIGHT` como dato de perfil**: agregar `heightCm Float?` a
   `PatientProfile` (o a un lugar equivalente) + UI mínima para
   cargarlo una vez. Decidir ubicación en PB-14B.
3. **Documentar** en el resultado de PB-14B qué quedó como texto
   y qué se estructuró.

Esto es una migración **chica y aditiva** (un enum + una columna
nullable), en línea con PB-4/PB-8B/PB-9.

**Lo que NO entra en PB-14B**: planes (`NutritionPlan`,
`GoalPlan`, `TrainingPlan`) — son la ola grande, requieren su
propio diseño (PB-14C).

---

## 14. Qué queda para PB-14C / PB-15

- **PB-14C — `NutritionPlan` + `MealGuideline` + objetivos**:
  contenedor de plan alimentario, guía por comida visible en
  `Hoy`, y `GoalPlan/WeeklyGoal`. Migración mediana. Primer plan
  prescriptivo real.
- **PB-14D — `TrainingPlan / TrainingDay / ExercisePrescription`**:
  rutina estructurada visible en `Hoy` ("hoy toca Día 1").
- **PB-15 — Registro de cumplimiento** (`GoalCheckIn`,
  `ExerciseCompletion`, checks de hábitos) + adherencia
  extendida a ejercicio prescripto y hábitos.
- **Hábitos diarios** (agua, ayuno, visualización): microciclo
  dedicado, probablemente el "agua" solo. Postergado.
- **Suplementos estructurados + adherencia**: postergado.

---

## 15. Qué se descarta por ahora

- **Cálculo de calorías / macros automáticos**: fuera de la
  filosofía del producto. No se modela.
- **IA de análisis de imagen de comida**: descartado.
- **"Adherencia de contenido"** (¿la comida tenía proteína?):
  descartado — requeriría clasificación manual o IA.
- **Cantidades/porciones estructuradas** (`FoodGroupTarget` con
  gramos/equivalencias): descartado en esta ola; queda como texto.
- **Equivalencias alimentarias / base de alimentos**: descartado.
  Es un producto en sí mismo.
- **Recordatorios push/WhatsApp/email** de comidas, suplementos o
  entrenamientos: fuera de alcance permanente del MVP actual.

---

## 16. Riesgos

1. **Explosión de modelos**: el material sugiere ~10 entidades
   nuevas. Modelarlas todas de golpe sería una migración enorme y
   riesgosa sobre una beta con datos reales. Mitigación: olas
   chicas y aditivas (PB-14B mide, PB-14C plan alimentario,
   PB-14D rutina).
2. **Sobre-estructurar prosa clínica**: forzar a filas lo que
   Laura escribe como texto (menú orientativo, recomendaciones)
   genera rigidez y mala UX para la profesional. Mitigación:
   regla "texto libre por defecto, estructura solo si alimenta
   `Hoy` o adherencia".
3. **`TimelineEntry` bajo presión**: tentación de colgar plan/
   prescripción de la tabla de registro. Mitigación: regla
   PB-8A vigente — modelo propio.
4. **Datos clínicos reales en beta**: cualquier modelo nuevo
   guarda datos personales de salud. Mitigación: mismo bucket
   privado + auth + sin exposición pública; política de borrado
   pendiente (riesgo heredado de PB-13E §13).
5. **Versionado de planes**: un paciente puede tener "Mes 1",
   "Mes 2"… Sin `status` + ventana de vigencia se acumulan planes
   activos solapados. Mitigación: replicar patrón `MealSchedule`
   (`status` + `startsAt/endsAt`) en todos los `*Plan`.
6. **`HEIGHT` mal ubicada**: si entra como `MeasurementEntry`
   recurrente, ensucia gráficos de evolución (la altura no
   cambia). Mitigación: dato de perfil, decidido en §10/§13.
7. **Migración de enum `MeasurementType`**: agregar valores a un
   enum Postgres es aditivo y seguro, pero requiere `ALTER TYPE`.
   Validar en PB-14B que la migración no bloquea (igual que PB-4
   con `PHOTO`).
8. **Adherencia extendida prematura**: medir cumplimiento de
   rutina/hábitos antes de tener bien el plan llevaría a métricas
   ruidosas. Mitigación: primero plan (PB-14C/D), después
   adherencia (PB-15).

---

## 17. Dictamen

**A) Contrato documental apto para diseñar PB-14B.**

El material de Laura está mapeado en su totalidad a entidades
conceptuales, con decisiones explícitas de qué se estructura, qué
queda como texto, qué capa (plan/registro/adherencia) ocupa cada
dato y en qué ola entra. La primera implementación (PB-14B) queda
acotada a una migración chica y aditiva (mediciones +
`HEIGHT`/`BODY_FAT`), de bajo riesgo sobre la beta con datos
reales.

---

## 18. Próximo paso recomendado

**PB-14B — Ampliación de mediciones corporales**:

1. Agregar `NECK`, `THIGH`, `BODY_FAT` a `MeasurementType`
   (migración aditiva de enum).
2. Resolver `HEIGHT` como dato de perfil (`PatientProfile.heightCm`)
   con UI mínima de carga única.
3. Labels + unidades por defecto en `src/lib/measurements.ts`
   (`NECK→cm`, `THIGH→cm`, `BODY_FAT→%`).
4. Opciones en `/patient/measurements/new`.
5. Documentar en `docs/pb-14b-resultado-mediciones-ampliadas.md`.

Reglas heredadas vigentes para toda la familia PB-14:
- Modelo propio por dominio (no extender `TimelineEntry` ni
  `*Entry`).
- Migraciones aditivas, no destructivas; no ejecutar contra la
  DB real de la beta sin el procedimiento de PB-13B.
- Texto libre por defecto; estructura solo si alimenta `Hoy` o
  adherencia.
- Adherencia descriptiva, nunca juicio clínico; sin calorías,
  sin IA prescriptiva.

Tras PB-14B, seguir con **PB-14C** (plan alimentario + objetivos)
y **PB-14D** (rutina) como olas separadas.
