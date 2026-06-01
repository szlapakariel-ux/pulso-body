# PB-4 — Resultado: soporte mínimo de PHOTO

Microciclo: **PB-4**
Referencias:
- `docs/contrato-producto-pulso-body.md`
- `docs/pb-1-mapa-tecnico-adaptacion.md`
- `docs/pb-3-modelo-prisma-objetivo.md`

## Objetivo

Agregar soporte técnico mínimo para registros con **foto**, reutilizando la
estructura heredada de Pulso (`TimelineEntry`, `mediaKey`, S3/R2, URL
firmada). Es la **opción B** recomendada al cierre de PB-3.

No se crean entidades nuevas (`MealEntry`, `ExerciseEntry`, etc.). No se crea
agenda diaria, ni recordatorios, ni cálculo calórico, ni análisis de imagen.

---

## Archivos modificados

- `prisma/schema.prisma` — `enum MediaType` extendido con `PHOTO`.
- `prisma/migrations/20260601120000_add_photo_media_type/migration.sql` — nueva.
- `src/app/api/patient/entries/route.ts` — acepta `PHOTO` y MIME `image/*`.
- `src/app/api/psychologist/entries/[entryId]/ai-summary/route.ts` — rechaza
  `PHOTO` con 400 (resumen IA solo para audio/video).
- `src/app/patient/new-entry/new-entry-form.tsx` — detecta `image/*`,
  permite adjuntar imagen, muestra preview con `<img>`.
- `src/app/patient/timeline/page.tsx` — label "Foto" y render de imagen.
- `src/app/psychologist/patients/[patientId]/timeline/page.tsx` — label
  "Foto", render de imagen, pasa `mediaType` a `EntryControls`.
- `src/app/psychologist/patients/[patientId]/timeline/entry-controls.tsx` —
  recibe `mediaType`; oculta secciones de transcripción/IA para `PHOTO` y
  muestra "Disponible solo para audio/video".
- `docs/pb-4-resultado-photo-media-type.md` — este documento.

---

## Cambios realizados

### Prisma
- `enum MediaType { AUDIO, VIDEO, PHOTO }` (se agrega `PHOTO`).
- Migración SQL mínima:

  ```sql
  ALTER TYPE "MediaType" ADD VALUE 'PHOTO';
  ```

### API de carga (`/api/patient/entries`)
- `mediaType` ahora acepta `"PHOTO"` en `init` y `complete`.
- Nueva lista `ALLOWED_PHOTO`:
  `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`.
- Helper `allowedFor(mediaType)` reemplaza el ternario AUDIO/VIDEO.
- `buildInternalTitle` ahora produce `"Foto · …"` cuando corresponde.
- Validaciones intactas: `MAX_UPLOAD_MB`, prefijo `patients/<userId>/` en
  `mediaKey`, presigned upload por S3/R2.
- La extensión del key se sigue derivando de `contentType` y queda como
  `jpeg`, `png`, `webp`, `heic`, `heif` según el archivo.

### Resumen IA (`/api/psychologist/entries/[entryId]/ai-summary`)
- Si `entry.mediaType !== "AUDIO" && !== "VIDEO"`, devuelve **400** con
  "Resumen IA disponible solo para audio/video." Esto evita pasar `PHOTO`
  al stub de transcripción/resumen (que aceptaba solo AUDIO|VIDEO).
- No se modificó la lógica de IA ni el prompt.

### Formulario de nuevo registro
- Tipo `MediaType` ampliado; `RecordableType` agregado para el flujo de
  grabación in-browser (audio/video).
- `<input type="file" accept="image/*,audio/*,video/*">` (antes `audio/*,video/*`).
- Detección de tipo:
  - `image/*` → `PHOTO`
  - `video/*` → `VIDEO`
  - resto → `AUDIO`.
- Preview:
  - PHOTO → `<img>`
  - AUDIO → `<audio controls>`
  - VIDEO → `<video controls>`
- No se agregó captura de cámara directa para foto (queda para futuro).
- Las funciones `startRecording` / `pickMime` quedan limitadas a
  `RecordableType` (no se intenta grabar fotos por MediaRecorder).

### Timeline paciente
- Label `"Foto"` cuando `mediaType === "PHOTO"`.
- Render: `<img src={mediaUrl} alt="Foto registrada">`. AUDIO/VIDEO siguen
  iguales.

### Timeline profesional
- Mismo cambio de label/render que paciente.
- `EntryControls` recibe la prop `mediaType`.
- Para `PHOTO`, los bloques de **Transcripción** y **Título y resumen
  sugeridos (IA)** quedan ocultos; en su lugar aparece una línea:
  *"Transcripción y resumen IA disponibles solo para audio/video."*
- **Notas privadas** siguen disponibles para todas las entradas.

---

## Migración creada

- Directorio: `prisma/migrations/20260601120000_add_photo_media_type/`
- Archivo: `migration.sql`
- Contenido: `ALTER TYPE "MediaType" ADD VALUE 'PHOTO';` (operación
  reversible solo manualmente en PostgreSQL; típica para extensión de enums).
- **No se ejecutó** `prisma migrate dev` ni `prisma migrate deploy` contra
  ninguna base real. El archivo queda listo para que el deploy lo aplique
  cuando corresponda.

---

## Validaciones ejecutadas

- `npx prisma validate` — `The schema at prisma/schema.prisma is valid 🚀`.
- `npx prisma generate` — OK (cliente regenerado con `PHOTO` en `MediaType`).
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK; 17 rutas generadas; sin errores de TypeScript.

No hay tests configurados en el repo; no se ejecutaron tests.

---

## Qué quedó fuera de alcance

- `MealEntry`, `ExerciseEntry`, `MeasurementEntry`, `ClientPlan`,
  `MealSchedule`, `ExerciseSchedule`, `MeasurementSchedule`,
  `BodyEntry` — todos diferidos al microciclo correspondiente.
- Agenda diaria, recordatorios, `Reminder`.
- Renombrado de rutas `/patient` y `/psychologist`.
- Renombrado de roles (`Role { PATIENT, PSYCHOLOGIST }`).
- Auth, permisos, lógica de subida más allá del MIME permitido.
- Captura directa de cámara para foto (input file basta).
- Análisis de imagen, cálculo calórico, IA nueva.
- Cambios en seeds y producción.

---

## Riesgos detectados

- **`ALTER TYPE ADD VALUE`** en Postgres no se puede ejecutar dentro de una
  transacción en versiones antiguas (< 12). En Postgres ≥ 12 está permitido
  sin restricciones; conviene confirmar la versión de Railway antes del
  `migrate deploy`.
- **Tamaño de imágenes**: `MAX_UPLOAD_MB` (default 100) cubre fotos sin
  problemas; HEIC suele ser chico. No se agregó compresión cliente — fotos
  de teléfonos modernos pueden ser de 4–10 MB.
- **Render de `image/heic`/`heif`** en navegadores: Chrome/Firefox no
  decodifican HEIC nativamente. La subida se acepta pero el preview en el
  navegador puede no mostrarse. Aceptable en MVP; Safari/iOS sí lo
  renderiza.
- **Fotos sensibles** (futuras de progreso corporal): la infraestructura
  hoy es bucket privado + URL firmada, lo cual cubre la sensibilidad.
  Cuando se introduzca `MeasurementEntry` con foto de progreso, conviene
  revisar política de retención y acceso del profesional, como anticipa
  PB-3 §10.
- **Entradas PHOTO en el panel del profesional sin transcripción/IA**:
  hoy se ocultan los bloques de transcripción/IA y se muestra un texto.
  Si en el futuro se quiere análisis automático de imagen, el endpoint
  `/ai-summary` está bloqueado para `PHOTO` con 400 — habrá que extender
  ese contrato explícitamente.
- **`buildInternalTitle`** sigue siendo el título visible y dice "Foto …".
  Cuando lleguen las ingestas/ejercicios/medidas reales, el título se
  derivará del schedule, no de aquí.
- **`mediaUrl` para `PHOTO`** se sirve por URL firmada igual que
  audio/video — la URL expira en 1h. Si se la incrusta en un `<img>` y el
  usuario deja la pestaña abierta, no se refresca; aceptable porque cada
  navegación regenera la lista en server component.

---

## Confirmación de alcance

- **No** se tocó Railway, secrets, `.env`, deploy ni producción.
- **No** se ejecutó ninguna migración contra base real.
- **No** se implementaron comidas, ejercicios, mediciones, planes ni agenda.
- **No** se modificó auth ni permisos.
- **No** se cambió la lógica de IA ni el prompt; solo se bloqueó la ruta
  `ai-summary` para `PHOTO` con un 400 explícito.

---

## Recomendación para PB-5

Avanzar con **PB-5 — Agenda diaria interna**, según el orden trazado en
`docs/pb-1-mapa-tecnico-adaptacion.md`.

Sub-pasos sugeridos para PB-5:

1. Documentar el contrato de la "agenda del día" del cliente: qué se
   muestra (ingestas/ejercicios/medidas pendientes de hoy), de dónde sale
   la información (en esta etapa puede ser **mock** o derivada de
   constantes del seed), y cómo encaja con las entradas reales.
2. Crear la página `/patient/today` (manteniendo `/patient/timeline` como
   está) con una lista vacía o con placeholders, sin lógica de programación
   todavía.
3. Dejar el archivo `prisma/schema.prisma` intacto en PB-5 si la agenda se
   puede mockear; o agregar `MealSchedule` mínimo si el equipo prefiere
   empezar por la persistencia.
4. Documentar resultado en `docs/pb-5-resultado-agenda-diaria.md`.

Esto deja PB-6 (registro de comida con foto) con todas las piezas listas:
soporte `PHOTO` ya en producción (PB-4) + agenda mínima (PB-5) + endpoint
de registro que en PB-6 se especializa a `MealEntry`.
