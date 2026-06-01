# PB-8B — Resultado: registro de peso y medidas

Microciclo: **PB-8B**
Base: `docs/pb-8a-decision-tecnica-peso-medidas.md` (Alternativa B).
Referencias: PB-3, PB-4, PB-5, PB-6, PB-7.

## Objetivo

Permitir al paciente registrar **peso**, **medidas corporales** (cintura,
cadera, pecho, brazo), **foto de progreso** y notas; y al profesional
ver un bloque básico con las últimas mediciones en su vista del
paciente. Sin tocar `TimelineEntry`.

---

## Decisión técnica aplicada

Alternativa B de PB-8A: **`MeasurementEntry` dedicado**, separado de
`TimelineEntry`.

- `TimelineEntry.mediaType` y `TimelineEntry.mediaKey` siguen siendo
  NOT NULL — el invariante "TimelineEntry = registro con archivo" se
  preserva.
- `MeasurementEntry.mediaKey` y `mediaType` nacen **opcionales** —
  habilitan registros puramente numéricos (peso, medidas) y también
  foto de progreso.
- Migración estrictamente aditiva: un `CREATE TYPE` + un `CREATE TABLE`
  + dos índices + dos FKs. Cero ALTER sobre tablas existentes.

---

## Archivos modificados

- `prisma/schema.prisma` — enum `MeasurementType`, modelo
  `MeasurementEntry`, relaciones `measurementsAsPatient` /
  `measurementsAsPsych` en `User`.
- `prisma/migrations/20260601140000_add_measurement_entry/migration.sql`
  — migración nueva.
- `src/lib/measurements.ts` — helper (labels, unidad default,
  numeric check, slug ⇄ enum, formateo).
- `src/app/api/patient/measurements/route.ts` — endpoint nuevo
  `POST` con validación por tipo.
- `src/app/patient/measurements/new/page.tsx` — vista paciente.
- `src/app/patient/measurements/new/measurement-form.tsx` — form
  cliente (selector tipo + valor + unidad auto + foto opcional + nota).
- `src/app/patient/today/page.tsx` — el ítem `weight` cambia de
  `OUT_OF_SCOPE` a `PENDING` con link a `/patient/measurements/new?type=weight`.
- `src/app/psychologist/patients/[patientId]/timeline/page.tsx` —
  bloque "Peso y medidas" con últimas 3 mediciones.
- `docs/pb-8b-resultado-peso-medidas.md` — este documento.

**No se tocó** `TimelineEntry`, `/api/patient/entries` ni el flujo
de comidas (PB-6/PB-7).

---

## Modelo creado

```prisma
enum MeasurementType {
  WEIGHT
  WAIST
  HIP
  CHEST
  ARM
  PROGRESS_PHOTO
  CUSTOM
}

model MeasurementEntry {
  id             String          @id @default(cuid())
  patientId      String
  psychologistId String
  type           MeasurementType
  value          Float?
  unit           String?
  mediaKey       String?
  mediaType      MediaType?
  note           String?
  recordedAt     DateTime
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  patient      User @relation("MeasurementsAsPatient", fields: [patientId], references: [id], onDelete: Cascade)
  psychologist User @relation("MeasurementsAsPsych",   fields: [psychologistId], references: [id])

  @@index([patientId, recordedAt])
  @@index([psychologistId, recordedAt])
}
```

Y en `User`:

```prisma
measurementsAsPatient MeasurementEntry[] @relation("MeasurementsAsPatient")
measurementsAsPsych   MeasurementEntry[] @relation("MeasurementsAsPsych")
```

---

## Migración creada

`prisma/migrations/20260601140000_add_measurement_entry/migration.sql`:

- `CREATE TYPE "MeasurementType"` con 7 valores.
- `CREATE TABLE "MeasurementEntry"` con PK `id`.
- 2 índices: `(patientId, recordedAt)` y `(psychologistId, recordedAt)`.
- 2 FKs: `patientId → User(id) ON DELETE CASCADE` y
  `psychologistId → User(id) ON DELETE RESTRICT`.

**No se ejecutó contra ninguna base real.** Es aditiva y no toca
`TimelineEntry`, `MediaType`, `EntryKind`, `MealSlot` ni ningún
otro modelo existente.

---

## Endpoint creado

`POST /api/patient/measurements`

Body (zod):

```ts
{
  type: "WEIGHT" | "WAIST" | "HIP" | "CHEST" | "ARM" | "PROGRESS_PHOTO" | "CUSTOM";
  value?: number;      // > 0, < 1000
  unit?: string;
  mediaKey?: string;
  mediaType?: "PHOTO";
  note?: string;       // max 500
  recordedAt?: string; // ISO; default now()
}
```

Auth: `requireRole("PATIENT")`. `psychologistId` se deriva de
`PatientProfile`. Devuelve `{ id }`.

### Reglas de validación

| type             | regla                                                                  |
|------------------|------------------------------------------------------------------------|
| WEIGHT           | `value` requerido; `unit` forzada a `kg`.                              |
| WAIST/HIP/CHEST/ARM | `value` requerido; `unit` forzada a `cm`.                            |
| PROGRESS_PHOTO   | `mediaKey` requerido + `mediaType=PHOTO`.                              |
| CUSTOM           | al menos uno de `value`, `note` o `mediaKey`.                          |
| cualquier media  | `mediaKey` debe comenzar con `patients/<user.id>/`.                    |
| cualquier media  | si hay `mediaKey`, sólo se acepta `PHOTO` (audio/video rechazados).    |
| note             | hasta 500 caracteres.                                                  |
| value            | numérico finito positivo < 1000 (sanity).                              |

Errores 400 con mensajes en español. 403 si `mediaKey` no pertenece
al paciente.

### Subida de foto

Reutiliza el flujo S3 existente: el cliente llama a
`POST /api/patient/entries` con `action=init` y `mediaType=PHOTO`
para obtener la URL presigned PUT; sube el archivo a esa URL; y
luego envía `mediaKey` (con prefijo `patients/<user.id>/`) en
`POST /api/patient/measurements`. **No se creó infraestructura
nueva de S3** ni se modificó `/api/patient/entries`.

---

## Vista paciente

`/patient/measurements/new` (server) + `measurement-form.tsx` (client):

- Lee `?type=weight|waist|hip|chest|arm|progress-photo|custom` del
  query (`typeFromSlug`). Default: `WEIGHT`.
- Selector visual de los 7 tipos.
- Input numérico (`step=0.1`, `inputMode=decimal`) cuando aplica.
  Label muestra unidad automática (`kg`/`cm`).
- Input file (`accept=image/* capture=environment`):
  - **Obligatorio** para `PROGRESS_PHOTO`.
  - **Opcional** para `CUSTOM`.
  - Oculto para los tipos numéricos puros (no se permite foto en
    peso/medidas para no mezclar UX).
- Nota opcional (hasta 500).
- Al guardar: si hay foto → `init` + `PUT` + `complete`. Si no →
  `POST` directo a `/api/patient/measurements`.
- Redirige a `/patient/today` con `router.refresh()`.

### Acceso

- `/patient/today` → ítem `Peso / medidas` ahora muestra botón
  **Registrar** que linkea a `/patient/measurements/new?type=weight`.
- No se agregó link en el nav global (sale de scope; queda a tiro
  desde `/patient/today`).

---

## Vista profesional

Dentro de `/psychologist/patients/[patientId]/timeline`, segundo
bloque debajo de "Bitácora de comidas":

- Encabezado: **"Peso y medidas"**.
- Si no hay mediciones: `"Todavía no hay peso o medidas registradas."`
- Si hay: lista de las **últimas 3** mediciones ordenadas por
  `recordedAt desc`, con label de tipo + valor formateado + hora
  + nota (si hay).
  - Ej: *"Peso · 74.5 kg · 08:12"*.
  - Ej: *"Cintura · 82 cm · 09:00 · 'en ayunas'"*.

Query mínima adicional (no rompe ni mezcla con `TimelineEntry`):

```ts
prisma.measurementEntry.findMany({
  where: { patientId: params.patientId, psychologistId: user.id },
  orderBy: { recordedAt: "desc" },
  take: 3,
  select: { id: true, type: true, value: true, unit: true, note: true, recordedAt: true },
});
```

No se incluye foto de progreso en el bloque (evita exponer thumbnails
de imágenes corporales sin click expreso). Las fotos se ven al
detalle cuando se sume una vista dedicada de mediciones (PB-8C o
PB-9).

---

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀`.
- `npx prisma generate` — cliente regenerado OK con `measurementEntry`.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK, 20 rutas, sin errores TS.
  - Aparecen `/api/patient/measurements` y `/patient/measurements/new`.

No hay tests configurados en el repo.

---

## Qué quedó fuera de alcance

- **`MealEntry`**, **`ExerciseEntry`** dedicados — no.
- **`MeasurementSchedule`**, **`ClientPlan`**, **`Reminder`** — no.
- **Edición / borrado** de mediciones — no.
- **Gráficos / evolución / sparkline** — no.
- **Vista paciente de historial** de mediciones — no (solo la creación).
- **Vista profesional dedicada** `/psychologist/.../measurements` — no
  (solo bloque dentro del timeline).
- **Conversión de unidades** (`lb`/`in`) — no. Solo `kg`/`cm`.
- **Análisis de imagen corporal / IA** — no.
- **Recordatorios** push/WhatsApp/email — no.
- **Renombrado de rutas o roles** — no.
- **Railway, secrets, `.env`, deploy, producción** — no se tocó.

---

## Riesgos

- **`mediaKey` nullable** en `MeasurementEntry`: por diseño;
  permite registros numéricos puros. No se propagó a `TimelineEntry`
  (sigue NOT NULL).
- **`Float` para peso/medidas**: suficiente para uso humano.
  Migrar a `Decimal(6,2)` si surge requerimiento clínico.
- **Unidades hard-coded**: hoy server fuerza `kg`/`cm` según tipo.
  Para soportar `lb`/`in` habrá que convertir en server antes de
  persistir.
- **Timezone del `recordedAt`**: server usa hora local del proceso
  Node. Mismo límite documentado desde PB-5/PB-6/PB-7. Se cierra
  con `timezone` por cliente.
- **Sensibilidad de fotos corporales**: bucket privado + URL
  firmada (mismo `presignDownload` del resto). Bloque profesional
  no muestra thumbnails para evitar previews inesperados.
- **Duplicados del mismo día**: dos pesos en el mismo día se
  guardan ambos. Decisión deliberada; deduplicar exige reglas
  arbitrarias. El profesional ve los dos en el listado.
- **Falta de edición/historial editable**: un dato cargado mal se
  resuelve cargando de nuevo. Sin endpoint de delete/update aún.
- **Reutilización de `/api/patient/entries` init**: el endpoint de
  comidas hoy genera la URL presigned PUT también para fotos de
  progreso. Funciona porque el contrato es genérico (`mediaType`
  + `contentType` + `sizeBytes`). Si en algún futuro
  `/api/patient/entries` agrega validaciones específicas de comida
  en `init`, habría que extraer un endpoint `POST /api/patient/media/init`
  compartido. Hoy no es necesario.
- **No hay marca de "registrado hoy"** para el ítem `weight` en
  `/patient/today` (la lógica análoga a comidas queda fuera de
  scope; alcanza con el link a la creación).

---

## Confirmación de alcance

- `TimelineEntry` **no fue modificado** (ni columnas, ni reglas, ni
  endpoints, ni vistas de comida).
- `MediaType`, `EntryKind`, `MealSlot` no fueron modificados.
- `/api/patient/entries` **no fue modificado**.
- Auth y permisos: `requireRole("PATIENT")` y
  `requireRolePage("PSYCHOLOGIST")` + check `psychologistId ===
  user.id` se mantienen idénticos al patrón existente.
- No se crearon `MealEntry`, `ExerciseEntry`, `MeasurementSchedule`,
  `ClientPlan` ni `Reminder`.
- No se tocó Railway, secrets, `.env`, deploy ni producción.
- No se ejecutó migración contra ninguna base real.

---

## Recomendación para PB-8C / PB-9

Sub-pasos sugeridos para iterar peso y medidas (PB-8C) **antes**
de ejercicio (PB-9):

1. **Listado histórico de mediciones** para el paciente
   (`/patient/measurements` simple) y para el profesional
   (`/psychologist/patients/[patientId]/measurements`), con filtro
   por tipo. Solo lectura, sin gráficos.
2. **Thumbnail con URL firmada** para foto de progreso en una
   vista dedicada (no en el bloque resumen). Requiere abrirla con
   click expreso.
3. **Marca "registrado hoy"** en `/patient/today` para el ítem
   `weight`, análoga a la de comidas (segunda query sobre
   `MeasurementEntry` con `recordedAt` en el día).
4. **Edición/borrado** de la última medición del día (corrección
   típica de error de tipeo) sin abrir historial completo.

Si el equipo prefiere saltar a ejercicio, **PB-9 — Ejercicio**
puede reutilizar el patrón exacto: `ExerciseEntry` dedicado
(`type`, `durationMinutes`, `note`, `mediaKey?`), endpoint
`POST /api/patient/exercises`, página `/patient/exercises/new`,
bloque profesional. La decisión técnica de PB-8A vale para
ejercicio también: no extender `TimelineEntry` con dimensiones que
no son archivo.
