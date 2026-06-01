# PB-2 — Resultado: renombrado seguro de identidad

Microciclo: **PB-2**
Referencias: `docs/contrato-producto-pulso-body.md`, `docs/pb-1-mapa-tecnico-adaptacion.md`.

## Objetivo

Adaptar la **identidad visible** del repo desde Pulso original hacia Pulso
Body, sin modificar lógica funcional profunda. Después de este microciclo, la
presentación (título, manifest, headers, login, README, package name) debe
decir Pulso Body. Las rutas, modelos, roles internos y endpoints todavía
conservan su nombre heredado.

---

## Archivos modificados

- `package.json` — `name`.
- `README.md` — reescrito hacia Pulso Body.
- `src/app/layout.tsx` — `metadata.title`, `metadata.description`, `appleWebApp.title`.
- `src/app/manifest.ts` — `name`, `short_name`, `description`.
- `src/app/api/healthz/route.ts` — campo `app`.
- `src/app/login/page.tsx` — `h1` y subtítulo del login.
- `src/app/patient/layout.tsx` — texto del header.
- `src/app/psychologist/layout.tsx` — texto del header.
- `src/app/psychologist/patients/[patientId]/timeline/entry-controls.tsx` — mención visible "Pulso" → "Pulso Body".
- `src/lib/demo.ts` — `label` del botón de profesional demo.
- `docs/pb-2-resultado-renombrado-identidad.md` — este documento.

---

## Qué se cambió

- **Nombre del paquete** npm: `pulso` → `pulso-body`.
- **Metadata** Next.js (`<title>`, descripción, appleWebApp) y **manifest PWA**: Pulso → Pulso Body.
- **Login**: encabezado y subtítulo describen ahora Pulso Body como bitácora diaria.
- **Headers** de paciente y profesional: "Pulso" / "Pulso · Panel" → "Pulso Body" / "Pulso Body · Panel".
- **Endpoint** `/api/healthz`: campo `app` → "Pulso Body".
- **Texto visible** en `entry-controls.tsx` que mencionaba "Pulso" en la UI del profesional.
- **Botón demo** del profesional: "Entrar como psicóloga demo" → "Entrar como profesional demo".
- **README** reescrito para describir Pulso Body como bitácora diaria de
  nutrición, ejercicio, peso y medidas; aclara que la base técnica viene de
  Pulso y que algunas rutas y modelos internos todavía conservan el
  vocabulario heredado.

---

## Qué NO se cambió

- **Prisma schema** y migraciones: intactos.
- **Rutas** (`/patient`, `/psychologist`, `/api/patient/...`, `/api/psychologist/...`): intactas.
- **Endpoints** y sus contratos: intactos.
- **Auth**: cookie, JWT, `requireRole`, middleware: sin cambios.
- **Permisos** y validaciones server-side: sin cambios.
- **Lógica de subida** a S3/R2 y URLs firmadas: sin cambios.
- **Stub de transcripción** y prompt de IA (`src/lib/ai-summary.ts`): sin
  cambios — afecta lógica/comportamiento del modelo, queda para PB-3+.
- **`internalEmail`** y **`displayEmail`** en `src/lib/demo.ts`: sin cambios
  (son la clave única de lookup contra DB seedeada).
- **`name`** ("Psicóloga Demo", etc.) en `src/lib/demo.ts`: sin cambios; se
  actualiza con el renombrado de roles en un microciclo dedicado.
- **Seeds Prisma**: sin cambios.
- **package.json**: solo `name`. No se tocaron dependencias ni scripts.
- **`.env`**, secrets, deploy, producción: sin cambios.

---

## Validaciones ejecutadas

- `npm install` — OK (449 paquetes; postinstall `prisma generate` OK).
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK; 17 páginas/rutas generadas sin errores.

No se modificó ningún test ni se ejecutaron tests E2E (no hay configurados).

---

## Riesgos detectados

- **Mensaje de error en `/api/patient/entries`** todavía dice "Paciente sin
  psicólogo asignado". Es un mensaje devuelto al cliente, pero está embebido
  en lógica de subida — fuera del alcance permitido de PB-2. Pendiente para
  PB-3 o PB-4.
- **Prompt de IA** en `src/lib/ai-summary.ts` menciona "psicóloga": afecta el
  comportamiento del modelo. Se mantiene hasta el microciclo que redefina la
  IA descriptiva de Pulso Body.
- **Nombres de roles internos** (`PSYCHOLOGIST`, `PATIENT`) y rutas
  (`/psychologist`, `/patient`) siguen siendo los heredados. La UI dice
  "profesional" en el botón demo, pero el rol embebido en el JWT y en la DB
  sigue siendo `PSYCHOLOGIST`. Esta disonancia es **intencional** en PB-2 y se
  cierra en el microciclo de renombrado de roles + migración.
- **Nombre demo** en sesión: el header muestra `session.name` ("Psicóloga
  Demo") porque proviene del seed/DB. Para alinearlo hay que actualizar el
  seed y re-correr `prisma db seed`, lo que entra en alcance de seeds.
- **Headers/título de PWA** ya instalado en dispositivos antiguos pueden
  seguir mostrando "Pulso" hasta refresh del manifest.

---

## Confirmación de alcance

- No se tocó Prisma schema, migraciones, rutas, endpoints, auth, permisos ni
  lógica de subida / IA.
- Solo cambios textuales, metadata, manifest PWA, README, package name y un
  label de botón.

---

## Recomendación para PB-3

Avanzar con **PB-3 — Modelo Prisma objetivo documental** según el orden de
`docs/pb-1-mapa-tecnico-adaptacion.md`. Es decir: producir un documento que
defina el **schema Prisma objetivo** (entidades `ProfessionalProfile`,
`ClientProfile`, `ClientPlan`, `MealSchedule`, `ExerciseSchedule`,
`MeasurementSchedule`, `MealEntry`, `ExerciseEntry`, `MeasurementEntry`,
`Reminder`, `ProfessionalNote`, `WeeklySummary`, `CorrectionHistory`) **sin
aplicarlo todavía**, junto con un mapeo entidad-actual → entidad-objetivo y
una estrategia de migración incremental que evite romper auth ni romper la
DB en producción.

Esto deja PB-4 (foto en registros) y PB-5 (agenda diaria) listos para
ejecutarse con un destino claro.
