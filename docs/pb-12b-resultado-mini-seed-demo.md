# PB-12B — Resultado: mini-seed demo de Pulso Body

Microciclo: **PB-12B**
Base: PB-12A (runbook + guion + checklist de gaps).

## Objetivo

Extender `prisma/seed.ts` para que Pulso Body arranque con datos
mínimos visibles del lado paciente y profesional, sin
intervención manual previa a la demo. Sin tocar schema ni
producción.

## Datos agregados al seed

Aplicados **solo a Paciente Demo 1** (Paciente Demo 2 queda
"en blanco" para escenarios diferenciados):

### `MealSchedule` (4)

| `mealSlot` | `targetTime` | `daysOfWeek`         |
|------------|--------------|----------------------|
| BREAKFAST  | 08:00        | L–V (`[1,2,3,4,5]`)  |
| LUNCH      | 13:30        | L–V                  |
| SNACK_PM   | 17:00        | L–V                  |
| DINNER     | 21:00        | Todos los días       |

`status = ACTIVE` (default), `note = "Seed demo PB-12B"`.

### `MeasurementEntry` (2)

- `WEIGHT = 84.5 kg`
- `WAIST = 98 cm`

`recordedAt = new Date()` al momento del seed, `note = "Seed demo PB-12B"`.

### `ExerciseEntry` (1)

- `WALK · 30 min · MEDIUM`, `recordedAt = new Date()`,
  `note = "Seed demo PB-12B"`.

## Criterio de idempotencia

Cada bloque hace `findFirst` antes de `create`:

- **`MealSchedule`**: busca por `(patientId, mealSlot, targetTime)`.
  Si existe, no duplica.
- **`MeasurementEntry`**: busca por `(patientId, type, note = SEED_MARKER)`.
  El marker `"Seed demo PB-12B"` actúa como discriminador frente
  a mediciones reales cargadas por el paciente.
- **`ExerciseEntry`**: busca por `(patientId, type = "WALK", note = SEED_MARKER)`.
  Mismo criterio.

Resultado: `npx prisma db seed` se puede correr múltiples veces
sin duplicar nada. **No** borra datos existentes.

## Qué queda fuera de scope

- **Comidas con foto** (`TimelineEntry entryKind = MEAL`,
  `mediaType = PHOTO`). Requieren `mediaKey` real en S3/R2; sin
  un archivo subido al bucket, los presigned-get devuelven 404 y
  los thumbnails fallan. Queda como acción manual en el guion
  de demo (PB-12A §5).
- **`TimelineEntry` no-meal**: el seed legacy ya crea 4 entries
  AUDIO/VIDEO; no se tocan.
- **Paciente Demo 2**: deliberadamente sin schedules ni datos
  para que se pueda mostrar el contraste "con/sin programación"
  durante la demo (`/patient/today` cae al fallback mock,
  `/today` profesional muestra "Sin comidas programadas").
- **S3/R2**: ningún cambio.

## Cómo probarlo localmente

Pre-requisitos: `.env` con `DATABASE_URL` apuntando a una
Postgres válida y `AUTH_SECRET` setteado.

```bash
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Verificación visual:

1. Login como **Profesional demo** →
   `/psychologist/patients/[id-de-paciente1]/meal-schedules` →
   ver 4 schedules activos.
2. Login como **Paciente Demo 1** →
   - `/patient/today` muestra 4 slots (Desayuno/Almuerzo/
     Merienda/Cena) con su estado calculado (`PENDIENTE` /
     `REGISTRADO_TARDE` / `OMITIDO` según la hora del día).
   - `/patient/measurements` muestra peso 84.5 kg y cintura
     98 cm.
   - `/patient/exercises` muestra caminata 30 min.
3. **Profesional** en `/psychologist/.../today` ve:
   - "Adherencia de comidas: 0/N registradas" (porque no hay
     comidas registradas todavía).
   - "Peso y medidas de hoy: 2 registros".
   - "Ejercicio de hoy: 1 actividad · 30 min".
4. **Profesional** en `/psychologist/.../week` ve la línea
   "Adherencia comidas" en el día actual con los slots.
5. **Login como Paciente Demo 2** → `/patient/today` cae al
   fallback mock (sin schedules).

Re-ejecutar `npx prisma db seed` no duplica nada.

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀` (schema sin
  cambios).
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK.
- `npx tsc --noEmit -p tsconfig.json` — sin errores (incluye el
  seed).
- **`npx prisma db seed` NO ejecutado**: no hay base local
  disponible en el entorno de este microciclo. La validación
  funcional con datos queda para la demo real.

## Riesgos

- **Hora del seed**: `recordedAt = new Date()` en
  `MeasurementEntry` y `ExerciseEntry` se ancla al momento de
  correr el seed. Si la demo es horas después, los registros
  siguen mostrándose en `/today` mientras estén dentro del día.
  Después del cambio de día quedan fuera del bloque "hoy" pero
  visibles en `/measurements` y `/exercises`.
- **Marker `note = "Seed demo PB-12B"`**: si un paciente real
  cargara una nota con ese texto exacto, el findFirst la
  detectaría como "seed existente" y no se re-crearía. Riesgo
  muy bajo en demo. Mitigación futura: usar un prefijo más
  específico o un campo dedicado.
- **Schedules anclados a L-V + Cena todos los días**: si la demo
  cae en fin de semana, solo aparece Cena en
  `/patient/today` del fallback profesional. Documentado en el
  guion.
- **Cambios futuros del modelo**: si se agrega una columna NOT
  NULL a `MealSchedule`/`MeasurementEntry`/`ExerciseEntry` en el
  futuro, hay que actualizar este seed.
- **No se ejecutó el seed** en este microciclo: la idempotencia
  está implementada y verificada por tipo, pero no probada
  contra una DB real. Riesgo bajo.

## Próximo paso recomendado

Dos caminos razonables:

1. **PB-12C — Script `db:demo-reset`**: agregar a `package.json`
   un script que combine `prisma migrate reset --force` + `prisma
   db seed`, documentado para iterar demos consecutivas.
   Estricto dev-only.
2. **PB-13 — Comidas con foto en seed**: subir 1-2 fotos
   placeholder al bucket demo y referenciarlas desde
   `TimelineEntry entryKind = MEAL` para que el resumen
   profesional muestre adherencia "registrada" sin acción
   manual. Requiere coordinar bucket demo y `S3_PUBLIC_BASE_URL`.

Si la demo de PB-12B + carga manual de la comida funciona bien,
**PB-12C** alcanza. Si se quiere una demo 100% auto-poblada,
**PB-13**.

## Confirmación de alcance

- `prisma/schema.prisma` **no modificado**.
- Migraciones **no creadas**.
- Modelos **no modificados**.
- Endpoints, UI, auth **sin cambios**.
- S3/R2 **no tocado**.
- Railway, secrets, `.env`, deploy, producción **sin cambios**.
- Paciente Demo 2 **no recibe datos**: queda como escenario en
  blanco.
