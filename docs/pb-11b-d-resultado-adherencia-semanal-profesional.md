# PB-11B-D — Resultado: adherencia semanal profesional

Microciclo: **PB-11B-D**
Base: PB-11B-B (`MealSchedule` + helpers), PB-11B-C (adherencia
diaria).

## Objetivo

Llevar la misma lógica de adherencia de comidas (`MealSchedule` +
`resolveMealAdherence`) a la vista semanal del profesional, con
sumatoria semanal y línea por día. Sin tocar Prisma ni modelos.

---

## Archivos modificados

- `src/app/psychologist/patients/[patientId]/week/page.tsx` —
  query a `MealSchedule`, cálculo de adherencia por día con la
  referencia temporal correcta, bloque semanal arriba y línea
  "Adherencia comidas" por día.
- `docs/pb-11b-d-resultado-adherencia-semanal-profesional.md` —
  este documento.

**No se tocó** `prisma/schema.prisma`, migraciones, `TimelineEntry`,
`MeasurementEntry`, `ExerciseEntry`, `MealSchedule`, endpoints,
helpers existentes, `/patient/today`, `/psychologist/.../today`,
`/psychologist/.../meal-schedules`.

---

## Cómo se calcula la adherencia semanal

1. Se agrega a la `Promise.all` una query
   `prisma.mealSchedule.findMany({ status: "ACTIVE" })` del
   paciente.
2. Los 7 buckets de día ya se construyen como antes
   (`startOfLocalDay(now - 6)..endOfLocalDay(now)`).
3. Para cada bucket `b`:
   - `applicable = schedules.filter(s => scheduleAppliesToday(s, b.date))`.
     Se pasa **`b.date`** (no `now`) para que el filtro de
     `daysOfWeek` use el weekday correcto del día evaluado.
   - `referenceDate = (b.key === todayKey ? now : endOfLocalDay(b.date))`.
     - **Hoy**: usa `now` real ⇒ los schedules de la tarde
       aparecen `PENDIENTE` si todavía no pasaron.
     - **Días pasados**: usa el fin del día (23:59:59) ⇒ los
       schedules sin registro caen como `OMITIDO`, los con
       registro fuera de ventana caen como `REGISTRADO_TARDE`,
       y nunca aparece `PENDIENTE` para el pasado.
   - Se cruza con `b.meals` (ya filtradas a ese día por el
     bucket) y se llama a `resolveMealAdherence(sched, mealsOfDay, referenceDate)`.
4. Por día se computan: `expected`, `onTime` (REGISTRADO),
   `late`, `pending`, `omitted`, más `rows` con cada schedule
   y su estado.
5. Se suma todo en `weekTotals` para el header semanal.

---

## Cómo se trata hoy vs días pasados

- **Hoy (`b.key === todayKey`)**: `referenceDate = now`. Los
  schedules cuya hora target todavía no pasó (o están dentro de la
  ventana de 60 min) aparecen como `PENDIENTE`. Es el mismo
  comportamiento de la vista diaria (PB-11B-C).
- **Días pasados**: `referenceDate = endOfLocalDay(b.date)` (es
  decir, 23:59:59 del día evaluado). Como
  `resolveMealAdherence` solo usa la hora del día de
  `referenceDate` para comparar contra `targetTime`,
  efectivamente todos los slots ya pasaron y los que no tienen
  registro quedan `OMITIDO`. **Nunca** aparece `PENDIENTE` para
  un día pasado.
- Esta es la regla que pide el contrato: días pasados sin
  registro = `OMITIDO`, no "pendientes para siempre".

Nota: como `resolveMealAdherence` mira solo la hora del
`referenceDate` (no la fecha calendario) para decidir el cruce,
la elección de "fin del día" es suficiente. La fecha real del
día sale del `b.meals` (ya bucketed por `dayKey(recordedAt)`).

---

## Cómo se muestran los estados

### Resumen semanal (arriba)

Bloque "Adherencia semanal de comidas":

- Si no hay schedules aplicables en toda la semana:
  *"Este paciente no tiene comidas programadas para esta semana."*
  con link "Configurar comidas".
- Si hay:
  `Registradas: X/Y · Tarde: N · Pendientes: N · Omitidas: N`
  (cada sección se renderiza solo si `> 0`).

Sin gráficos. Sin score porcentual exhibido.

### Por día (dentro del card existente)

Línea "Adherencia comidas":

- Sin schedules aplicables ese día: *"Sin comidas programadas."*
- Con schedules:
  `X/Y registradas · N tarde · N pendientes · N omitidas`
  (cada parte condicional).
- Lista de chips uno por schedule con `HH:mm · slot/label · estado`.
  Permite al profesional ver de un vistazo qué slot quedó cómo.

Lenguaje descriptivo, sin "falló"/"mal"/"incumplió". Colores: se
usa solo `text-pulso-soft` para los secundarios. Nada agresivo.

---

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀` (schema intacto).
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK; sin rutas nuevas.

No hay tests configurados en el repo.

---

## Qué quedó fuera de alcance

- **Adherencia para paciente** en `/patient/today` ya muestra
  estado por slot (PB-11B-B); no se sumó conteo semanal del lado
  del paciente. Queda para más adelante si tiene sentido.
- **Adherencia configurable** por paciente o por schedule
  (tolerance != 60 min) — fuera.
- **`MeasurementSchedule`** / **`ExerciseSchedule`** — no.
- **`ClientPlan`** / **`Reminder`** — no.
- **Gráficos / sparklines** semanales — no.
- **Score porcentual exhibido como adherencia** — explícitamente
  fuera; se muestran conteos.
- **IA, recomendaciones, calorías** — no.
- **Refactor de helpers de fechas** a `src/lib/dates.ts` —
  postergado. Hoy `startOfLocalDay`/`endOfLocalDay`/`dayKey` viven
  duplicados en varias páginas. Queda como deuda para un
  microciclo posterior.
- **Railway, secrets, `.env`, deploy, producción** — sin cambios.

---

## Riesgos detectados

- **Timezone del proceso Node**: igual que el resto. Documentado.
- **`referenceDate = endOfLocalDay(day)` para días pasados**:
  funciona porque `resolveMealAdherence` solo mira la **hora del
  día** del `referenceDate` para comparar contra `targetTime`. Si
  el helper cambia y mira la fecha calendario, esta lógica hay
  que revisarla.
- **Schedules editados a posteriori**: cambiar `targetTime` o
  `daysOfWeek` ahora reinterpreta los días previos. Mismo riesgo
  heredado (sin "fechas efectivas").
- **`scheduleAppliesToday(s, b.date)`**: usa `b.date.getDay()`,
  pero `b.date` se construyó con `new Date(now)` y `setDate(...)`
  — conserva la hora del momento del render, que puede caer
  fuera de `[startsAt, endsAt]` si el rango es estrecho. En la
  práctica no afecta porque `startsAt`/`endsAt` (cuando se usan)
  cubren rangos amplios. Documentado.
- **Múltiples registros del mismo slot el mismo día**: cuentan
  como un `REGISTRADO` (regla del helper). El listado de comidas
  por día sigue mostrando todos.
- **N+1**: cada bucket recalcula la adherencia llamando a
  `resolveMealAdherence` por schedule. 7 días × ≤ pocos schedules
  no es problema. Si crece, vale memorizar.

---

## Confirmación de alcance

- `prisma/schema.prisma` **no modificado**.
- No se crearon migraciones.
- `TimelineEntry`, `MeasurementEntry`, `ExerciseEntry`,
  `MealSchedule` **no modificados**.
- No se crearon `MeasurementSchedule`, `ExerciseSchedule`,
  `ClientPlan` ni `Reminder`.
- No se modificaron endpoints, auth ni helpers existentes.
- No se modificaron `/patient/today`, `/psychologist/.../today`,
  `/psychologist/.../meal-schedules`.
- No se tocó Railway, secrets, `.env`, deploy ni producción.

---

## Recomendación para próximo microciclo

Dos caminos razonables:

1. **PB-11C — `MeasurementSchedule` documental** (análogo a
   PB-11B-A): definir el contrato técnico para programar
   mediciones (peso semanal, medidas quincenales) antes de tocar
   Prisma. Permite cruzar con `MeasurementEntry` y traer la
   adherencia a peso/medidas. Documental, bajo riesgo.

2. **PB-11D — Refactor de helpers de fechas**: mover
   `startOfLocalDay`/`endOfLocalDay`/`dayKey`/`formatHHMM` a
   `src/lib/dates.ts` (hoy duplicados en 6+ páginas). Suelo
   técnico para los próximos schedules. Cambio chico, alto valor
   de mantenibilidad.

Si el equipo prioriza valor de producto, **PB-11C**. Si
prioriza estabilidad técnica antes de la próxima ola de modelos,
**PB-11D** primero.

La regla heredada sigue: schedules en **tabla propia**, sin
extender `TimelineEntry` ni los `*Entry`. Si aparece la
necesidad de trazabilidad fuerte por entrada (`mealScheduleId`
en `TimelineEntry`), entra como migración aditiva posterior.
