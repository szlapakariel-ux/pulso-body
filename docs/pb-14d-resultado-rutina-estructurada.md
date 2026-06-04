# PB-14D — Resultado: rutina estructurada

Microciclo: **PB-14D**.
Base: PB-14A (contrato §11), PB-14C (capa de plan ya establecida).

## 1. Objetivo

Trasladar la rutina de entrenamiento de Laura a una **capa de Plan
estructurada**: la profesional carga la rutina (plan + días +
ejercicios prescriptos), el paciente la ve (solo lectura). Sin
cumplimiento/adherencia de rutina (eso es PB-15).

## 2. Modelos creados

Tres modelos nuevos, reutilizando el enum existente
`ScheduleStatus` (ACTIVE/ARCHIVED). **No se creó enum nuevo** y
**no se tocó `ExerciseEntry`** (registro suelto del paciente).

- **`TrainingPlan`** — `patientId`, `psychologistId`, `title`,
  `notes?`, `daysPerWeek?`, `startsAt` (default now), `endsAt?`,
  `status`, timestamps. 1-N con `TrainingDay`.
- **`TrainingDay`** — `trainingPlanId`, `dayNumber`, `title?`,
  `warmup?`, `cooldown?`, `notes?`, `order`, timestamps. 1-N con
  `ExercisePrescription`.
- **`ExercisePrescription`** — `trainingDayId`, `name`,
  `muscleGroup?`, `sets?`, `reps?`, `durationSeconds?`, `notes?`,
  `order`, timestamps.

Relaciones agregadas en `User`: `trainingPlansAsPatient/Psych`.

## 3. Migración creada

`prisma/migrations/20260601190000_pb14d_rutina_estructurada/migration.sql`:

- 3 `CREATE TABLE` (TrainingPlan, TrainingDay, ExercisePrescription).
- 4 índices (`patientId/status`, `psychologistId/status` en plan;
  FK indexes de hijos).
- 4 FKs: plan → `User` (paciente `ON DELETE CASCADE`, profesional
  `ON DELETE RESTRICT`); `TrainingDay → TrainingPlan` y
  `ExercisePrescription → TrainingDay` (`ON DELETE CASCADE`).

**Aditiva y no destructiva**: solo crea tablas/índices/FKs. No
toca tablas existentes, ni `TimelineEntry`, ni `ExerciseEntry`,
ni enums previos. **No ejecutada contra ninguna DB real.** Se
aplicará en el próximo deploy autorizado vía `prisma migrate
deploy` del `start` script.

## 4. Rutas creadas / modificadas

**Creadas**
- `POST /api/psychologist/patients/[patientId]/training` —
  endpoint único con discriminador `action`
  (`plan` / `day` / `exercise`), mismo patrón que PB-14C.
  Auth `requireRole("PSYCHOLOGIST")` + check paciente propio.
  - `plan`: upsert del `TrainingPlan` activo.
  - `day`: upsert del `TrainingDay` por `dayNumber` (requiere plan).
  - `exercise`: **append** de `ExercisePrescription` a un día
    (auto-incrementa `order`; requiere que el día exista).
- `/psychologist/patients/[patientId]/training` — página (server)
  + `training-editor.tsx` (client).
- `/patient/training` — página paciente (server, **solo lectura**).

**Modificadas**
- `/psychologist/patients/[patientId]/timeline` — link "Rutina"
  en el header.
- `/patient/layout.tsx` — link "Rutina" en el nav.
- `/patient/today` — card "Tu rutina" (solo si hay `TrainingPlan`
  activo) con link a `/patient/training`. Una query `count` extra
  en el `Promise.all` existente.

## 5. Qué puede hacer la profesional

Desde `/psychologist/patients/[patientId]/training`:
- Crear/editar el plan de entrenamiento activo: título, días por
  semana, notas generales.
- Cargar/actualizar días (Día 1/2/3…): título (ej. "Pecho,
  hombros, tríceps"), entrada en calor, cardio/cierre, notas.
  Un día por `dayNumber` (se actualiza si ya existe).
- Agregar ejercicios a un día: nombre, grupo muscular, series,
  reps, duración en segundos, notas. Se **agregan** en orden.

## 6. Qué ve el paciente

Desde `/patient/training` (solo lectura):
- Título de la rutina + días por semana + notas generales.
- Días de entrenamiento ordenados, con entrada en calor, lista de
  ejercicios (nombre, grupo, prescripción formateada `3×12`,
  duración, notas) y cierre.
- Estado vacío claro si no hay rutina.
- En `/patient/today`: card "Tu rutina" con link, solo si hay
  rutina activa. El paciente **no edita** nada.

## 7. Qué quedó fuera de alcance

- **Cumplimiento / adherencia de rutina**: fuera (PB-15). No se
  tocó `ExerciseEntry` ni la adherencia existente.
- **Edición/borrado de un ejercicio individual**: el endpoint
  `exercise` solo agrega. Corregir un ejercicio cargado mal
  requiere una UI de borrado que queda pendiente. Días y plan sí
  se actualizan (upsert).
- **Versionado de planes** (archivar + crear nuevo): el upsert
  pisa el plan ACTIVE. Pendiente.
- **Reordenar ejercicios/días desde UI**: el `order` se asigna
  automático; sin drag-and-drop.
- IA, recomendaciones automáticas, cálculo de cargas/volumen:
  fuera por diseño.
- Railway, Cloudflare, deploy, DB real, seed, storage, upload,
  fotos, comidas, mediciones, auth, passwords, usuarios: sin
  tocar.

## 8. Validaciones

- `npx prisma validate` — `schema is valid 🚀`.
- `npx prisma generate` — cliente regenerado con los 3 modelos.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK. Rutas nuevas presentes:
  - `/api/psychologist/patients/[patientId]/training`
  - `/psychologist/patients/[patientId]/training`
  - `/patient/training`
- Tests: no hay suite configurada.

**No ejecutado** (alcance prohibido): `migrate deploy` /
`migrate reset` / `db seed` / `db:demo-reset` contra cualquier
DB; nada contra Railway.

## 9. Riesgos

1. **Migración no aplicada en Railway todavía**: las tablas nuevas
   no existen en beta hasta el próximo deploy. `/patient/training`
   y `/psychologist/.../training` fallarían contra una DB sin
   migrar. Mitigación: el `start` aplica la migración antes de
   servir. **Acumulada junto con PB-14B y PB-14C**, todas pendientes
   de deploy.
2. **Sin borrado de ejercicios**: solo se agregan. Un ejercicio
   mal cargado queda hasta que haya UI de borrado. Riesgo bajo
   (la profesional puede re-crear el día… no: el upsert de día no
   borra ejercicios). Documentado como pendiente prioritario para
   un PB de UX.
3. **Un plan activo por dominio**: el upsert pisa el `TrainingPlan`
   ACTIVE. Historial de rutinas (mes 1 → mes 2) requiere
   archivar/crear, pendiente.
4. **Endpoint con `action`**: 3 acciones, manejable; consistente
   con PB-14C y `/api/patient/entries`.
5. **`ExerciseEntry` intacto**: el registro suelto del paciente y
   su adherencia no se tocaron. El cruce rutina↔registro (¿hizo lo
   prescripto?) es PB-15.

## 10. Próximo paso recomendado

- **Deploy de PB-14B + PB-14C + PB-14D** a Railway (acción del
  operador con autorización): las tres migraciones acumuladas
  corren juntas en el `start`.
- **PB-14E (UX) — borrado/edición de ejercicios y versionado de
  planes**: cubrir el gap de no poder borrar un ejercicio ni
  archivar un plan. Chico y de alto valor práctico.
- **PB-15 — Cumplimiento/adherencia**: cruzar `ExercisePrescription`
  con el registro del paciente (`ExerciseEntry` o un
  `ExerciseCompletion` nuevo), más checks de hábitos. Recién acá
  se mide "hizo la rutina".

Reglas heredadas vigentes: Plan ≠ Registro ≠ Adherencia; modelo
propio por dominio; no extender `TimelineEntry` ni `ExerciseEntry`;
migraciones aditivas; sin IA; el paciente lee, no edita.
