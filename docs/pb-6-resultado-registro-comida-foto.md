# PB-6 — Resultado: registro de comida con foto

Microciclo: **PB-6**
Referencias: `docs/contrato-producto-pulso-body.md`,
`docs/pb-1-mapa-tecnico-adaptacion.md`,
`docs/pb-3-modelo-prisma-objetivo.md`,
`docs/pb-4-resultado-photo-media-type.md`,
`docs/pb-5-resultado-agenda-diaria-interna.md`.

## Objetivo

Convertir el flujo "Registrar con foto" desde `/patient/today` en un
**registro de comida identificable**, sin crear todavía `MealEntry` ni
`MealSchedule`.

## Decisión técnica

Reutilizar `TimelineEntry` con dos campos nuevos mínimos:

- `entryKind: EntryKind { GENERIC | MEAL }` con default `GENERIC`.
- `mealSlot: MealSlot? { BREAKFAST | SNACK_AM | LUNCH | SNACK_PM | DINNER | CUSTOM }`.

Esto evita una migración disruptiva y deja el camino abierto para
introducir `MealEntry` cuando aparezca el plan/schedule del profesional.

---

## Archivos modificados

- `prisma/schema.prisma` — enums `EntryKind`, `MealSlot` y campos en `TimelineEntry`.
- `prisma/migrations/20260601130000_add_meal_metadata_to_timeline_entry/migration.sql` — nueva.
- `src/app/api/patient/entries/route.ts` — acepta `entryKind` / `mealSlot` en `complete`; título "Comida · Slot · HH:MM".
- `src/app/patient/new-entry/page.tsx` — lee `?intent=meal&slot=<id>`, pasa props al form.
- `src/app/patient/new-entry/new-entry-form.tsx` — soporta `intent="meal"`; arranca en attach con `accept="image/*"` y `capture="environment"`; envía `entryKind` y `mealSlot`.
- `src/app/patient/timeline/page.tsx` — badge "Comida · Slot".
- `src/app/psychologist/patients/[patientId]/timeline/page.tsx` — badge "Comida · Slot".
- `src/app/patient/today/page.tsx` — cruza `TimelineEntry` del día y marca slots registrados.
- `src/lib/meal-slots.ts` — helper compartido (slug → enum, label).
- `docs/pb-6-resultado-registro-comida-foto.md` — este documento.

---

## Migración creada

`prisma/migrations/20260601130000_add_meal_metadata_to_timeline_entry/migration.sql`:

```sql
CREATE TYPE "EntryKind" AS ENUM ('GENERIC', 'MEAL');
CREATE TYPE "MealSlot" AS ENUM ('BREAKFAST', 'SNACK_AM', 'LUNCH', 'SNACK_PM', 'DINNER', 'CUSTOM');

ALTER TABLE "TimelineEntry"
  ADD COLUMN "entryKind" "EntryKind" NOT NULL DEFAULT 'GENERIC',
  ADD COLUMN "mealSlot"  "MealSlot";
```

No se ejecutó contra ninguna base real. Las filas existentes quedan
con `entryKind = GENERIC` y `mealSlot = NULL` gracias al default.

---

## Cambios realizados

### Cómo se marca una comida

1. El cliente entra a `/patient/today` y toca **Registrar con foto** en
   un slot (ej. *Desayuno*).
2. Navega a `/patient/new-entry?intent=meal&slot=breakfast`.
3. `page.tsx` mapea el slug (`breakfast` → `BREAKFAST`) con
   `slotFromSlug`. Si el slug no se reconoce, cae a `CUSTOM` (regla
   segura — nunca rompe, lo documenta el endpoint).
4. El formulario arranca directamente en modo **attach** con
   `accept="image/*"` y `capture="environment"` (cámara trasera en
   mobile cuando el navegador lo soporta).
5. Al guardar, el frontend envía en el `complete`:
   - `mediaType: "PHOTO"` (derivado del archivo).
   - `entryKind: "MEAL"`.
   - `mealSlot: "BREAKFAST" | …`.
6. El backend valida:
   - Si `entryKind === "MEAL"` → `mediaType` **debe** ser `PHOTO` (400 si no).
   - Si `entryKind === "MEAL"` → `mealSlot` **debe** estar presente (400 si no).
7. Se persiste un `TimelineEntry` con `title = "Comida · Desayuno · HH:MM"`.
8. El registro genérico (sin `intent=meal`) sigue funcionando exactamente
   como antes; `entryKind` queda `GENERIC` y `mealSlot` queda `null`.

### Mapeo de slots

| slug en URL | enum `MealSlot` | label |
|---|---|---|
| `breakfast` | `BREAKFAST` | Desayuno |
| `snack-am`  | `SNACK_AM`  | Colación |
| `lunch`     | `LUNCH`     | Almuerzo |
| `snack-pm`  | `SNACK_PM`  | Merienda |
| `dinner`    | `DINNER`    | Cena |
| *desconocido* | `CUSTOM`  | Otra comida |

El slug se normaliza en server (page) antes de llegar al form: nunca se
envía un slot inválido al backend.

### Cómo `/patient/today` detecta registrado vs pendiente

- Server component que consulta:

  ```ts
  prisma.timelineEntry.findMany({
    where: {
      patientId: user.id,
      entryKind: "MEAL",
      recordedAt: { gte: startOfLocalDay(now), lte: endOfLocalDay(now) },
    },
    select: { mealSlot: true },
  });
  ```

- Construye `Set<MealSlot>` con los slots ya registrados hoy.
- Cada ítem `MEAL` de la agenda mock pasa a estado **Registrado** si su
  `mealSlot` está en el set. La acción cambia a **Ver en timeline**.
- Los ítems `EXERCISE` y `MEASUREMENT` siguen siendo "Próximamente".
- Sin cambio de endpoints: todo se resuelve en server component vía Prisma.

---

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀`.
- `npx prisma generate` — OK (cliente regenerado con `entryKind` y `mealSlot`).
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK; 18 rutas, sin errores TS. `/patient/today`,
  `/patient/new-entry` y los timelines compilan.

No hay tests configurados en el repo.

---

## Qué quedó fuera de alcance

- **`MealEntry`**, **`ExerciseEntry`**, **`MeasurementEntry`** — no se
  crearon. La comida vive en `TimelineEntry` con metadata mínima.
- **`ClientPlan`**, **`MealSchedule`**, **`ExerciseSchedule`**,
  **`MeasurementSchedule`**, **`Reminder`** — no se crearon.
- **Horarios configurables por profesional** — la agenda sigue siendo el
  array `AGENDA` mock en `/patient/today`.
- **Recordatorios reales**, push, WhatsApp/email — no.
- **Renombrado de rutas o roles** — no.
- **Cálculo calórico, análisis de imagen, IA nueva** — no.
- **Edición/borrado** de un registro de comida — no incluido.
- **Deploy, Railway, secrets, `.env`, producción** — no se tocó nada.

---

## Riesgos detectados

- **Timezone del servidor**: `startOfLocalDay` / `endOfLocalDay` usan el
  timezone del proceso Node. Un cliente en otro huso puede ver "Pendiente"
  cuando ya cargó la comida del lado del navegador. Lo aclara la nota de la
  página; cierre real cuando exista `timezone` por cliente.
- **Slot no reconocido**: si alguien arma una URL con
  `?intent=meal&slot=foo`, el slot cae a `CUSTOM` y queda un registro
  válido pero sin alinearse con la agenda mock. Decisión adoptada (no
  romper). Se puede endurecer cuando los slots vivan en `MealSchedule`.
- **Registros duplicados**: si el cliente toca dos veces "Registrar con
  foto" del desayuno y guarda dos veces, hay dos `TimelineEntry` con
  `mealSlot=BREAKFAST` el mismo día. La agenda lo muestra una sola vez
  como "Registrado". Aceptable hoy; conviene revisarlo cuando entren los
  schedules.
- **`mediaType !== PHOTO`** en intent=meal: el frontend filtra (`accept="image/*"`
  + condicional al enviar `entryKind`), pero un cliente malicioso podría
  postear `entryKind=MEAL` con audio/video. El backend lo rechaza con 400.
- **Privacidad de fotos de comida**: igual que en PB-4, bucket privado +
  URL firmada por 1h. No cambia.
- **Migración Prisma**: agrega dos columnas (`entryKind` con default,
  `mealSlot` nullable) — compatible con datos existentes. En Postgres es
  no destructiva y rápida; sin riesgo de pérdida si el deploy se hace
  según el procedimiento habitual.

---

## Confirmación de alcance

- No se tocó Railway, secrets, `.env`, deploy ni producción.
- No se ejecutó ninguna migración contra base real.
- No se crearon `MealEntry`, `ExerciseEntry`, `MeasurementEntry`,
  `ClientPlan` ni ningún `*Schedule`.
- No se modificó auth, permisos, roles ni rutas existentes.
- No se cambió la lógica de IA ni el prompt (sigue rechazando PHOTO en
  `/ai-summary` por PB-4).

---

## Recomendación para PB-7

Avanzar con **PB-7 — Vista profesional de bitácora**, según
`docs/pb-1-mapa-tecnico-adaptacion.md`.

Sub-pasos sugeridos:

1. En la vista de paciente del profesional
   (`/psychologist/patients/[patientId]/timeline`) agregar un **filtro
   rápido** "Solo comidas" (`entryKind=MEAL`) para que el profesional
   pueda escanear las ingestas del día/semana.
2. Agregar una **vista por día** (agrupada) que cruce la agenda mock
   contra los registros reales del cliente, parecida a `/patient/today`
   pero desde el lado profesional. Sin schedules persistidos todavía:
   reutilizar el mismo array mock o moverlo a un módulo compartido.
3. Mostrar cuántas comidas registradas vs. esperadas tiene el cliente en
   el día y en la semana. Sin "adherencia" todavía (eso es PB-10), solo
   conteos descriptivos.
4. No tocar Prisma en PB-7. Si surge la necesidad de `MealSchedule`,
   pasarlo a PB-7.5 documental.
5. Documentar en `docs/pb-7-resultado-vista-profesional-bitacora.md`.

Esto deja al profesional con visibilidad concreta sobre las comidas
registradas antes de avanzar a peso/medidas (PB-8) y ejercicio (PB-9).
