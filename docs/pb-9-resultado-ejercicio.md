# PB-9 — Resultado: registro mínimo de ejercicio

Microciclo: **PB-9**
Referencias: PB-3, PB-6, PB-7, PB-8A, PB-8B, PB-8C.

## Objetivo

Permitir al paciente registrar **actividad física** (caminata, correr,
bici, fuerza, movilidad, deporte, otro) con duración, intensidad,
nota y foto opcional; y al profesional ver un bloque resumen + un
historial dedicado. Sin tocar `TimelineEntry`.

---

## Decisión técnica aplicada

`ExerciseEntry` **dedicado**, análogo a `MeasurementEntry` (PB-8B).
Misma justificación que en PB-8A: el ejercicio no se reduce a "un
archivo subido"; tiene dimensiones numéricas (duración) y categóricas
(tipo, intensidad). Extender `TimelineEntry` exigiría hacer
`mediaType`/`mediaKey` nullables — descartado.

Migración estrictamente aditiva: 2 enums nuevos + 1 tabla nueva +
2 índices + 2 FKs. Cero ALTER sobre tablas existentes.

---

## Archivos modificados

- `prisma/schema.prisma` — enums `ExerciseType`, `ExerciseIntensity`;
  modelo `ExerciseEntry`; relaciones `exercisesAsPatient` /
  `exercisesAsPsych` en `User`.
- `prisma/migrations/20260601150000_add_exercise_entry/migration.sql`
  — migración nueva.
- `src/lib/exercises.ts` — helper (labels, slug→type, formateo de
  duración).
- `src/app/api/patient/exercises/route.ts` — endpoint `POST` con
  validación por tipo.
- `src/app/patient/exercises/page.tsx` — historial paciente.
- `src/app/patient/exercises/new/page.tsx` — vista creación.
- `src/app/patient/exercises/new/exercise-form.tsx` — form cliente.
- `src/app/psychologist/patients/[patientId]/exercises/page.tsx` —
  historial profesional.
- `src/app/psychologist/patients/[patientId]/timeline/page.tsx` —
  bloque "Ejercicio" con últimas 3 actividades.
- `src/app/patient/today/page.tsx` — query `count` de ejercicios
  del día + acciones por estado.
- `src/app/patient/layout.tsx` — link `Ejercicio` en nav.
- `docs/pb-9-resultado-ejercicio.md` — este documento.

**No se tocó** `TimelineEntry`, `MeasurementEntry`, comidas,
`/api/patient/entries`, `/api/patient/measurements`.

---

## Modelo creado

```prisma
enum ExerciseType {
  WALK
  RUN
  BIKE
  STRENGTH
  MOBILITY
  SPORT
  CUSTOM
}

enum ExerciseIntensity {
  LOW
  MEDIUM
  HIGH
  CUSTOM
}

model ExerciseEntry {
  id              String             @id @default(cuid())
  patientId       String
  psychologistId  String
  type            ExerciseType
  durationMinutes Int?
  intensity       ExerciseIntensity?
  note            String?
  mediaKey        String?
  mediaType       MediaType?
  recordedAt      DateTime
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  patient      User @relation("ExercisesAsPatient", fields: [patientId], references: [id], onDelete: Cascade)
  psychologist User @relation("ExercisesAsPsych",   fields: [psychologistId], references: [id])

  @@index([patientId, recordedAt])
  @@index([psychologistId, recordedAt])
}
```

Y en `User`:

```prisma
exercisesAsPatient ExerciseEntry[] @relation("ExercisesAsPatient")
exercisesAsPsych   ExerciseEntry[] @relation("ExercisesAsPsych")
```

---

## Migración creada

`prisma/migrations/20260601150000_add_exercise_entry/migration.sql`:

- `CREATE TYPE "ExerciseType"` (7 valores).
- `CREATE TYPE "ExerciseIntensity"` (4 valores).
- `CREATE TABLE "ExerciseEntry"` con PK `id`.
- 2 índices: `(patientId, recordedAt)` y `(psychologistId, recordedAt)`.
- 2 FKs: `patientId → User(id) ON DELETE CASCADE`,
  `psychologistId → User(id) ON DELETE RESTRICT`.

**No ejecutada contra base real.** Aditiva, no destructiva.

---

## Endpoint creado

`POST /api/patient/exercises`

Body (zod):

```ts
{
  type: "WALK" | "RUN" | "BIKE" | "STRENGTH" | "MOBILITY" | "SPORT" | "CUSTOM";
  durationMinutes?: number; // 1-600
  intensity?: "LOW" | "MEDIUM" | "HIGH" | "CUSTOM";
  note?: string;            // max 500
  mediaKey?: string;
  mediaType?: "PHOTO";
  recordedAt?: string;      // ISO; default now()
}
```

Auth: `requireRole("PATIENT")`. `psychologistId` derivado de
`PatientProfile`. Devuelve `{ id }`.

### Reglas de validación

| escenario                | regla                                                                |
|--------------------------|----------------------------------------------------------------------|
| WALK/RUN/BIKE/STRENGTH/MOBILITY/SPORT | requiere `durationMinutes` **o** `note`.                |
| CUSTOM                   | requiere al menos uno de `durationMinutes`, `note`, `mediaKey`.      |
| `durationMinutes`        | entero positivo 1..600.                                              |
| `note`                   | hasta 500 caracteres.                                                |
| `mediaKey`               | debe empezar con `patients/<user.id>/`.                              |
| `mediaType`              | solo `PHOTO` cuando hay `mediaKey`; sin media → null en server.      |

Errores 400 con mensajes en español. 403 si `mediaKey` no pertenece
al paciente.

### Subida de foto

Reutiliza `/api/patient/entries action=init` (igual que mediciones).
Sin nueva infraestructura S3.

---

## Vista paciente

### `/patient/exercises/new`

- Server component → `requireRolePage("PATIENT")` → `ExerciseForm`.
- Lee `?type=walk|run|bike|strength|mobility|sport|custom` (default `WALK`).
- Form:
  - Selector visual de 7 tipos.
  - Input numérico `durationMinutes` (`step=1`, max 600).
  - Selector visual de 4 intensidades (toggle).
  - Nota (max 500).
  - Foto opcional (`accept=image/* capture=environment`).
  - Botón Guardar → si hay foto, `init`+`PUT`; luego `POST` a
    `/api/patient/exercises`. Al éxito redirige a `/patient/today`.

### `/patient/exercises`

- Server component, lista últimas 30 ordenadas por `recordedAt desc`.
- Filtro por tipo via `?type=` (server, sin estado cliente).
- Cada ítem: tipo · duración formateada (`30 min`, `1 h 15 min`) ·
  intensidad · fecha/hora · nota · foto inline si hay.
- Botón "+ Registrar" arriba.

### `/patient/today`

- Ítem `Ejercicio` pasa de `OUT_OF_SCOPE` a `PENDING`.
- Segunda query `prisma.exerciseEntry.count` acotada al día.
- Estado **Registrado** si `count > 0` con acciones "Ver historial"
  y "Registrar otro".
- Estado **Pendiente** con "Registrar" (primary) y "Ver historial"
  (ghost).
- Timezone del proceso Node — mismo límite heredado, se cierra
  cuando exista `timezone` por cliente.

### Nav paciente

Agregado link `Ejercicio` después de `Medidas` en
`src/app/patient/layout.tsx`.

---

## Vista profesional

### Bloque "Ejercicio" en el timeline

En `/psychologist/patients/[patientId]/timeline`, debajo del bloque
"Peso y medidas":

- Header con link "Ver historial de ejercicio" a la vista dedicada.
- Si no hay actividad: *"Todavía no hay actividad física registrada."*
- Si hay: últimas 3 entradas con tipo · duración · intensidad · hora
  · nota.
- Sin thumbnails (las fotos solo se ven en la vista dedicada).

### `/psychologist/patients/[patientId]/exercises`

- `requireRolePage("PSYCHOLOGIST")` + check
  `profile.psychologistId === user.id` → `notFound()` si no.
- Listado idéntico al del paciente, filtro por tipo via `?type=`.
- Fotos con `presignDownload` (URL firmada 1h). Solo en esta vista.
- Link `← Timeline` al header.

---

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀`.
- `npx prisma generate` — cliente regenerado con `exerciseEntry`.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK. 22 rutas; aparecen `/api/patient/exercises`,
  `/patient/exercises`, `/patient/exercises/new` y
  `/psychologist/patients/[patientId]/exercises`.

No hay tests configurados en el repo.

---

## Qué quedó fuera de alcance

- **`ExerciseSchedule`**, **`ClientPlan`**, **`Reminder`** — no.
- **Rutinas programadas** (días de la semana, series/reps).
- **Adherencia** (programado vs hecho).
- **Cálculo de calorías** / IA / análisis de imagen.
- **Edición/borrado** de actividades.
- **Gráficos** o evolución.
- **Conversión de unidades** (km/pasos/HR).
- **Notificaciones**.
- **Renombrado de rutas o roles**.
- **Railway, secrets, `.env`, deploy, producción** — sin cambios.

---

## Riesgos detectados

- **`durationMinutes` nullable**: por diseño, permite registrar una
  actividad sin medir el tiempo (ej. "trote suave" como nota). El
  server exige al menos uno entre duración y nota.
- **Intensidad subjetiva**: `LOW/MEDIUM/HIGH/CUSTOM` no se mapea a
  HR ni a VO₂. Es declarativa; el profesional la interpreta.
- **Timezone del proceso Node**: igual que comidas/medidas. Cierre
  real con `timezone` por cliente.
- **Tope 600 min**: sanity check; cubre actividades extremas (caminata
  larga). Si surge un caso real superior, ajustar.
- **Sin paginación**: 30 últimas; deuda técnica común con el resto
  de las vistas.
- **N+1 URLs firmadas**: hasta 30 `presignDownload` por render del
  historial. Hoy aceptable.
- **Duplicados del mismo día**: dos actividades del mismo tipo en el
  mismo día se guardan ambas. Deduplicar exige reglas arbitrarias;
  por ahora no.
- **Reutilización de `/api/patient/entries init`**: comparte el
  flujo de presigned PUT. Si en el futuro `init` agrega validaciones
  específicas de comida, conviene extraer
  `POST /api/patient/media/init` compartido.

---

## Confirmación de alcance

- `TimelineEntry` **no modificado**.
- `MeasurementEntry` **no modificado**.
- Lógica de comidas **sin cambios**.
- No se crearon `ExerciseSchedule`, `ClientPlan` ni `Reminder`.
- No se tocó auth, Railway, secrets, `.env`, deploy ni producción.
- Migración no ejecutada contra base real.
- No se renombró ruta ni rol.

---

## Recomendación para PB-10

Avanzar con **PB-10 — Resumen diario para el profesional** o con
**PB-9C — Edición / borrado básico** de mediciones y ejercicios.

Sub-pasos sugeridos para **PB-10** (resumen):

1. Vista `/psychologist/patients/[patientId]/today` (paralela a
   `/patient/today`) que cruce comidas + medidas + ejercicios del
   día.
2. Conteo por categoría: comidas registradas, peso del día, minutos
   de actividad. Sin métricas de adherencia todavía.
3. Documentar como `docs/pb-10-resultado-resumen-diario.md`.
4. Sin schedules todavía: el cruce sigue siendo "lo que el paciente
   cargó hoy".

Sub-pasos para **PB-9C** (edición):

1. `DELETE /api/patient/exercises/[id]` + `DELETE /api/patient/measurements/[id]`
   con check de propiedad.
2. Botón "Borrar" en cada ítem de los historiales del paciente
   (solo paciente; el profesional no edita datos del paciente).
3. Opcional: `PATCH` para corrección típica del valor del día.
4. Documentar.

La regla heredada de PB-8A sigue vigente: cuando aparezca
`ExerciseSchedule`/`MealSchedule`/`MeasurementSchedule`, tabla
propia con FK al `*Entry` correspondiente. **No extender
`TimelineEntry`**.
