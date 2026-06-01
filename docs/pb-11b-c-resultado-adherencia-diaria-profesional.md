# PB-11B-C — Resultado: adherencia diaria de comidas en resumen profesional

Microciclo: **PB-11B-C**
Base: PB-11B-B (`MealSchedule` + `resolveMealAdherence` +
`scheduleAppliesToday`).

## Objetivo

Sumar al resumen diario profesional un bloque **descriptivo** de
adherencia de comidas, usando los schedules ya configurados. Sin
tocar Prisma, modelos ni endpoints.

---

## Archivos modificados

- `src/app/psychologist/patients/[patientId]/today/page.tsx` —
  agrega query a `MealSchedule`, calcula adherencia y renderiza
  un bloque "Adherencia de comidas" arriba de "Comidas de hoy".
- `docs/pb-11b-c-resultado-adherencia-diaria-profesional.md` —
  este documento.

**No se tocó** `prisma/schema.prisma`, migraciones, `TimelineEntry`,
`MeasurementEntry`, `ExerciseEntry`, `MealSchedule`, endpoints,
helpers, `/patient/today`, `/week`.

---

## Cómo se calcula la adherencia

1. Se agrega `prisma.mealSchedule.findMany({ status: "ACTIVE" })`
   a la `Promise.all` que ya existía.
2. Se filtran los schedules aplicables hoy con
   `scheduleAppliesToday(...)` (igual semántica que
   `/patient/today`).
3. Se mapean al tipo `ScheduleForAdherence` y se cruzan con
   `mealsForAdherence` (`{ id, mealSlot, recordedAt }`) usando
   `resolveMealAdherence(schedule, entries, now)` — tolerancia
   default 60 min.
4. Se construyen contadores: `expected`, `registered`, `late`,
   `pending`, `omitted`.

El cálculo es 100 % derivado. No se persisten estados ni se
modifica nada.

---

## Cómo se muestran los estados

Bloque "Adherencia de comidas":

- Si hay schedules aplicables:
  - Línea de conteo:
    `Registradas: X/Y · Tarde: N · Pendientes: N · Omitidas: N`
    (las secciones de tarde/pendientes/omitidas se muestran solo
    si `> 0`).
  - Lista por schedule, ordenada por `targetTime`:
    `HH:mm · {label o slot humano}` + estado humano alineado a la
    derecha.
- Si no hay schedules aplicables:
  - *"Este paciente todavía no tiene comidas programadas para
    hoy."*
  - Link "Configurar comidas" → `/psychologist/.../meal-schedules`.

Estados (`ADHERENCE_LABEL`):

| código              | label humano        |
|---------------------|---------------------|
| `REGISTRADO`        | Registrado          |
| `REGISTRADO_TARDE`  | Registrado tarde    |
| `PENDIENTE`         | Pendiente           |
| `OMITIDO`           | Omitido             |

Sin colores agresivos, sin juicios ("incumple", "mal", etc.). El
bloque es descriptivo.

---

## Cómo se maneja la ausencia de schedules

- Si el paciente no tiene ningún `MealSchedule` activo aplicable
  hoy (sea porque no creó ninguno, porque están pausados, o
  porque `daysOfWeek`/`startsAt`/`endsAt` no aplican), el bloque
  muestra el copy de ausencia + link a configuración.
- El resto del resumen ("Comidas de hoy", "Peso y medidas de
  hoy", "Ejercicio de hoy") **sigue intacto**. La adherencia no
  reemplaza el feed registrado: lo complementa.

---

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀` (schema intacto).
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK; no se agregan rutas nuevas.

No hay tests configurados en el repo.

---

## Qué quedó fuera de alcance

- **Adherencia semanal** en `/psychologist/.../week` — queda para
  **PB-11B-D**.
- **Adherencia para el paciente** (en `/patient/today` ya se ve el
  estado por slot, pero sin contadores) — queda fuera.
- **Adherencia configurable** por paciente o por schedule
  (tolerance distinta del default 60 min) — fuera.
- **`MeasurementSchedule`** / **`ExerciseSchedule`** — no.
- **`ClientPlan`** / **`Reminder`** — no.
- **Gráficos**, "% adherencia semanal" exhibido como score — no.
- **IA, recomendaciones, calorías** — no.
- **Railway, secrets, `.env`, deploy, producción** — sin cambios.

---

## Riesgos detectados

- **Timezone del proceso Node**: el cálculo de "hoy" y "ahora"
  para la ventana de tolerancia depende del huso del server. Mismo
  límite heredado.
- **Estado "OMITIDO" en horario tardío**: si la consulta se hace
  a la 1:00 AM y un schedule de cena con tolerancia 60 min ya
  pasó la ventana, aparece como OMITIDO antes de que termine el
  día. Es correcto según la definición del estado pero puede
  llamar la atención al profesional. Documentado.
- **Schedules editados a posteriori**: cambiar `targetTime` ahora
  altera la adherencia de las próximas horas y la de "ahora";
  para el histórico el problema heredado de PB-11B-B sigue.
- **Conteo `registered/expected`**: si hay 0 schedules aplicables,
  no se muestra el conteo (entra en el branch de copy ausente).
  No se exhibe "0/0" para evitar lectura como "incumple".
- **Múltiples registros del mismo slot**: cuentan como un solo
  REGISTRADO (regla del helper). El bloque "Comidas de hoy" sigue
  mostrando todos por si el profesional necesita ver el detalle.
- **Lenguaje**: revisado para evitar juicio clínico. "Omitido" es
  un descriptor de estado, no una evaluación.

---

## Confirmación de alcance

- `prisma/schema.prisma` **no modificado**.
- No se crearon migraciones.
- `TimelineEntry`, `MeasurementEntry`, `ExerciseEntry`,
  `MealSchedule` **no modificados**.
- No se crearon `MeasurementSchedule`, `ExerciseSchedule`,
  `ClientPlan` ni `Reminder`.
- No se modificaron endpoints, auth ni helpers existentes.
- No se tocó Railway, secrets, `.env`, deploy ni producción.

---

## Recomendación para PB-11B-D

Sumar **adherencia semanal** a
`/psychologist/patients/[patientId]/week` reusando exactamente
`resolveMealAdherence`:

1. Query a `MealSchedule` activo del paciente para todo el rango
   semanal.
2. Por cada día del rango, filtrar schedules con
   `scheduleAppliesToday(s, day)` (pasar la fecha del día, no
   `now`).
3. Cruzar con las comidas registradas de ese día.
4. Mostrar línea "Adherencia: X/Y" por día. Si querés totalizar
   la semana, suma simple en el header.
5. Mantener "Sin registros" cuando no haya comidas y no haya
   schedules.
6. Sin gráficos. Sin score porcentual exhibido como adherencia
   global.

Para PB-11B-D conviene además **levantar
`startOfLocalDay`/`endOfLocalDay`/`dayKey` a `src/lib/dates.ts`**
(ya están duplicados en 6+ archivos). Es refactor seguro y
acompaña.

La regla heredada sigue: schedules en **tabla propia**, no
extender `TimelineEntry` ni los `*Entry`.
