# PB-11B-E — Resultado: normalización de helpers de fechas

Microciclo: **PB-11B-E** (refactor puro).

## Objetivo

Eliminar duplicaciones de helpers de fechas locales en páginas
server-side y centralizarlas en `src/lib/dates.ts`. Cero cambio
funcional.

---

## Archivos modificados

- `src/lib/dates.ts` — agrega `startOfLocalDay`, `endOfLocalDay`,
  `dayKey`, `formatHHMM`, `formatDateAR` (sin tocar funciones
  existentes: `startOfWeek`, `groupByDay`, `formatTime`,
  `formatDateTime`, tipo `DayGroup`).
- `src/app/patient/today/page.tsx` — quita helpers locales,
  importa de `@/lib/dates`. `formatToday()` → `formatDateAR(new Date())`.
- `src/app/psychologist/patients/[patientId]/today/page.tsx` —
  idem. `formatToday()` → `formatDateAR(new Date())`.
- `src/app/psychologist/patients/[patientId]/week/page.tsx` —
  quita `startOfLocalDay`, `endOfLocalDay`, `dayKey` locales;
  mantiene los formateadores `formatDayLabel` y `formatRange`
  (específicos de la vista semanal, no se usan en otras páginas).
- `docs/pb-11b-e-resultado-normalizacion-fechas.md` — este
  documento.

**No se tocó** Prisma, migraciones, modelos, endpoints, lógica
de adherencia, UI funcional, otras páginas (patient/exercises,
patient/measurements, psy/exercises, psy/measurements no tenían
helpers locales que normalizar — ya usaban `formatDateTime` desde
`@/lib/dates`).

---

## Helpers agregados a `src/lib/dates.ts`

```ts
export function startOfLocalDay(d: Date): Date;  // 00:00:00.000 local
export function endOfLocalDay(d: Date): Date;    // 23:59:59.999 local
export function dayKey(d: Date): string;         // "YYYY-MM-DD" local
export function formatHHMM(d: Date): string;     // "HH:mm"
export function formatDateAR(d: Date): string;   // weekday, dia mes año (es-AR)
```

Comportamiento idéntico a las versiones locales que reemplaza.
Se valida con build verde.

---

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀`.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK.

No hay tests configurados.

---

## Confirmación de alcance

- Prisma, migraciones y modelos **no modificados**.
- Endpoints funcionales **no modificados**.
- Lógica de adherencia (`resolveMealAdherence`, `scheduleAppliesToday`)
  **no modificada**.
- UI **no modificada** salvo imports.
- No se tocó Railway, secrets, `.env`, deploy ni producción.

## Recomendación para próximo microciclo

Disponible para PB-11C (`MeasurementSchedule` documental) o
seguir con el plan original — el suelo técnico queda parejo para
las próximas vistas que necesiten cruces por día/hora.
