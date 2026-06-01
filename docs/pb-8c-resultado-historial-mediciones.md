# PB-8C — Resultado: historial básico de peso y medidas

Microciclo: **PB-8C**
Base: PB-8A (decisión técnica) + PB-8B (modelo `MeasurementEntry` y
flujo de creación).

## Objetivo

Cerrar el ciclo de peso y medidas con un **historial básico** del
lado paciente y del lado profesional, y completar la lógica de
"registrado hoy" en `/patient/today`. Sin tocar Prisma ni
`TimelineEntry`.

---

## Archivos modificados

- `src/app/patient/measurements/page.tsx` — **nueva** vista paciente
  con listado, filtro por tipo y URL firmada para fotos.
- `src/app/psychologist/patients/[patientId]/measurements/page.tsx`
  — **nueva** vista profesional equivalente, con check de
  pertenencia paciente↔profesional.
- `src/app/patient/today/page.tsx` — segunda query de
  `MeasurementEntry` del día; el ítem `Peso / medidas` ahora marca
  Registrado y muestra acciones secundarias.
- `src/app/psychologist/patients/[patientId]/timeline/page.tsx` —
  link "Ver historial de mediciones" en el bloque resumen.
- `src/app/patient/layout.tsx` — link `Medidas` en el nav.
- `docs/pb-8c-resultado-historial-mediciones.md` — este documento.

**No se tocó** `prisma/schema.prisma`, migraciones, `TimelineEntry`,
endpoints, auth, lógica de comidas, helpers existentes.

---

## Qué se implementó

### Vista paciente — `/patient/measurements`

- Server component, `requireRolePage("PATIENT")`.
- Query: últimas 30 `MeasurementEntry` del usuario, ordenadas por
  `recordedAt desc`.
- Filtro `?type=weight|waist|hip|chest|arm|progress-photo|custom`
  resuelto en server con `<Link>` (Todas / por tipo). Sin estado
  cliente.
- Cada ítem muestra: tipo humano + valor + unidad + hora + nota.
- Si hay `mediaKey`, se resuelve `presignDownload` y se renderiza
  la foto inline. Vista dedicada: por diseño es el único lugar
  donde se exponen thumbnails corporales.
- Vacío:
  - sin filtro: *"Todavía no cargaste peso o medidas."*
  - con filtro: *"Todavía no cargaste mediciones de tipo X."*
- Acciones: botón "+ Registrar" hacia `/patient/measurements/new`.

### Vista profesional — `/psychologist/patients/[patientId]/measurements`

- Server component, `requireRolePage("PSYCHOLOGIST")`.
- Mismo check que el timeline:
  `profile.psychologistId !== user.id → notFound()`.
- Query equivalente con `patientId` + `psychologistId` y mismo
  filtro por tipo.
- Header: link `← Timeline`, nombre del paciente, email demo.
- Listado igual al del paciente. Vacío:
  *"Este paciente todavía no tiene peso o medidas registradas."*

### `/patient/today` — marca de registrado

- Segunda query mínima: `prisma.measurementEntry.count({...})`
  acotada a `recordedAt` dentro del día actual del proceso.
- Si `count > 0`, el ítem `Peso / medidas` pasa a estado
  **Registrado** y muestra dos acciones:
  - "Ver historial" → `/patient/measurements`.
  - "Registrar otra" → `/patient/measurements/new?type=weight`.
- Si no hay medición hoy, sigue **Pendiente** con dos acciones:
  - "Registrar" (primary).
  - "Ver historial" (ghost).

Timezone: se mantiene `startOfLocalDay`/`endOfLocalDay` del proceso
Node (igual que comidas en PB-6). Documentado como limitación.

### Bloque resumen profesional (timeline)

- En `/psychologist/patients/[patientId]/timeline`, el bloque
  "Peso y medidas" ahora tiene en el header un link a
  `/psychologist/patients/[patientId]/measurements`
  (*"Ver historial de mediciones"*).
- El bloque sigue mostrando las últimas 3 mediciones **sin
  thumbnails**. Las imágenes corporales solo aparecen en la vista
  dedicada (decisión heredada de PB-8B §10 sobre privacidad).

### Nav paciente

- Se agregó link `Medidas` en `src/app/patient/layout.tsx` entre
  `Timeline` y la sesión. Cambio mínimo, no rediseña la nav.

---

## Manejo de fotos de progreso

- Mismo helper `presignDownload(mediaKey)` que el resto del
  proyecto. Bucket privado + URL firmada 1h.
- `mediaKey` no se expone al cliente; solo viaja la URL firmada.
- Las thumbnails se renderizan **solo** en
  `/patient/measurements` y `/psychologist/.../measurements` (vistas
  dedicadas con acceso explícito), nunca en los bloques resumen.
- No hay análisis de imagen ni IA — sigue prohibido.

---

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀` (schema intacto).
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK; aparecen `/patient/measurements` y
  `/psychologist/patients/[patientId]/measurements`.

No hay tests configurados en el repo.

---

## Qué quedó fuera de alcance

- **Edición / borrado** de mediciones.
- **Gráficos / sparkline / evolución**.
- **Paginación** (se cortó a 30 últimas; cuando aparezca
  acumulación real, se pagina).
- **Agrupación por día** en el historial (puede sumarse igual que
  en `/patient/timeline` cuando crezca el volumen).
- **`MeasurementSchedule`**, **`ClientPlan`**, **`Reminder`**.
- **IA / análisis corporal**.
- **Renombrado de rutas o roles**.
- **Railway, secrets, `.env`, deploy, producción**.

---

## Riesgos detectados

- **Timezone del proceso Node** para el rango "hoy" en
  `/patient/today` y en el cálculo de la lista — mismo límite
  heredado, se cierra cuando exista `timezone` por cliente.
- **Sin paginación** en el historial: 30 ítems alcanzan hoy, pero
  con uso semanal sostenido entran semanas en una pantalla. Cargar
  más entra en deuda técnica (igual que el timeline general).
- **Fotos thumbnail** en la vista dedicada: se exponen sin
  preview-on-click. Decisión documentada; si el caso de uso pide
  ocultarlas detrás de un click, agregar un toggle simple.
- **Sin marca por tipo en `/patient/today`**: el ítem se marca
  registrado si hay **cualquier** medición del día. Si en el
  futuro la agenda incluye varios slots por tipo (peso a la mañana,
  cintura semanal), conviene refinar por tipo.
- **N+1 de URLs firmadas**: para 30 fotos se hacen hasta 30
  `presignDownload`. Hoy alcanza; si se vuelve hot path, batchear
  o cachear por ventana de 1h.

---

## Confirmación de alcance

- `prisma/schema.prisma` **no modificado**.
- No se crearon migraciones.
- `TimelineEntry` **no modificado**.
- `MealEntry`, `ExerciseEntry`, `MeasurementSchedule`, `ClientPlan`,
  `Reminder` — **no creados**.
- Auth, permisos y endpoints existentes — sin cambios funcionales.
- Railway, secrets, `.env`, deploy, producción — sin cambios.

---

## Recomendación para PB-9

Avanzar con **PB-9 — Ejercicio**. El patrón es directo y reutiliza
la decisión técnica de PB-8A:

1. **`ExerciseEntry` dedicado** (no extender `TimelineEntry`):
   - `id`, `patientId`, `psychologistId`, `type`
     (`STRENGTH`/`CARDIO`/`MOBILITY`/`SPORT`/`CUSTOM`),
     `durationMinutes Int?`, `intensity` enum opcional,
     `note String?`, `mediaKey String?`, `mediaType MediaType?`,
     `recordedAt DateTime`.
   - Migración aditiva, no destructiva.
2. **API**: `POST /api/patient/exercises` con reglas por tipo
   (intensidad/duración requeridas según corresponda).
3. **Paciente**: `/patient/exercises/new` con form simple, link
   desde `/patient/today` ítem `exercise`.
4. **Profesional**: bloque "Ejercicio" análogo a "Peso y medidas"
   en el timeline + vista dedicada `/psychologist/.../exercises`.
5. **Nav**: link `Ejercicio` en `src/app/patient/layout.tsx`.
6. Documentar en `docs/pb-9-resultado-ejercicio.md`.

Si antes querés iterar mediciones, **PB-8D** podría sumar
edición/borrado de la última medición del día y paginación del
historial.
