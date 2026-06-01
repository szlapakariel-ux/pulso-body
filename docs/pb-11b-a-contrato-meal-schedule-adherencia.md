# PB-11B-A — Contrato técnico de MealSchedule y adherencia mínima

Microciclo: **PB-11B-A** (documental, sin código).
Referencias: PB-6, PB-10, PB-11A; `prisma/schema.prisma`,
`src/lib/meal-slots.ts`.

## Objetivo

Definir, antes de tocar Prisma, **cómo va a vivir `MealSchedule`**
y qué reglas de "esperado vs registrado" se aplican, para que la
implementación de PB-11B-B sea una migración aditiva con cero
ambigüedad. Solo documentación.

---

## 1. Estado actual

### Cómo se registra una comida hoy

- Tabla `TimelineEntry` (PB-6) con metadata de comida:
  - `entryKind: EntryKind` ∈ `{ GENERIC, MEAL }` (default `GENERIC`).
  - `mealSlot: MealSlot?` ∈ `{ BREAKFAST, SNACK_AM, LUNCH, SNACK_PM, DINNER, CUSTOM }`.
  - `mediaType` y `mediaKey` **NOT NULL** — toda comida tiene foto.
- Endpoint `POST /api/patient/entries` valida que
  `entryKind === "MEAL"` ⇒ `mediaType === "PHOTO"` y `mealSlot`
  presente.
- Sin `MealSchedule` persistido. La "agenda" de `/patient/today`
  vive como **array mock** local con 5 slots horarios fijos:

  ```ts
  // src/app/patient/today/page.tsx
  const AGENDA: AgendaItem[] = [
    { id: "breakfast", time: "08:00", title: "Desayuno", ... mealSlot: "BREAKFAST" },
    { id: "snack-am",  time: "11:00", title: "Colación", ... mealSlot: "SNACK_AM" },
    { id: "lunch",     time: "13:30", title: "Almuerzo", ... mealSlot: "LUNCH" },
    { id: "snack-pm",  time: "17:00", title: "Merienda", ... mealSlot: "SNACK_PM" },
    { id: "dinner",    time: "21:00", title: "Cena",     ... mealSlot: "DINNER" },
  ];
  ```

- `/patient/today` cruza esa agenda contra `TimelineEntry` del día
  (`entryKind=MEAL`, `recordedAt` en `[startOfLocalDay, endOfLocalDay]`)
  y marca **Registrado/Pendiente** por slot. Sin "tarde", sin
  "omitido", sin franja horaria.
- Resumen profesional diario (PB-10) y semanal (PB-11A) muestran
  **lo registrado** sin contraste contra una expectativa.

### Helpers reutilizables

- `src/lib/meal-slots.ts` ya provee `MEAL_SLOT_LABEL`,
  `slotFromSlug`, etc.
- `startOfLocalDay` / `endOfLocalDay` están replicados localmente
  en cada vista (`today`, `week`, profesional `today`). Si crece
  el cruce, conviene moverlos a `src/lib/dates.ts`.

---

## 2. Problema a resolver

El sistema hoy responde **"qué cargó el paciente"**. Para que el
profesional pueda acompañar, necesita responder también:

- **Qué se esperaba**: tipos de comida, días aplicables, horario
  target.
- **Si se registró**: hay `TimelineEntry` MEAL para ese slot ese
  día.
- **Si se registró tarde**: hubo registro pero pasó del horario
  target + tolerancia.
- **Si se omitió**: pasó el día (o la ventana de tolerancia) sin
  registro.
- **Si no aplica hoy**: el schedule cubre otros días de la semana.

Sin `MealSchedule` persistido no podemos diferenciar
"no había nada programado hoy" de "estaba programado y se saltó".

---

## 3. Modelo propuesto `MealSchedule`

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
  targetTime     String         // "HH:mm" 24h, hora local del paciente
  daysOfWeek     Int[]          // 0..6 (0 = domingo, 1 = lunes, …, 6 = sábado)
  status         ScheduleStatus @default(ACTIVE)
  startsAt       DateTime?
  endsAt         DateTime?
  note           String?        // visible solo al profesional
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
mealSchedulesAsPsych   MeralSchedule[] @relation("MealSchedulesAsPsych")
```

Notas:

- **PostgreSQL** soporta `Int[]` nativo (`integer[]`) y Prisma lo
  expone como `number[]`. Ya hemos usado solo escalares y enums;
  esta es la primera columna array. Alternativa: `daysOfWeekMask`
  como `Int` con bitmask (1=domingo, 2=lunes, …, 64=sábado).
  Recomendación: arrancar con `Int[]` por **legibilidad** y
  consultas más simples (`{ daysOfWeek: { has: weekday } }`).
- `mealSlot` reusa el enum existente — no se inventa otra
  categoría.
- `label` queda opcional para diferenciar dos slots iguales con
  semánticas distintas (ej. dos `SNACK_AM` programados a horas
  distintas si en algún futuro se permite, aunque por ahora la
  unicidad la fuerza la combinación slot+time+days).
- `note` es **privada del profesional** — no se renderiza en
  `/patient/today` salvo decisión expresa.

---

## 4. Decisiones de diseño

### `targetTime`: `string "HH:mm"` vs `DateTime`

Recomendación: **`String` con formato `"HH:mm"`**.

- Un schedule es **repetitivo**; no se ata a una fecha concreta.
- `DateTime` obligaría a almacenar una fecha falsa o usar `Date`
  separado, y a manejar timezones en cada lectura.
- Validación server: regex `^([01]\d|2[0-3]):[0-5]\d$` con `zod`.
- Comparación: parsear a minutos del día (`h * 60 + m`) al
  cruzar contra `recordedAt` local del paciente.

### `daysOfWeek`: `Int[] 0..6` vs string vs bitmask

Recomendación: **`Int[]` con convención 0=domingo … 6=sábado**.

- Encaja con `Date.getDay()` de JS sin conversión.
- Prisma genera `Int[]` → `integer[]` en Postgres.
- Vacío (`[]`) significa "nunca" (schedule no aplica); el cliente
  puede usarlo para "pausa parcial" pero conviene rechazarlo en
  validación y usar `status = PAUSED` para pausa total.

### `startsAt` / `endsAt`

Mantener **opcionales** (`null` = sin límite). Útil cuando una
comida programada solo aplica durante un período (ej. una semana
de "ayuno experimental"). En el MVP no se usan, pero quedan en el
modelo para evitar una segunda migración cuando aparezca el caso.

### Horarios repetidos / "más de un desayuno por día"

No se modela en el MVP. La combinación lógicamente única es
`(patientId, mealSlot, targetTime, daysOfWeek)`. No se crea
unique constraint todavía: dos schedules con mismo slot y misma
hora son raros pero no inválidos. Se valida a nivel UI cuando
exista.

### `label` además de `mealSlot`

Util cuando el slot es `CUSTOM` (ej. label = "post-entrenamiento")
o cuando dos `LUNCH` conviven (rarísimo, pero posible). Sin
`label`, los slots se ven todos igual.

### `note` visible para paciente

**No**. La nota es del profesional para sí mismo (ej. *"propenso
a saltar la merienda los miércoles"*). Si en el futuro se quiere
una nota visible al paciente, agregar `patientNote` separado.

---

## 5. Relación con `TimelineEntry`

Dos opciones:

### A) Agregar `mealScheduleId` opcional a `TimelineEntry`

Pros:
- Trazabilidad fuerte: cada registro queda atado al schedule que
  cumplió.
- Permite ediciones de schedule sin "perder" el match histórico.

Contras:
- **Toca `TimelineEntry`** otra vez (PB-11A documenta el riesgo).
- Requiere que el cliente envíe `mealScheduleId` en el `complete`,
  o que el server lo derive — más superficie.
- Si el paciente registra una comida sin schedule activo, queda
  `null` igual; el matching termina haciéndose por slot+hora.

### B) Matching derivado por `mealSlot` + ventana horaria

Pros:
- **Sin tocar `TimelineEntry`**. Migración estrictamente aditiva.
- El cálculo "esperado vs registrado" vive en una capa de
  resolución server-side (helper `resolveAdherence(day, schedules,
  entries)`).
- Si el schedule cambia, el histórico no queda con FK rota.

Contras:
- Cambios de schedule alteran retroactivamente cómo se interpreta
  el pasado. Mitigación: para histórico, se puede congelar el
  schedule vigente en el momento (no lo hacemos en PB-11B-B).

**Recomendación**: **Opción B** para el MVP. Cuando aparezca un
caso real que necesite trazabilidad rígida, sumar
`mealScheduleId String?` en `TimelineEntry` en una migración
nueva. La regla heredada de PB-8A sigue: no tocar `TimelineEntry`
si se puede evitar.

---

## 6. Reglas mínimas de adherencia

Estados derivados (no se persisten en `MealSchedule`, se calculan
al render):

| estado            | regla                                                                |
|-------------------|----------------------------------------------------------------------|
| `SIN_PROGRAMACION`| no hay `MealSchedule` activo para hoy con ese slot.                  |
| `PENDIENTE`       | hay schedule, no hay registro, no pasó `targetTime + tolerancia`.    |
| `REGISTRADO`      | hay schedule y hay `TimelineEntry` MEAL del slot en el día, **dentro** de `[targetTime − tolerancia, targetTime + tolerancia]`. |
| `REGISTRADO_TARDE`| hay schedule y hay registro del slot en el día, **fuera** de la ventana de tolerancia (registrado pero tarde / temprano). |
| `OMITIDO`         | hay schedule, no hay registro, ya pasó `endOfLocalDay` (o pasó la ventana y no llegará).  |

### Parámetros iniciales

- **Tolerancia**: 60 minutos a cada lado de `targetTime`.
  Configurable después; arrancar hard-coded en un helper
  `src/lib/meal-adherence.ts` para que sea fácil mover a `MealSchedule.toleranceMinutes`
  cuando aparezca la necesidad real.
- **"Ya pasó"**: comparar `now >= targetTime + tolerancia` con la
  hora local del proceso Node. Mismo límite de timezone que el
  resto del sistema.
- **Comida sin programación** (slot que registró el paciente
  fuera de schedule, ej. `CUSTOM`): no entra en el cómputo de
  adherencia; se muestra como registro suelto en el resumen.

### Casos borde

- **Día vacío en `daysOfWeek`**: schedule no aplica. Estado del
  día = "sin programación para hoy".
- **`status !== ACTIVE`**: no contribuye a la adherencia. Pausado
  no es omitido.
- **Múltiples registros del mismo slot en el día**: cuentan como
  un solo "REGISTRADO" para adherencia. La vista detalle los
  muestra todos.
- **Múltiples schedules del mismo slot en el día** (raro): se
  evalúa cada uno por separado y se reportan independientes.

---

## 7. Impacto en `/patient/today`

### Cambios necesarios

1. Reemplazar el array `AGENDA` mock por una query a
   `MealSchedule` activo del paciente filtrando por
   `daysOfWeek`:
   ```ts
   const todayWeekday = now.getDay();
   prisma.mealSchedule.findMany({
     where: {
       patientId: user.id,
       status: "ACTIVE",
       daysOfWeek: { has: todayWeekday },
       OR: [{ startsAt: null }, { startsAt: { lte: now } }],
       AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
     },
     orderBy: { targetTime: "asc" },
   });
   ```
2. Para cada schedule, calcular su estado con
   `resolveMealAdherence(schedule, mealsToday, now)`.
3. Acción primaria por estado:
   - `PENDIENTE` / `REGISTRADO_TARDE` no aún registrado →
     `Registrar con foto` (igual que hoy).
   - `REGISTRADO` o `REGISTRADO_TARDE` con registro →
     `Ver en timeline`.
   - `OMITIDO` → solo informa, sin CTA.
4. **Fallback sin schedules**: si el paciente no tiene
   `MealSchedule` activos, mostrar los slots `AGENDA` mock como
   ahora (transición suave). Documentar como fallback temporal.

### Fuera de scope de hoy

- Modificar `EXERCISE` y `MEASUREMENT` en la agenda (siguen como
  PB-9 / PB-8C).

---

## 8. Impacto en vista profesional diaria (PB-10 evoluciona)

`/psychologist/patients/[patientId]/today` agrega un sub-bloque
"Adherencia de hoy" arriba de "Comidas de hoy":

- Cuenta `esperadas/registradas` (ej. `3/5`).
- Lista de slots con su estado: chips coloreados por estado
  (`PENDIENTE`, `REGISTRADO`, `REGISTRADO_TARDE`, `OMITIDO`).
- Sin **juicio** ni recomendaciones. Solo conteo descriptivo.

Si el paciente no tiene schedules activos, mostrar copy:
*"Este paciente no tiene comidas programadas. Configurar →"* con
link a la futura UI de configuración (sección 11).

---

## 9. Impacto en vista semanal (PB-11A evoluciona)

`/psychologist/patients/[patientId]/week`:

- Por día: agregar línea **Adherencia: `X/Y` comidas**.
- Total semanal de adherencia en el header opcional (ej. *"21/30
  comidas registradas esta semana"*).
- Sin gráficos. Sin promedio porcentual exhibido como "calidad
  nutricional".
- Mantener "Sin registros" cuando no haya datos del día. Si no
  hay schedules en absoluto, mantener el formato actual de
  PB-11A.

---

## 10. Endpoints futuros

```
POST   /api/psychologist/patients/[patientId]/meal-schedules
GET    /api/psychologist/patients/[patientId]/meal-schedules
PATCH  /api/psychologist/patients/[patientId]/meal-schedules/[id]
DELETE /api/psychologist/patients/[patientId]/meal-schedules/[id]
```

Reglas:
- Auth: `requireRole("PSYCHOLOGIST")` + check
  `profile.psychologistId === user.id` antes de cualquier
  operación.
- Validación zod del body: `mealSlot` enum, `targetTime` regex,
  `daysOfWeek` array de enteros 0..6 no vacío, `label` máx 60,
  `note` máx 500, `status` enum.
- `DELETE`: preferir **archivar** (`status = ARCHIVED`) en lugar
  de borrar; mantiene histórico de schedules. El nombre del
  endpoint puede seguir siendo `DELETE` semánticamente — el
  handler hace soft delete.
- El **paciente no toca schedules**: no se expone endpoint en
  `/api/patient/*`.

Endpoint para que el paciente "marque" una comida programada:
**no es necesario**. El paciente sigue usando
`POST /api/patient/entries` igual; el matching es derivado.

---

## 11. UI futura profesional

Vista mínima propuesta para PB-11B-C (o PB-11B-B mismo si entra):

`/psychologist/patients/[patientId]/meal-schedules`

- Listado en card de los schedules activos + sección colapsada de
  pausados/archivados.
- Botón "+ Agregar comida programada".
- Form simple:
  - selector `mealSlot` (reusa `MEAL_SLOT_LABEL`).
  - `label` opcional.
  - input `targetTime` (`<input type="time">`).
  - checkboxes de días (L-Mar-Mié-Jue-Vie-Sáb-Dom).
  - `note` opcional.
  - botón Guardar.
- Acciones por fila: Pausar / Reanudar / Archivar / Editar.

Link de entrada: desde
`/psychologist/patients/[patientId]/timeline` y desde el resumen
diario profesional ("Configurar comidas →").

---

## 12. Riesgos

- **Timezone del proceso Node**: el cálculo de "qué día es hoy"
  y de "qué hora es" para evaluar `targetTime` usa el huso del
  server. Riesgo conocido. Cierre real con `timezone` por
  paciente en `PatientProfile` (queda fuera de PB-11B-B).
- **`daysOfWeek` y locale**: 0=domingo vs 1=lunes hay que
  documentar bien. Usaremos `Date.getDay()` (0=domingo) en JS.
  El UI muestra etiquetas con `Intl` en `es-AR` (lunes-primero,
  comprensión visual).
- **`Int[]`**: primera columna array. Validar que las
  migraciones Prisma+Postgres lo generan limpio (`integer[]`).
  Si genera fricción, fallback a bitmask.
- **Duplicados de schedules**: dos `BREAKFAST` 08:00 lunes son
  válidos a nivel modelo. Validar duplicado exacto en el form
  cliente, no en DB.
- **Comidas duplicadas en un mismo slot**: el paciente puede
  cargar dos `BREAKFAST` el mismo día. Adherencia las cuenta como
  un solo "registrado"; el detalle muestra ambas.
- **Matching horario imperfecto**: una comida cargada a las 10:30
  contra un schedule de 08:00 con tolerancia 60 → `REGISTRADO_TARDE`.
  No es un veredicto, es un dato. Documentar copy para evitar
  juicio.
- **Schedule editado a posteriori**: si cambia `targetTime`, los
  estados históricos cambian retroactivamente. Aceptable en MVP
  (opción B). Mitigar con "fechas efectivas" más adelante.
- **Adherencia como juicio clínico**: explicitar en docs/UI que
  los conteos son **descriptivos**. Nada de "incumple", "se porta
  mal", etc.
- **`status = PAUSED` o `ARCHIVED`**: no contribuyen a la
  adherencia. UI debe distinguir claro.
- **Falta de edición histórica**: si un día se cambia el
  schedule, no hay "vista de ese día con el schedule de ese día".
  Postergable.

---

## 13. Recomendación final para PB-11B-B

Implementar el **MealSchedule mínimo aditivo**:

- `prisma/schema.prisma`: enum `ScheduleStatus`, modelo
  `MealSchedule`, relaciones en `User`.
- Migración aditiva (CREATE TYPE + CREATE TABLE + 2 índices + 2
  FKs). Cero ALTER sobre tablas existentes.
- `src/lib/meal-adherence.ts`: helper puro
  `resolveMealAdherence(schedule, entriesOfDay, now)` →
  estado + flags.
- Endpoints CRUD bajo
  `/api/psychologist/patients/[patientId]/meal-schedules` (POST,
  GET, PATCH, DELETE soft).
- UI profesional mínima en
  `/psychologist/patients/[patientId]/meal-schedules` (form +
  listado).
- `/patient/today`: reemplazo del array `AGENDA` por query a
  `MealSchedule`, con fallback al mock cuando no hay schedules.
- Aplazar a PB-11B-C las evoluciones de `/today` profesional y
  `/week`. Mantener el alcance corto.
- Documentar en `docs/pb-11b-b-resultado-meal-schedule.md`.

**No tocar** `TimelineEntry`, `MeasurementEntry`, `ExerciseEntry`,
`ClientPlan`, `Reminder`. Sin Railway, sin deploy.

---

## 14. Prompt sugerido para PB-11B-B (NO ejecutar)

```
Repo: szlapakariel-ux/pulso-body
Microciclo: PB-11B-B — MealSchedule mínimo + cruce en /patient/today

Base: docs/pb-11b-a-contrato-meal-schedule-adherencia.md.

Hacer:
1. Agregar enum ScheduleStatus y modelo MealSchedule a
   prisma/schema.prisma según §3 del doc. Agregar relaciones
   mealSchedulesAsPatient / mealSchedulesAsPsych en User.
2. Crear migración manual aditiva en
   prisma/migrations/<timestamp>_add_meal_schedule/migration.sql
   (CREATE TYPE ScheduleStatus + CREATE TABLE MealSchedule +
   2 índices + 2 FKs). No ejecutarla contra DB real.
3. Crear src/lib/meal-adherence.ts con resolveMealAdherence(...)
   y una constante DEFAULT_TOLERANCE_MINUTES = 60.
4. Implementar CRUD bajo
   /api/psychologist/patients/[patientId]/meal-schedules
   (POST, GET, PATCH, DELETE soft via status=ARCHIVED).
5. Implementar UI profesional
   /psychologist/patients/[patientId]/meal-schedules con form
   + listado + acciones por fila.
6. Actualizar /patient/today: query a MealSchedule activo del
   día y derivar estado por slot usando el helper. Fallback al
   array AGENDA cuando no haya schedules para el paciente.
7. Documentar en docs/pb-11b-b-resultado-meal-schedule.md.

Validar: prisma validate, prisma generate, npm run lint, npm run
build.

No tocar: TimelineEntry, MeasurementEntry, ExerciseEntry,
endpoints existentes de comidas/medidas/ejercicio, vistas /today
y /week profesionales (evolución entra en PB-11B-C), auth,
Railway, secrets, .env, deploy, producción.

Rama: feature/pb-11b-b-meal-schedule.
Commit: feat(pulso-body): meal schedule minimo (PB-11B-B).
Abrir PR. No mergear sin autorización.
```
