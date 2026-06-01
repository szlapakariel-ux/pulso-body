# PB-11B-B — Resultado: MealSchedule mínimo

Microciclo: **PB-11B-B**
Base: `docs/pb-11b-a-contrato-meal-schedule-adherencia.md`.
Referencias: PB-6, PB-10, PB-11A.

## Objetivo

Implementar el primer `*Schedule` real: **`MealSchedule`**. El
profesional configura comidas programadas y el paciente las ve
con estado de adherencia derivado en `/patient/today`. Sin tocar
`TimelineEntry`, `MeasurementEntry` ni `ExerciseEntry`.

---

## Decisión técnica aplicada

Se siguió el contrato de PB-11B-A:

- Modelo `MealSchedule` **dedicado** + enum `ScheduleStatus`.
- `targetTime` como **`String "HH:mm"`** (no `DateTime`).
- `daysOfWeek` como **`Int[]`** con convención 0=domingo … 6=sábado.
- Matching **derivado** por `mealSlot` + ventana horaria. No se
  agrega `mealScheduleId` a `TimelineEntry`.
- Tolerancia inicial: **60 min**, hard-coded en
  `src/lib/meal-adherence.ts` (`DEFAULT_TOLERANCE_MINUTES`).
- `/patient/today` consulta `MealSchedule` activo del día y, si no
  hay, **cae al array `MOCK_MEALS`** (5 slots clásicos) como
  fallback.

---

## Archivos modificados

- `prisma/schema.prisma` — enum `ScheduleStatus`, modelo
  `MealSchedule`, relaciones en `User`.
- `prisma/migrations/20260601160000_add_meal_schedule/migration.sql`
  — migración aditiva.
- `src/lib/meal-schedules.ts` — labels, helpers (`isValidTargetTime`,
  `targetTimeToMinutes`, `formatDaysOfWeek`, `normalizeDaysOfWeek`,
  `scheduleAppliesToday`, `slotToSlug`, estados de adherencia).
- `src/lib/meal-adherence.ts` — `resolveMealAdherence(...)` puro.
- `src/app/api/psychologist/patients/[patientId]/meal-schedules/route.ts`
  — `GET` + `POST`.
- `src/app/api/psychologist/patients/[patientId]/meal-schedules/[scheduleId]/route.ts`
  — `PATCH` (incluye toggle `ACTIVE`/`PAUSED`) + `DELETE` (soft archive).
- `src/app/psychologist/patients/[patientId]/meal-schedules/page.tsx`
  — listado + sección de creación.
- `src/app/psychologist/patients/[patientId]/meal-schedules/meal-schedule-form.tsx`
  — client component, form.
- `src/app/psychologist/patients/[patientId]/meal-schedules/row-actions.tsx`
  — client component, acciones Pausar/Reanudar/Archivar por fila.
- `src/app/psychologist/patients/[patientId]/timeline/page.tsx` —
  link "Configurar comidas" en el header.
- `src/app/patient/today/page.tsx` — reescrito para usar
  `MealSchedule` con fallback al mock.
- `docs/pb-11b-b-resultado-meal-schedule-minimo.md` — este doc.

**No se tocó** `TimelineEntry`, `MeasurementEntry`,
`ExerciseEntry`, `MealSlot`, `EntryKind`, endpoints existentes de
comidas/medidas/ejercicio, vistas `/today` y `/week`
profesionales.

---

## Modelo creado

```prisma
enum ScheduleStatus {
  ACTIVE
  PAUSED
  ARCHIVED
}

model MealSchedule {
  id             String         @id @default(cuid())
  patientId      String
  psychologistId String
  mealSlot       MealSlot
  label          String?
  targetTime     String          // "HH:mm" 24h
  daysOfWeek     Int[]           // 0..6
  status         ScheduleStatus @default(ACTIVE)
  startsAt       DateTime?
  endsAt         DateTime?
  note           String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  patient      User @relation("MealSchedulesAsPatient", fields: [patientId], references: [id], onDelete: Cascade)
  psychologist User @relation("MealSchedulesAsPsych",   fields: [psychologistId], references: [id])

  @@index([patientId, status])
  @@index([psychologistId, status])
}
```

Y en `User`:

```prisma
mealSchedulesAsPatient MealSchedule[] @relation("MealSchedulesAsPatient")
mealSchedulesAsPsych   MealSchedule[] @relation("MealSchedulesAsPsych")
```

---

## Migración creada

`prisma/migrations/20260601160000_add_meal_schedule/migration.sql`:

- `CREATE TYPE "ScheduleStatus"` (3 valores).
- `CREATE TABLE "MealSchedule"` con PK `id` y `daysOfWeek INTEGER[]`.
- 2 índices: `(patientId, status)`, `(psychologistId, status)`.
- 2 FKs: `patientId → User(id) ON DELETE CASCADE`,
  `psychologistId → User(id) ON DELETE RESTRICT`.

**No se ejecutó contra ninguna base real.** Estrictamente aditiva:
no toca `TimelineEntry`, `MeasurementEntry`, `ExerciseEntry`, ni
ninguna tabla existente.

---

## Endpoints creados

`/api/psychologist/patients/[patientId]/meal-schedules`

### `GET`

- Auth: `requireRole("PSYCHOLOGIST")` + `psychologistId === user.id`.
- Devuelve schedules ordenados por `targetTime asc`.
- Por defecto excluye `ARCHIVED`. Se incluyen con
  `?includeArchived=true`.

### `POST`

- Auth idem.
- Body (zod):
  ```ts
  {
    mealSlot: "BREAKFAST" | "SNACK_AM" | "LUNCH" | "SNACK_PM" | "DINNER" | "CUSTOM";
    label?: string;          // ≤ 60
    targetTime: string;      // regex HH:mm
    daysOfWeek: number[];    // 0..6, ≥ 1, deduplicado server-side
    startsAt?: string;       // ISO
    endsAt?: string;         // ISO
    note?: string;           // ≤ 500
  }
  ```
- `daysOfWeek` se normaliza (`normalizeDaysOfWeek`) y se rechaza
  vacío con 400.

`/api/psychologist/patients/[patientId]/meal-schedules/[scheduleId]`

### `PATCH`

- Auth idem + propiedad de `scheduleId` validada vía
  `patientId`/`psychologistId`.
- Campos editables: `label`, `targetTime`, `daysOfWeek`, `status`
  (`ACTIVE`/`PAUSED`/`ARCHIVED`), `startsAt`, `endsAt`, `note`.
- Devuelve `{ id }`.

### `DELETE`

- Soft archive: `status = ARCHIVED`. No hace hard delete.

---

## Vista profesional creada

`/psychologist/patients/[patientId]/meal-schedules`

- Server component: `requireRolePage("PSYCHOLOGIST")` + check
  paciente propio.
- Header: link `← Timeline`, nombre + email del paciente.
- **Agenda actual**: lista de schedules no archivados con
  - slot humano + `label` opcional + `targetTime`,
  - chips de días (helper `formatDaysOfWeek`),
  - badge de status (Activo / Pausado),
  - acciones por fila (Pausar/Reanudar + Archivar) en
    `row-actions.tsx`.
- **Agregar comida programada**: form en `meal-schedule-form.tsx`
  con selector de slot, etiqueta opcional, input `time` para
  `targetTime`, checkboxes de días (L-M-X-J-V-S-D), nota privada,
  botón Guardar. `daysOfWeek` arranca en `[1,2,3,4,5]`.

Link de entrada: "Configurar comidas" en el header del timeline
profesional.

---

## Cambios en `/patient/today`

Reescrito el flujo de meals; conservadas las secciones de
peso/medidas y ejercicio.

- Query paralelo: `mealsToday`, `schedules`,
  `measurementsTodayCount`, `exercisesTodayCount`.
- Filtro `scheduleAppliesToday`: `status=ACTIVE`, `daysOfWeek`
  incluye `Date.getDay()`, `startsAt <= now`, `endsAt >= now`.
- Si hay schedules aplicables → se construye un `MealItem` por
  cada uno con `resolveMealAdherence`. Título = `label` o
  `MEAL_SLOT_LABEL[slot]`. Hora = `targetTime`.
- Si **no** hay schedules aplicables → fallback al array
  `MOCK_MEALS` (5 slots) con estado derivado solo de "hay registro
  hoy o no".
- Estados de UI:
  - `PENDIENTE` → botón "Registrar con foto" (primary).
  - `REGISTRADO` / `REGISTRADO_TARDE` → "Ver en timeline".
  - `OMITIDO` → "Registrar igual" (ghost).
- Sin secciones nuevas: peso/medidas y ejercicio mantienen su
  comportamiento de PB-8C/PB-9.
- Copy del fallback: *"Todavía no tenés comidas programadas.
  Mostramos la agenda interna por defecto."*

---

## Fallback al mock

- Cuando no hay `MealSchedule` `ACTIVE` aplicable al día actual
  (incluye casos `PAUSED`/`ARCHIVED`/`daysOfWeek` que no contiene
  hoy/`startsAt-endsAt` fuera de rango), `/patient/today` usa
  `MOCK_MEALS` (5 slots tradicionales).
- En modo fallback **no se calcula** "OMITIDO" / "REGISTRADO_TARDE"
  — solo se marca registrado vs pendiente por slot.
- Es una **transición**: cuando todos los pacientes tengan
  schedules, se puede eliminar `MOCK_MEALS` en un microciclo
  futuro.

---

## Reglas de adherencia mínima

`src/lib/meal-adherence.ts` → `resolveMealAdherence(schedule, entriesToday, now, tolerance=60)`:

| Caso                                              | Estado             |
|---------------------------------------------------|--------------------|
| Hay entrada del slot dentro de `targetTime ± 60`  | `REGISTRADO`       |
| Hay entrada del slot fuera de la ventana          | `REGISTRADO_TARDE` |
| No hay entrada, `now ≤ targetTime + 60`           | `PENDIENTE`        |
| No hay entrada, `now > targetTime + 60`           | `OMITIDO`          |

`SIN_PROGRAMACION` no se devuelve porque `/patient/today` solo
itera schedules que ya pasaron `scheduleAppliesToday`. Queda como
estado disponible para vistas futuras que mezclen días con y sin
programación.

---

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀`.
- `npx prisma generate` — cliente regenerado con `mealSchedule`.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK. Nuevas rutas presentes:
  - `/api/psychologist/patients/[patientId]/meal-schedules`
  - `/api/psychologist/patients/[patientId]/meal-schedules/[scheduleId]`
  - `/psychologist/patients/[patientId]/meal-schedules`

No hay tests configurados en el repo.

---

## Fuera de alcance

- **`MeasurementSchedule`** y **`ExerciseSchedule`** — no.
- **`ClientPlan`** / **`Reminder`** — no.
- **Adherencia en vistas profesionales** (`/today`, `/week`) — no.
  Entra en PB-11B-C.
- **Adherencia en resúmenes semanales del paciente** — no.
- **`mealScheduleId` en `TimelineEntry`** — no (decisión PB-11B-A).
- **IA / recomendaciones / cálculo de calorías** — no.
- **Edición histórica con "schedule efectivo en fecha X"** — no.
- **Notificaciones / recordatorios push** — no.
- **Railway, secrets, `.env`, deploy, producción** — sin cambios.

---

## Riesgos detectados

- **Timezone del proceso Node** para "qué día es hoy" y "qué hora
  es ahora" al evaluar `targetTime`. Mismo límite heredado.
- **`Int[]` en Postgres**: primera columna array del proyecto.
  Prisma + Postgres lo manejan bien; documentado.
- **Schedules editados a posteriori**: cambian retroactivamente la
  interpretación del pasado. Mitigación documentada; queda como
  deuda para "fechas efectivas" futuras.
- **Duplicados de schedules**: dos schedules del mismo slot a la
  misma hora son posibles a nivel modelo. Validación cliente
  pendiente; no bloquea.
- **Múltiples registros del mismo slot el mismo día**: cuentan
  como un solo `REGISTRADO`; el detalle los muestra todos.
- **Adherencia como juicio clínico**: el copy es deliberadamente
  descriptivo ("Registrado tarde", "Omitido") — sin valoración.
- **Fallback al mock**: convive con la lógica nueva. Hay que
  recordar removerlo cuando todos los pacientes adopten schedules.
- **Endpoint del paciente para schedules**: no existe — el
  paciente **no toca** schedules, solo los ve aplicados en
  `/today`.

---

## Confirmación de alcance

- `TimelineEntry` **no modificado**.
- `MeasurementEntry`, `ExerciseEntry` **no modificados**.
- No se creó `MeasurementSchedule`, `ExerciseSchedule`,
  `ClientPlan` ni `Reminder`.
- No se tocó auth, Railway, secrets, `.env`, deploy ni producción.
- Migración no ejecutada contra base real.
- No se renombró ruta ni rol.

---

## Recomendación para PB-11B-C

Avanzar con **adherencia en vistas profesionales**:

1. `/psychologist/patients/[patientId]/today`: bloque
   "Adherencia de hoy" con conteo `registradas/esperadas` y chips
   por estado. Sin juicio, solo conteo.
2. `/psychologist/patients/[patientId]/week`: línea
   "Adherencia: X/Y" por día y total semanal opcional. Sin
   gráficos.
3. Reutilizar `resolveMealAdherence` con la misma tolerancia 60
   min. Si surge necesidad de personalizar, sumar
   `toleranceMinutes Int?` a `MealSchedule` en una migración
   futura.

Si el equipo prefiere consolidar el modelo antes, **PB-11B-D**
puede mover `startOfLocalDay`/`endOfLocalDay`/`dayKey` a
`src/lib/dates.ts` (hoy están duplicados en 5+ archivos).

La regla heredada de PB-8A/PB-11B-A sigue: schedules en **tabla
propia**, no extender `TimelineEntry` ni los `*Entry`.
