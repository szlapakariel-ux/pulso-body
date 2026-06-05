# PB-14H — Resultado: registro manual de comida + hora real

Microciclo: **PB-14H**.
Necesidad de uso de Ariel: a veces registra tarde una comida o ya
se comió la comida antes de sacar foto. Hoy el formulario de
comida exigía foto/archivo y usaba la hora actual como hora del
registro. Ahora se permite registro manual sin foto y elegir la
hora real en que comió.

## Causa técnica

1. `TimelineEntry` exigía `mediaType` y `mediaKey` no-null en
   Prisma (`mediaType MediaType`, `mediaKey String`). No se podía
   crear una entrada de comida sin media.
2. El API `/api/patient/entries` solo aceptaba el flujo `init` →
   `upload` → `complete`, todos requiriendo `mediaKey` y
   `mediaType`. No había acción para crear una comida sin pasar
   por R2.
3. El formulario `NewEntryForm` solo exponía adjuntar archivo y
   `recordedAt` se calculaba con `new Date().toISOString()` al
   guardar (la hora real era siempre "ahora").

## Migración (aditiva, mínima)

Se generó la migración
`prisma/migrations/20260605000000_pb14h_timeline_media_optional/migration.sql`:

```sql
ALTER TABLE "TimelineEntry" ALTER COLUMN "mediaType" DROP NOT NULL;
ALTER TABLE "TimelineEntry" ALTER COLUMN "mediaKey" DROP NOT NULL;
```

No drop, no rename, no backfill. Los registros existentes siguen
válidos. **No se ejecutó contra la DB de Railway**, solo se dejó
versionada en el repo para la próxima migración programada.

`schema.prisma` actualizado en consecuencia:
- `mediaType MediaType?`
- `mediaKey String?`

`npx prisma validate` ✓ (`The schema at prisma/schema.prisma is
valid`).
`npx prisma generate` ✓.

## Archivos modificados

- `prisma/schema.prisma` — `mediaType` y `mediaKey` nullable en
  `TimelineEntry`.
- `prisma/migrations/20260605000000_pb14h_timeline_media_optional/migration.sql`
  — migración SQL aditiva.
- `src/lib/s3.ts` — `presignDownload` ahora acepta `string | null
  | undefined` y devuelve `null` si no hay key (evita romper
  callers existentes).
- `src/app/api/patient/entries/route.ts` — nueva acción
  `meal-manual` que crea `TimelineEntry` tipo `MEAL` sin media,
  guardando `mealSlot`, `recordedAt`, `contextLabel`,
  `contextNote`. No toca R2.
- `src/app/api/psychologist/entries/[entryId]/transcription-request/route.ts`
  — guarda contra `mediaKey` null (rechaza 400 si no hay audio).
- `src/app/patient/new-entry/new-entry-form.tsx` — agrega:
  - estado `whenLocal` (datetime-local, default = ahora);
  - estado `manualOnly` (toggle para comida sin foto);
  - input `datetime-local` "Hora en que comí" en modo `attach`
    para comida;
  - checkbox "Registrar manualmente sin foto" con texto de ayuda
    "Usalo si te olvidaste de sacar foto o estás cargando tarde."
    visible solo si `isMeal`;
  - oculta el file picker y la vista previa cuando `manualOnly`
    está activo;
  - habilita "Guardar registro" si hay foto OR (manual + texto
    no vacío);
  - rama `saveManualMeal()` que llama a la nueva acción del API
    sin pasar por R2;
  - `save()` ahora usa `whenLocal` como `recordedAt` (con
    fallback a "ahora").
- `src/app/patient/timeline/page.tsx` — soporta `mediaType` null
  en `entryTitle()`; cuando no hay `mediaKey` muestra "Registro
  manual sin foto" en vez del fallback de almacenamiento.
- `src/app/psychologist/patients/[patientId]/timeline/entry-controls.tsx`
  — `mediaType` prop ahora `"AUDIO" | "VIDEO" | "PHOTO" | null`
  (compatibilidad de tipos, `supportsAi` queda `false` cuando es
  null o PHOTO, igual que antes).

## Cómo se registra comida CON foto

1. Paciente entra al flujo de comida (`patient/new-entry` con
   intent `meal`).
2. Selecciona el archivo (file picker existente).
3. Ajusta la "Hora en que comí" si la hora real no es ahora.
4. Opcionalmente agrega contexto / comentario.
5. Pulsa "Guardar registro".
6. Flujo intacto: `init` → PUT a R2 → `complete` con `recordedAt`
   = hora elegida.

## Cómo se registra comida SIN foto

1. Paciente entra al flujo de comida.
2. Tilda el checkbox **"Registrar manualmente sin foto"**.
3. El selector de archivo desaparece.
4. Ajusta "Hora en que comí" (default: ahora).
5. Escribe en "Agregar contexto breve" lo que comió (obligatorio
   en este modo; el botón Guardar queda deshabilitado hasta que
   haya texto).
6. Pulsa "Guardar registro".
7. `save()` detecta `isMeal && manualOnly` y llama a
   `POST /api/patient/entries` con `action: "meal-manual"`.
8. El API crea `TimelineEntry` con `entryKind=MEAL`,
   `mealSlot`, `mediaType=null`, `mediaKey=null`,
   `recordedAt=<hora elegida>`, `contextNote=<texto>`.
9. **No** se llama a `presignUpload`, **no** se toca R2/S3.

## Cómo se elige la hora real de comida

- Input `datetime-local` `id="when-local"` en modo `attach`,
  precargado con la hora actual al montar el formulario.
- El usuario puede cambiarla libremente.
- Al guardar, se convierte a ISO y se manda como `recordedAt`.
- Aplica tanto al flujo con foto como al manual.

Ejemplo: cargo a las 16:30 una comida real de las 13:15 →
`recordedAt` = `2026-06-05T13:15:00.000Z` (en la TZ del cliente).
El timeline ordena por `recordedAt desc`, así que aparece donde
corresponde por hora real.

## Cómo se ve en timeline

- Título: `DESAYUNO / ALMUERZO / MERIENDA / CENA / COLACIÓN / OTRA
  COMIDA` (helper `entryTitle()` ya existente, ahora tolera
  `mediaType=null`).
- Fecha/hora: la hora real elegida por el paciente
  (`recordedAt`), no la hora de carga.
- Contexto y comentario: igual que antes.
- Bloque de media:
  - con foto: miniatura `PhotoPreview` 150x150 + modal (PB-14F).
  - sin foto: leyenda en cursiva **"Registro manual sin foto."**.

## Qué NO se tocó

- Railway: no se ejecutó la migración contra la DB de Railway, no
  se tocó nada de Railway.
- Cloudflare: nada.
- Storage / R2: no se modificó la lógica de upload con foto. La
  única decisión activa es **no usar R2** cuando el registro es
  manual sin foto.
- Plan alimentario, rutina, mediciones, adherencia: intactos.
- Auth, usuarios, passwords: intactos.
- Checklist Hoy/Ayer/Mañana, cumplimiento parcial, PB-15: no
  avanzados.
- Comida con foto: flujo `init → upload → complete` sigue
  funcionando.
- Comentario sin perder foco: el fix de PB-14G sigue vigente
  (`ContextFields` continúa extraído a top-level).

## Validaciones

- `npx prisma validate` — ✓ schema válido.
- `npx prisma generate` — ✓ Prisma Client generado.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — ✓ Next.js compila y type-check pasa
  (incluyendo las páginas del psicólogo que también consumen
  `TimelineEntry`).

(No corresponde ejecutar `prisma migrate deploy` ni
`prisma db push` — la migración queda versionada para que se
aplique en el próximo deploy planeado.)
