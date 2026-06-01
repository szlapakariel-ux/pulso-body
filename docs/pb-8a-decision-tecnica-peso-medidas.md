# PB-8A — Decisión técnica de peso y medidas

Microciclo: **PB-8A** (documental, sin código).
Referencias: `docs/pb-3-modelo-prisma-objetivo.md`,
`docs/pb-6-resultado-registro-comida-foto.md`,
`docs/pb-7-resultado-vista-profesional-bitacora.md`.

## Objetivo

Decidir, antes de tocar Prisma, la forma técnica más segura para
representar **peso y medidas** en Pulso Body. PB-6/PB-7 reutilizaron
`TimelineEntry` para comidas porque toda comida tiene foto. Las
mediciones rompen ese supuesto: pueden ser puramente numéricas. Este
documento evalúa alternativas y propone la implementación de PB-8B.

---

## 1. Estado actual relevante

`prisma/schema.prisma` (verificado en esta rama):

```prisma
model TimelineEntry {
  id             String    @id @default(cuid())
  patientId      String
  psychologistId String
  title          String
  mediaType      MediaType        // OBLIGATORIO
  mediaKey       String           // OBLIGATORIO
  mediaUrl       String?
  recordedAt     DateTime?
  contextLabel   String?
  contextNote    String?
  aiTitle        String?
  aiSummary      String?
  aiStatus       AiStatus  @default(NOT_REQUESTED)
  entryKind      EntryKind @default(GENERIC)   // GENERIC | MEAL
  mealSlot       MealSlot?                      // BREAKFAST | … | CUSTOM
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  …
}

enum MediaType { AUDIO  VIDEO  PHOTO }
enum EntryKind { GENERIC  MEAL }
enum MealSlot  { BREAKFAST  SNACK_AM  LUNCH  SNACK_PM  DINNER  CUSTOM }
```

Lectura clave: **`mediaType` y `mediaKey` son NOT NULL**. Toda fila
de `TimelineEntry` está atada a un archivo subido a S3/R2. Las comidas
encajaron bien porque siempre llevan foto (PB-6 valida que
`entryKind=MEAL ⇒ mediaType=PHOTO`).

Uso actual:
- `/patient/new-entry?intent=meal&slot=…` → crea `TimelineEntry`
  con `entryKind=MEAL`, `mealSlot`, `mediaType=PHOTO`.
- `/patient/today` cruza la agenda mock contra `TimelineEntry` del
  día para marcar slots registrados.
- `/patient/timeline` y `/psychologist/.../timeline` renderizan el
  feed con badge "Comida · Slot" cuando corresponde.
- PB-7 agregó resumen diario + filtro `?filter=meals` en el panel
  profesional, también sobre `TimelineEntry`.

Relaciones: `patient` y `psychologist` por `userId`. No hay aún
`ClientPlan`, `MealSchedule`, `MeasurementSchedule` ni `Reminder`.

---

## 2. Problema técnico

Peso y medidas no son isomorfas a una comida:

- **Pueden no tener foto**. Peso = `74.5 kg`, sin archivo.
- **Llevan valor numérico** (`Float` / `Decimal`).
- **Llevan unidad** (`kg`, `cm`).
- **Foto de progreso** es un caso especial donde sí hay archivo,
  pero el "dato" puede ser solo la imagen (sin número) o la imagen
  + nota.
- **Frecuencia futura**: pesarse semanalmente, medidas cada 2-4
  semanas → más adelante habrá `MeasurementSchedule`.
- **Historial y privacidad** son más sensibles: fotos corporales
  exigen el mismo bucket privado + URL firmada que hoy, pero con
  menor tolerancia a fugas.

Si forzamos todo dentro de `TimelineEntry`, hay que volver
`mediaType` y `mediaKey` opcionales — y eso afecta a **todas las
filas existentes** y a todos los call-sites que asumen archivo
presente.

---

## 3. Alternativas evaluadas

### Alternativa A — Extender `TimelineEntry`

Agregar al modelo actual:

- `entryKind` agrega `MEASUREMENT`.
- `measurementType MeasurementType?`
- `measurementValue Float?`
- `measurementUnit String?`
- `measurementNote String?`
- **Hacer `mediaType` y `mediaKey` opcionales** (`?`).

**Pros**
- Reutiliza el feed que ya existe (un solo `findMany` para todo).
- Una sola migración para una tabla.
- Vista profesional puede listar mediciones intercaladas sin
  juntar dos queries.

**Contras**
- Hay que hacer `mediaKey`/`mediaType` nullable → toca columnas
  NOT NULL existentes. Migración chica pero **no inocua**
  (cambia el contrato del modelo para todos los call-sites).
- Mezcla semántica: una fila puede no tener archivo, lo que rompe
  el invariante "TimelineEntry = archivo subido".
- Toda la lógica de `presignDownload(e.mediaKey)` y de renderizado
  por `mediaType` necesita guardas extra (`if (e.mediaKey)`).
- `EntryControls` (notas, transcripción, IA) está pensado para
  registros con media. Para mediciones hay que filtrar.
- Si mañana surge `MeasurementSchedule`, esa relación apunta a un
  modelo que mezcla todo — más difícil de razonar.
- Aumenta la superficie de error para filtros existentes
  (`entryKind=MEAL` queda OK, pero `?filter=measurements` empieza
  a competir con la realidad de las queries).

### Alternativa B — `MeasurementEntry` mínimo dedicado

Modelo separado, con foto **opcional**:

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

  patient        User @relation("MeasurementsAsPatient", fields: [patientId], references: [id], onDelete: Cascade)
  psychologist   User @relation("MeasurementsAsPsych",   fields: [psychologistId], references: [id])

  @@index([patientId, recordedAt])
  @@index([psychologistId, recordedAt])
}
```

Y en `User`:

```prisma
measurementsAsPatient MeasurementEntry[] @relation("MeasurementsAsPatient")
measurementsAsPsych   MeasurementEntry[] @relation("MeasurementsAsPsych")
```

**Pros**
- Datos numéricos quedan limpios; no se rompe el invariante de
  `TimelineEntry` (sigue siendo un registro con archivo).
- `mediaKey` opcional desde el principio → no hay que tocar columnas
  existentes para volverlas nullable.
- Prepara naturalmente `MeasurementSchedule` (FK a `MeasurementEntry`
  o a un tipo). Misma forma que `MealSchedule` futuro.
- No interfiere con notas/transcripción/IA pensadas para audio/video.
- Migración aditiva pura: nuevo enum + nueva tabla. No-destructiva.
- Permite endpoint propio (`/api/patient/measurements`) con reglas
  claras por tipo (peso requiere número, foto requiere mediaKey, etc.).
- Vista profesional puede tener un bloque "Peso y medidas" propio,
  paralelo al bloque "Bitácora de comidas" de PB-7.

**Contras**
- Un modelo más antes de lo que sugería PB-3 (que listaba
  `MeasurementEntry` como meta, no como paso inmediato).
- Vista paciente queda con dos rutas (`/patient/new-entry` para
  comidas/genérico, `/patient/measurements/new` para medidas).
  Aceptable: la UX es distinta de todas formas.
- Levanta superficie de auth/permiso a duplicar (mismo patrón
  `requireRole`/`patientId`/`psychologistId`).

### Alternativa C — Solo UI mock, sin persistencia

Mostrar inputs y guardar nada (o guardar en sessionStorage).

**Pros**
- Riesgo cero a nivel datos.
- Sirve para validar UX.

**Contras**
- No aporta valor real. El profesional no ve nada.
- Posterga PB-8 sin razón técnica fuerte (la alternativa B ya es
  segura).
- Dejaría a `/patient/today` con un slot "Peso / medidas" que sigue
  siendo `OUT_OF_SCOPE` sin avance real.

---

## 4. Decisión recomendada

**Adoptar Alternativa B: `MeasurementEntry` dedicado.**

Justificación apoyada en el schema verificado:

- `TimelineEntry.mediaType` y `TimelineEntry.mediaKey` son **NOT
  NULL** hoy. Extender el modelo (Alt. A) exige hacer ambas
  columnas nullable: cambio de contrato sobre datos existentes y
  sobre todos los call-sites (`presignDownload`, `EntryControls`,
  los dos timelines, el filtro de PB-7, los endpoints de IA y
  transcripción). El criterio dejado por PB-7 (sección "Riesgos")
  ya anticipaba que un segundo cambio sobre `TimelineEntry`
  ameritaba revisarse.
- Las mediciones no comparten la lógica de notas privadas /
  transcripción / IA descriptiva. Mantener `TimelineEntry` puro
  como "registro con archivo" simplifica auditar quién toca qué.
- La migración queda **estrictamente aditiva**: un enum nuevo, una
  tabla nueva, sin alterar columnas existentes. Es lo más cerca
  posible de "cero riesgo" sobre datos en producción.
- Habilita endpoint propio (`POST /api/patient/measurements`) con
  reglas por tipo sin contaminar la validación actual de
  `/api/patient/entries` (que ya tiene la lógica `MEAL ⇒ PHOTO`).

Alternativa C queda descartada: el costo de Alt. B es bajo y el
valor entregado (peso y medidas reales) es alto.

---

## 5. Modelo recomendado para PB-8B

Schema propuesto (ajustar nombres de relación si hay colisión con
las existentes `EntriesAsPatient` / `EntriesAsPsych`):

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

Y en `model User`:

```prisma
measurementsAsPatient MeasurementEntry[] @relation("MeasurementsAsPatient")
measurementsAsPsych   MeasurementEntry[] @relation("MeasurementsAsPsych")
```

Notas:
- `value Float?` — suficiente para peso/medidas humanos. Si más
  adelante hace falta precisión exacta (ej. balanzas clínicas),
  migrar a `Decimal(6,2)`.
- `unit String?` — abierto pero la API debe normalizar a `kg` o
  `cm` según `type` (ver §7).
- `recordedAt DateTime` (no nullable como en `TimelineEntry`): la
  medición se ancla siempre a un momento. El cliente puede no
  enviarlo y el server lo setea a `now()`.
- `mediaKey` / `mediaType` opcionales — habilitan `PROGRESS_PHOTO`
  con foto, y permiten foto adjunta a otros tipos en el futuro
  sin más cambios.

Migración Prisma esperada (PB-8B):

```sql
CREATE TYPE "MeasurementType" AS ENUM
  ('WEIGHT','WAIST','HIP','CHEST','ARM','PROGRESS_PHOTO','CUSTOM');

CREATE TABLE "MeasurementEntry" (
  "id"             TEXT PRIMARY KEY,
  "patientId"      TEXT NOT NULL,
  "psychologistId" TEXT NOT NULL,
  "type"           "MeasurementType" NOT NULL,
  "value"          DOUBLE PRECISION,
  "unit"           TEXT,
  "mediaKey"       TEXT,
  "mediaType"      "MediaType",
  "note"           TEXT,
  "recordedAt"     TIMESTAMP(3) NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeasurementEntry_patient_fkey"
    FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "MeasurementEntry_psych_fkey"
    FOREIGN KEY ("psychologistId") REFERENCES "User"("id")
);

CREATE INDEX "MeasurementEntry_patient_recordedAt_idx"
  ON "MeasurementEntry"("patientId","recordedAt");
CREATE INDEX "MeasurementEntry_psych_recordedAt_idx"
  ON "MeasurementEntry"("psychologistId","recordedAt");
```

Aditiva, no destructiva, no toca `TimelineEntry`.

---

## 6. Rutas recomendadas

### Paciente

- `/patient/measurements/new` — nueva.
  - Selector de `type`.
  - Input numérico + unidad sugerida según `type`.
  - Foto opcional (obligatoria si `type = PROGRESS_PHOTO`).
  - Nota opcional.
  - `recordedAt` se setea en server al guardar.

No reutilizar `/patient/new-entry`: la UX (sin foto, con número y
unidad) es lo suficientemente distinta como para que mezclar el
form sea más caro que separarlo.

- (opcional, PB-8B+) `/patient/measurements` — listado simple para
  el cliente. Puede postergarse si solo aparece desde
  `/patient/timeline`.

### Profesional

- Bloque dentro de `/psychologist/patients/[patientId]/timeline`,
  análogo al bloque "Bitácora de comidas" de PB-7.
- (opcional) `/psychologist/patients/[patientId]/measurements` para
  historial completo. Postergable a PB-9+ si el bloque alcanza.

### `/patient/today`

- El item `weight` (`OUT_OF_SCOPE` hoy) pasa a apuntar a
  `/patient/measurements/new?type=weight`.

---

## 7. API recomendada

**`POST /api/patient/measurements`**

Body:
```ts
{
  type:       "WEIGHT" | "WAIST" | "HIP" | "CHEST" | "ARM" | "PROGRESS_PHOTO" | "CUSTOM";
  value?:     number;
  unit?:      string;
  mediaKey?:  string;     // viene del flujo init/complete S3
  recordedAt?: string;    // ISO; opcional, default now()
  note?:      string;
}
```

Reglas de validación server (400 si no se cumplen):

| type            | value | unit         | mediaKey         | note      |
|-----------------|-------|--------------|------------------|-----------|
| WEIGHT          | req.  | "kg"         | opcional         | opcional  |
| WAIST/HIP/CHEST/ARM | req. | "cm"      | opcional         | opcional  |
| PROGRESS_PHOTO  | opc.  | opc.         | **requerido**    | opcional  |
| CUSTOM          | uno de value/note requerido | libre | opcional | opcional |

Normalización:
- `WEIGHT` → forzar `unit = "kg"` si llega vacío.
- `WAIST/HIP/CHEST/ARM` → forzar `unit = "cm"` si llega vacío.
- `value`: validar finito, `> 0`, y `< 1000` (sanity check).
- `recordedAt`: si está, parsear ISO; si no, `new Date()`.
- `psychologistId`: derivado del `patientProfile` del usuario (mismo
  patrón que `/api/patient/entries`).

Para `PROGRESS_PHOTO` se reutiliza el flujo S3 ya existente:
- `POST /api/patient/media/init` → presigned PUT (igual que comidas).
- Cliente sube el archivo.
- `POST /api/patient/measurements` con `mediaKey`, `mediaType="PHOTO"`.

No agregar IA ni transcripción aquí.

---

## 8. Vista paciente recomendada

`/patient/measurements/new`:

- Header: "Registrar peso / medidas".
- Selector `type` (radio o tabs):
  - Peso · Cintura · Cadera · Pecho · Brazo · Foto de progreso · Otro.
- Si `type` numérico → input `number` + label de unidad fija.
- Si `type = PROGRESS_PHOTO` → input file `accept="image/*"
  capture="environment"` (mismo patrón que comida).
- Nota opcional (`textarea`).
- Botón Guardar → `POST /api/patient/measurements`.
- Al éxito → redirect a `/patient/timeline` o `/patient/today`.

Acceso:
- Desde `/patient/today` (slot Peso / medidas).
- (opcional) Link en nav: "Medidas".

---

## 9. Vista profesional recomendada

Dentro de `/psychologist/patients/[patientId]/timeline`, agregar un
bloque **"Peso y medidas"** análogo al de PB-7:

- Última medición: `Peso · 74.5 kg · hoy 08:12`.
- Última foto de progreso (si hay): thumbnail con URL firmada.
- Mini-listado de las últimas 5 mediciones por tipo (texto, sin
  gráfico todavía).
- Sin gráficos (queda para PB-9+). Si llegara a sumarse, que sea un
  sparkline simple de peso, no más.

Query mínima:

```ts
prisma.measurementEntry.findMany({
  where: { patientId, psychologistId: user.id },
  orderBy: { recordedAt: "desc" },
  take: 20,
});
```

No mezclar con `TimelineEntry` en el mismo `findMany`: dos queries
server-side, como ya se hace en PB-7.

---

## 10. Privacidad

- Las fotos de progreso son **más sensibles** que las de comida.
  Mismo bucket privado + URL firmada (1h) que hoy. No exponer
  `mediaKey` al cliente.
- No hacer análisis automático de imagen corporal (sin IA, sin
  estimación de composición, sin recomendaciones).
- No mostrar fotos de progreso en thumbnails de listados que se
  carguen en background sin click expreso (evitar previews
  inesperados).
- `recordedAt` y `value` quedan dentro del scope `patientId +
  psychologistId`; mismo `requireRole` + `psychologistId === user.id`
  check que ya usa `/psychologist/.../timeline`.
- Logs: no loguear `mediaKey` ni `value` en server logs.

---

## 11. Migración segura para PB-8B

- `npx prisma format` y `prisma validate` antes de generar.
- `npx prisma migrate dev --name add_measurement_entry` en local
  o `prisma migrate diff` para escribir el SQL manual si seguimos
  la convención de PB-4/PB-6 (migraciones creadas a mano).
- **No ejecutar contra DB real**. La migración queda en disco
  para que el deploy formal la corra cuando corresponda.
- Validar `prisma validate`, `npm run lint`, `npm run build`.
- No tocar `TimelineEntry`, `MediaType`, `EntryKind`, `MealSlot`.

---

## 12. Riesgos

- **`mediaKey` nullable**: en `MeasurementEntry` nace nullable, sin
  problema. No replicar para `TimelineEntry` — confundir scopes
  rompe invariantes existentes.
- **Mezcla con `TimelineEntry`**: no hacerlo. Mantener tablas
  separadas. Si en algún futuro hace falta un feed unificado, se
  resuelve con un `union` en server, no fusionando tablas.
- **`Float` para peso/medidas**: suficiente, sabiendo que la
  representación es aproximada. Si aparece requerimiento clínico,
  migrar a `Decimal(6,2)` en el momento.
- **Unidades futuras**: hoy normalizamos a `kg`/`cm`. Si entra
  `lb`/`in`, agregar conversión en server antes de persistir
  (siempre guardar en métrico).
- **Timezone del `recordedAt`**: mismo riesgo que PB-5/PB-6/PB-7.
  Server usa timezone del proceso Node. Cierre real cuando exista
  `timezone` por cliente.
- **Sensibilidad fotos corporales**: bucket privado + URL firmada.
  Documentado en §10.
- **Duplicados del mismo día** (dos pesos en el mismo día): se
  permiten. El profesional ve los dos. Deduplicar exige reglas
  arbitrarias; mejor no hacerlo todavía.
- **Falta de edición/historial editable**: no se incluye en PB-8B.
  Borrar/editar queda fuera de scope. Riesgo bajo: un cliente que
  cargó mal puede cargar de nuevo; el profesional lo ve.
- **Falta de `MeasurementSchedule`**: la frecuencia esperada
  (semanal/quincenal) no se modela todavía. PB-8B describe, no
  prescribe.

---

## 13. Recomendación final para PB-8B

Implementar Alternativa B con el alcance mínimo siguiente:

**Archivos a tocar**
- `prisma/schema.prisma` — agregar enum `MeasurementType`, modelo
  `MeasurementEntry`, relaciones en `User`.
- `prisma/migrations/<timestamp>_add_measurement_entry/migration.sql`
  — nueva, aditiva.
- `src/lib/measurement-types.ts` — helper análogo a
  `meal-slots.ts` (label, unidad por defecto, validaciones de
  rango).
- `src/app/api/patient/measurements/route.ts` — `POST` con las
  reglas de §7.
- `src/app/patient/measurements/new/page.tsx` — form simple.
- `src/app/patient/today/page.tsx` — el item `weight` pasa a
  enlazar `/patient/measurements/new?type=weight`. Cruzar
  `MeasurementEntry` del día para marcar registrado.
- `src/app/psychologist/patients/[patientId]/timeline/page.tsx` —
  segundo bloque "Peso y medidas" análogo al de PB-7.
- `docs/pb-8b-resultado-peso-medidas.md` — documento de cierre.

**Migración a crear**
- Solo `CREATE TYPE MeasurementType` + `CREATE TABLE
  MeasurementEntry` + dos índices. Sin tocar tablas existentes.

**Rutas a crear**
- `POST /api/patient/measurements`
- `/patient/measurements/new`

**Qué NO tocar**
- `TimelineEntry`, `EntryKind`, `MealSlot`, `MediaType` (excepto
  como tipo referenciado por `mediaType?` en el modelo nuevo).
- `/api/patient/entries` y todo el flujo de comidas.
- `EntryControls`, transcripción, IA.
- Auth, `requireRolePage`, `requireRoleApi`.
- Railway, secrets, `.env`, deploy, producción.
- Layouts y nav globales (salvo agregar un link puntual si el
  diseño lo pide; opcional).

---

## 14. Prompt sugerido para PB-8B (NO ejecutar)

```
Repo: szlapakariel-ux/pulso-body
Microciclo: PB-8B — Peso y medidas (implementación mínima)

Base: docs/pb-8a-decision-tecnica-peso-medidas.md (Alternativa B).

Hacer:
1. Agregar enum MeasurementType y modelo MeasurementEntry a
   prisma/schema.prisma según §5 del doc.
2. Crear migración manual aditiva en
   prisma/migrations/<timestamp>_add_measurement_entry/migration.sql.
   No ejecutarla contra DB real.
3. Crear src/lib/measurement-types.ts (labels + unidad default por
   tipo + rangos sanity).
4. Implementar POST /api/patient/measurements con las reglas de §7.
   Reusar requireRoleApi("PATIENT") y derivar psychologistId desde
   patientProfile.
5. Implementar /patient/measurements/new (form simple, sin estado
   global; usar form action o fetch directo).
6. Actualizar /patient/today: el item weight enlaza a
   /patient/measurements/new?type=weight y marca registrado si hay
   MeasurementEntry de tipo WEIGHT en el día.
7. Agregar bloque "Peso y medidas" en
   /psychologist/patients/[patientId]/timeline (segunda query,
   última medición + thumbnail de última foto de progreso).
8. Documentar todo en docs/pb-8b-resultado-peso-medidas.md.

Validar: prisma validate, prisma generate, npm run lint, npm run
build.

No tocar: TimelineEntry, /api/patient/entries, EntryControls,
auth, Railway, secrets, .env, deploy, producción.

Rama: feature/pb-8b-peso-medidas.
Commit: feat(pulso-body): peso y medidas (PB-8B).
Abrir PR. No mergear sin autorización.
```
