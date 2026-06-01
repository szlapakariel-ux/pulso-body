# PB-11G — Resultado: normalización de helpers en timeline profesional

Microciclo: **PB-11G** (refactor puntual).

## Objetivo

Cerrar el hallazgo no bloqueante de PB-11F: el timeline
profesional aún tenía copias locales de helpers de fechas que
PB-11B-E ya centralizó en `src/lib/dates.ts`. Cero cambio
funcional.

## Archivos modificados

- `src/app/psychologist/patients/[patientId]/timeline/page.tsx`
  — quita las 3 funciones locales y agrega los imports desde
  `@/lib/dates`.
- `docs/pb-11g-resultado-normalizacion-timeline-profesional.md`
  — este documento.

## Helpers reemplazados

| local removido     | import nuevo desde `@/lib/dates` |
|--------------------|----------------------------------|
| `startOfLocalDay`  | `startOfLocalDay`                |
| `endOfLocalDay`    | `endOfLocalDay`                  |
| `formatHHMM`       | `formatHHMM`                     |

Las firmas y el comportamiento son idénticos a los que ya viven
en `src/lib/dates.ts` desde PB-11B-E.

## Confirmación de cero cambio funcional

- No se modifica ninguna query Prisma.
- No se modifica el JSX ni los call-sites de los helpers.
- Los nombres y los argumentos se mantienen.
- Diff es estrictamente: −3 funciones locales, +3 nombres en el
  import existente.

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀`.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK.

## Fuera de alcance

- Prisma, migraciones, modelos.
- Endpoints, auth, lógica de adherencia.
- Otras páginas / layouts.
- Railway, secrets, `.env`, deploy, producción.
