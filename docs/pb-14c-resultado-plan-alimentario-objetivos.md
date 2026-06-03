# PB-14C — Resultado: plan alimentario y objetivos semanales

Microciclo: **PB-14C**.
Base: PB-14A (contrato), PB-14B (mediciones ampliadas, default).

## 1. Objetivo

Implementar la primera **capa de Plan** profesional: que la
profesional cargue un plan alimentario (objetivo + notas + guías
por comida) y objetivos semanales, y que el paciente los **lea**.
Sin adherencia de contenido, calorías, macros ni IA.

## 2. Modelos creados

Cuatro modelos nuevos, todos con relación a `User`
(paciente/profesional) o a su plan contenedor. Reutilizan el enum
existente `ScheduleStatus` (se usa `ACTIVE`/`ARCHIVED`; `PAUSED`
no aplica) y el enum `MealSlot`. **No se creó ningún enum nuevo.**

- **`NutritionPlan`** — `patientId`, `psychologistId`, `title`,
  `goal?`, `generalNotes?`, `startsAt` (default now), `endsAt?`,
  `status` (default ACTIVE), timestamps. Relación 1-N con
  `MealGuideline`.
- **`MealGuideline`** — `nutritionPlanId`, `mealSlot`, `title?`,
  `description`, `exampleMenu?`, `order`, timestamps.
- **`GoalPlan`** — `patientId`, `psychologistId`, `title`,
  `startsAt`, `status`, timestamps. Relación 1-N con
  `WeeklyGoal`.
- **`WeeklyGoal`** — `goalPlanId`, `weekNumber`, `what`, `why?`,
  `how?`, `comments?`, `status`, timestamps.

Relaciones agregadas en `User`: `nutritionPlansAsPatient/Psych`,
`goalPlansAsPatient/Psych`.

> **Desviación menor del spec (documentada)**: el spec listaba
> `what`/`why`/`how` sin "nullable" (solo `comments` nullable).
> Para no forzar 3 campos a la profesional, `what` queda
> **requerido** (núcleo del objetivo) y `why`/`how`/`comments`
> quedan **nullable**. Consistente con PB-14A §6 ("texto libre").

## 3. Migración creada

`prisma/migrations/20260601180000_pb14c_plan_alimentario_objetivos/migration.sql`:

- 4 `CREATE TABLE` (NutritionPlan, MealGuideline, GoalPlan,
  WeeklyGoal).
- 6 índices (`patientId/status`, `psychologistId/status` en los
  dos planes; FK indexes de hijos).
- 6 FKs: planes → `User` (paciente `ON DELETE CASCADE`,
  profesional `ON DELETE RESTRICT`); `MealGuideline → NutritionPlan`
  y `WeeklyGoal → GoalPlan` (`ON DELETE CASCADE`).

**Aditiva y no destructiva**: solo crea tablas/índices/FKs. No
toca tablas existentes, ni `TimelineEntry`, ni enums previos.
**No ejecutada contra ninguna DB real.** Se aplicará en el
próximo deploy autorizado vía `prisma migrate deploy` del `start`
script.

## 4. Rutas creadas / modificadas

**Creadas**
- `POST /api/psychologist/patients/[patientId]/plan` — endpoint
  único con discriminador `action` (`nutrition-plan` / `guideline`
  / `goal-plan` / `weekly-goal`), mismo patrón que
  `/api/patient/entries`. Auth `requireRole("PSYCHOLOGIST")` +
  check paciente propio. Cada acción hace upsert del plan/guía/
  objetivo activo (un plan activo por dominio; una guía por slot;
  un objetivo por semana).
- `/psychologist/patients/[patientId]/plan` — página profesional
  (server) + `plan-editor.tsx` (client) para ver y editar.
- `/patient/plan` — página paciente (server, **solo lectura**).

**Modificadas**
- `/psychologist/patients/[patientId]/timeline` — link "Plan" en
  el header.
- `/patient/layout.tsx` — link "Plan" en el nav.
- `/patient/today` — card informativa "Tu plan" (solo si hay
  `NutritionPlan` activo) con link a `/patient/plan`. Una query
  `count` extra en el `Promise.all` existente.

## 5. Qué puede hacer la profesional

Desde `/psychologist/patients/[patientId]/plan`:
- Crear/editar el plan alimentario activo: título, objetivo,
  notas generales (texto libre: recomendaciones, suplementos,
  hoja de ruta).
- Cargar/actualizar guías por comida (Desayuno / Almuerzo /
  Merienda / Cena): título opcional, descripción, menú
  orientativo opcional. Una guía por slot (se actualiza si ya
  existe).
- Crear/editar el plan de objetivos activo (título).
- Cargar/actualizar objetivos por semana: número de semana,
  qué quiero lograr, para qué, cómo, comentarios. Un objetivo
  por semana (se actualiza si ya existe).

## 6. Qué ve el paciente

Desde `/patient/plan` (solo lectura):
- Título + objetivo + notas generales del plan alimentario.
- Guías por comida ordenadas (slot + título + descripción +
  menú).
- Objetivos semanales (semana + qué/para qué/cómo/comentarios).
- Estado vacío claro si no hay plan.
- En `/patient/today`: card "Tu plan" con link, solo si hay plan
  activo. El paciente **no edita** nada.

## 7. Qué quedó fuera de alcance

- **Adherencia de contenido / calorías / macros / IA**: fuera
  por diseño (PB-14A).
- **`TrainingPlan` / rutina** (PB-14D): no incluido.
- **`SupplementPlan` estructurado**: queda como texto en
  `generalNotes` (PB-14A §12).
- **Borrado/archivado desde UI**: el modelo soporta `ARCHIVED`,
  pero no se expuso botón de archivar planes. El upsert siempre
  opera sobre el plan ACTIVE. Versionado (Mes 1 / Mes 2) queda
  para un microciclo futuro.
- **Borrado de una guía o de un objetivo**: no hay botón de
  borrar individual; se actualiza el contenido. Eliminar queda
  pendiente.
- **`DailyChecklist` (agua, ayuno, visualización)**: postergado
  (PB-14A §8).
- Railway, Cloudflare, deploy, DB real, seed, storage, auth,
  passwords, usuarios: sin tocar.

## 8. Validaciones

- `npx prisma validate` — `schema is valid 🚀`.
- `npx prisma generate` — cliente regenerado con los 4 modelos.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK. Rutas nuevas presentes:
  - `/api/psychologist/patients/[patientId]/plan`
  - `/psychologist/patients/[patientId]/plan`
  - `/patient/plan`
- Tests: no hay suite configurada.

**No ejecutado** (alcance prohibido): `migrate deploy` /
`migrate reset` / `db seed` / `db:demo-reset` contra cualquier
DB; nada contra Railway.

## 9. Riesgos

1. **Migración no aplicada en Railway todavía**: las tablas
   nuevas no existen en beta hasta el próximo deploy. Las páginas
   `/patient/plan` y `/psychologist/.../plan` fallarían si se
   abren contra una DB sin migrar. Mitigación: deploy aplica la
   migración antes de servir (`start` script).
2. **Un solo plan activo por dominio**: el upsert pisa el plan
   ACTIVE. Si la profesional quiere conservar historial de planes
   (Mes 1 → Mes 2), falta UI de archivar/crear nuevo. Hoy
   sobrescribe. Documentado como pendiente.
3. **Sin borrado de guías/objetivos**: solo actualización. Una
   guía cargada por error queda hasta que se sobrescriba su slot.
   Riesgo bajo.
4. **Endpoint con `action` discriminado**: si crece el número de
   acciones, conviene partir en rutas. Hoy 4 acciones es
   manejable y consistente con `/api/patient/entries`.
5. **Texto largo**: `generalNotes`/`description`/`exampleMenu`
   topados a 2000 chars; `what`/`why`/`how`/`comments` a 500.
   Suficiente para el material de Laura; ajustable si hiciera
   falta.
6. **No se cargó contenido real de Ariel**: el repo no incluye
   datos clínicos; la carga la hace la profesional en la app.

## 10. Próximo paso recomendado

- **Deploy de PB-14B + PB-14C** a Railway (acción del operador,
  con autorización), para que mediciones ampliadas y plan queden
  live. La migración corre sola en el `start`.
- **PB-14D — `TrainingPlan / TrainingDay / ExercisePrescription`**:
  rutina estructurada visible para el paciente, según PB-14A §11.
- **Versionado de planes** (archivar plan activo + crear nuevo)
  y **borrado de guías/objetivos**: microciclo chico de UX
  cuando la profesional lo pida.

Reglas heredadas vigentes: Plan ≠ Registro ≠ Adherencia; modelo
propio por dominio; no extender `TimelineEntry`; migraciones
aditivas; sin IA ni cálculo calórico; el paciente lee, no edita
el plan.
