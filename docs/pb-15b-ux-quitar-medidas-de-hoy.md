# PB-15B-UX — Resultado: quitar Peso/medidas de Hoy

Microciclo: **PB-15B-UX**.
Objetivo: limpiar la vista `/patient/today` removiendo el bloque
"Peso / medidas", sin tocar la funcionalidad de mediciones.

## Archivo modificado

- `src/app/patient/today/page.tsx`

No se tocó ningún otro archivo.

## Qué se eliminó

1. La `<section>` completa con `<h3>Peso / medidas</h3>` y la
   `<article>` interna que contenía:
   - encabezado "08:00 · Medición" + "Peso / medidas"
   - badge de estado "Registrado" / "Pendiente"
   - botones `Registrar` / `Ver historial` / `Registrar otra`
2. La query `prisma.measurementEntry.count` que solo alimentaba
   ese bloque (`measurementsTodayCount`).
3. La variable derivada `measurementRegistered`.

El `Promise.all` queda con cinco queries (mealsToday, schedules,
exercisesTodayCount, activePlanCount, activeTrainingCount) en
lugar de seis.

## Qué rutas de mediciones siguen intactas

- `/patient/measurements` — historial completo de mediciones.
- `/patient/measurements/new` — formulario para registrar peso /
  medidas.
- Link "Medidas" en el nav del paciente (`src/app/patient/layout.tsx`).
- Modelo `MeasurementEntry` en Prisma, sus APIs y la vista
  profesional `psychologist/patients/[id]/measurements`: sin
  cambios.

El paciente sigue pudiendo registrar y ver mediciones; solo
desaparece la card recordatoria de la pantalla "Hoy".

## Qué NO se tocó

- Funcionalidad de mediciones (modelos, APIs, formularios,
  historial).
- Prisma, migraciones, DB.
- Railway, Cloudflare, deploy.
- Auth.
- Upload, fotos, storage/R2.
- Sección "Comidas" de la misma página.
- Sección "Ejercicio" de la misma página.
- Cards "Tu plan" y "Tu rutina".
- Plan alimentario, rutina, adherencia.
- Nav del paciente.
- Otras pantallas.

## Validaciones

- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — ✓ Next.js compila y type-check pasa.
