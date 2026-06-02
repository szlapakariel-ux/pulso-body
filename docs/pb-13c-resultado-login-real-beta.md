# PB-13C — Resultado: login real mínimo para beta privada

Microciclo: **PB-13C**.
Base: PB-13B (preparación segura).

## Estado inicial encontrado

Auditoría de la rama default antes de tocar nada:

- **`POST /api/auth/login`** (`src/app/api/auth/login/route.ts`)
  **ya existía y funcionaba**:
  - Validación zod (`email`, `password`).
  - `prisma.user.findUnique({ where: { email } })`.
  - `verifyPassword` con bcrypt.
  - `createSession({ sub, role, name })` ⇒ cookie HttpOnly JWT.
  - Respuesta `{ ok: true, role }` o 401 "Credenciales inválidas".
- **`/login` (`src/app/login/page.tsx`)** solo renderizaba
  `<DemoSelector />` apuntando a `/api/auth/demo`. **No había
  form email/password en la UI.**
- **Modelo `User`**: `email @unique`, `passwordHash` ya en
  schema (sin cambios).
- **`Home` (`src/app/page.tsx`)** redirige según rol:
  PATIENT → `/patient/timeline`, PSYCHOLOGIST →
  `/psychologist/patients`. La beta nutricional prefiere que
  PATIENT entre a `/patient/today`, así que el redirect post-
  login se hace **explícito desde el form** para no tocar
  `Home`.

**Conclusión**: el backend de login real existía; faltaba **solo
la UI** y el wiring del redirect por rol.

## Cambios realizados

### Nuevo: `src/app/login/login-form.tsx`

Client component que:

- Toma `email` + `password` con `<form>` accesible (`label` +
  `htmlFor`, `autoComplete=email|current-password`,
  `type=password`).
- Valida en cliente que ambos campos están cargados; muestra
  "Cargá email y contraseña." si falta uno.
- Normaliza el email (`trim().toLowerCase()`) antes de enviarlo.
- POST a `/api/auth/login` (el endpoint que ya existía).
- Si responde 401/400, muestra el mensaje del server
  (Credenciales inválidas / Datos inválidos).
- Si responde 200, redirige por rol:
  - `PATIENT` → `/patient/today`
  - `PSYCHOLOGIST` → `/psychologist/patients`
- `router.refresh()` después del `replace` para que el server
  re-evalúe la sesión.

### Modificado: `src/app/login/page.tsx`

Layout limpio con dos bloques separados:

1. **"Iniciar sesión"** (primary) → `<LoginForm />`.
2. **"Solo demo local"** (secundario) → `<DemoSelector />` con
   copy: *"Perfiles precargados por el seed para mostrar el
   flujo. No usar en beta privada ni con usuarios reales."*

`readSession` + redirect a `/` si ya hay sesión, igual que antes.

## Archivos modificados

- `src/app/login/page.tsx` — refactor del layout, agrega bloques
  separados.
- `src/app/login/login-form.tsx` — nuevo componente.
- `docs/pb-13c-resultado-login-real-beta.md` — este documento.

**No tocados**: `src/app/api/auth/login/route.ts` (ya funcionaba),
`src/app/api/auth/demo/route.ts`, `src/lib/auth.ts`,
`src/lib/demo.ts`, schema Prisma, seed, migraciones, middleware,
otras páginas/endpoints.

## Cómo probar login real localmente

Requisito previo: **un User en la DB local con email,
passwordHash bcrypt y role** (no del seed demo). Procedimiento
de PB-13B §7 (Opción B) sirve para crear ese usuario; ejemplo
adaptado a local:

```bash
# en local, no commitear
# scripts/_local-create-test-user.ts  (borrar después)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
async function main() {
  const passwordHash = await bcrypt.hash(process.env.PASS!, 10);
  await prisma.user.create({
    data: {
      name: "Profesional Real",
      email: process.env.EMAIL!.toLowerCase(),
      passwordHash,
      role: "PSYCHOLOGIST",
    },
  });
  console.log("OK");
}
main().finally(() => prisma.$disconnect());
```

```bash
DATABASE_URL='postgresql://...localhost...' \
EMAIL='profe@pulso.local' PASS='secret123' \
  npx tsx scripts/_local-create-test-user.ts
```

Probar:

1. `npm run dev` → `http://localhost:3000/login`.
2. Cargar email + contraseña en el bloque **"Iniciar sesión"**.
3. Si las credenciales son válidas, redirige a
   `/psychologist/patients` o `/patient/today` según rol.
4. Si son inválidas, aparece "Credenciales inválidas" sin
   cambiar de ruta.
5. Si falta uno de los campos, aparece "Cargá email y
   contraseña.".

## Cómo crear usuarios reales para la beta (PB-13B §7)

Mismo procedimiento que ya quedó documentado en
`docs/pb-13b-deploy-beta-privada.md §7`:

- **Opción A**: Prisma Studio apuntando a la DB beta de
  Railway, manualmente.
- **Opción B (recomendada)**: script ad-hoc local
  `scripts/_local-create-beta-users.ts` (no commitear) que crea
  nutricionista + Ariel + `PatientProfile` usando env vars.

Después del alta, ambos usuarios pueden loguearse desde el form
nuevo en `/login`.

> No se incluyen emails ni passwords reales en este documento.

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀` (sin cambios).
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npx tsc --noEmit -p tsconfig.json` — sin errores.
- `npm run build` — OK; `/login` sigue presente como ruta
  dinámica.

**No ejecutado**:
- Deploy.
- `npm run db:demo-reset`.
- `prisma db seed` contra DB remota.
- Comandos contra Railway.
- Creación de usuarios reales.

## Riesgos

- **Brute force**: `/api/auth/login` no tiene rate limit
  (heredado, documentado en README). En beta privada con URL no
  difundida el riesgo es bajo; conviene cerrar antes de
  cualquier apertura.
- **Email reuse demo vs real**: si alguien crea un User real
  con un email igual a uno de `DEMO_PROFILES.internalEmail`
  (`demo-psicologa@pulso.local`, etc.), el botón demo y el form
  resuelven al mismo registro. En la beta esto no se hace
  porque los reales se crean con dominio distinto
  (`@pulso.local` es válido pero conviene `@<algo-real>.test`
  o similar). Documentado en PB-13B §7.
- **Sesión 7 días**: el JWT actual expira en 7 días
  (`createSession`). Para una beta de 14 hay que volver a
  loguear a mitad de camino. Aceptable; documentar al
  paciente/profesional.
- **Sin "olvidé mi contraseña"**: fuera de scope. Si alguno
  olvida la clave, el operador rota el `passwordHash` desde
  Prisma Studio.
- **Visual**: el bloque "Solo demo local" sigue visible en
  todos los entornos (incluyendo Railway). Para la beta no
  bloquea, pero conviene esconderlo cuando entre PB-14
  (env-aware UI). Hoy: copy explícito y separación visual
  alcanzan.
- **Redirect explícito por rol** en el form puede divergir de
  `Home` si el día de mañana se cambia `Home`. Mitigación:
  cuando se mueva el `Home` patient a `/patient/today` (deuda
  heredada), se mantiene la misma URL.

## Dictamen

**A) Apto para abrir PB-13D (deploy real autorizado)** — junto
con las casillas operativas pendientes del §12 de
`pb-13b-deploy-beta-privada.md`. La duda operativa "¿cómo
loguea un usuario real?" queda cerrada: form email/password
visible, endpoint preexistente, redirect por rol, separación
clara del demo.

## Próximo paso recomendado

**PB-13D — Deploy beta privada (ejecución)**:

1. Crear bucket R2/S3 privado con CORS al dominio Railway
   (PB-13B §4).
2. Crear proyecto Railway con todas las variables (PB-13B §3).
3. Confirmar que `npx prisma db seed` **no** corre en Railway
   (PB-13B §6).
4. Alta manual de nutricionista + Ariel con `scripts/_local-create-beta-users.ts`
   apuntado a la DB de Railway en una shell efímera.
5. Smoke test (PB-13B §8 + este doc).
6. Avisar a paciente y profesional cuando todo verde.

Si antes aparece la necesidad de **esconder el bloque demo en
producción**, abrir PB-13C-bis chico: `if (process.env.NODE_ENV
=== "production" && !process.env.SHOW_DEMO) hideDemo()`. Hoy no
bloquea.

## Confirmación de alcance

- Prisma schema **no modificado**.
- Migraciones **no creadas**.
- Modelos **no modificados**.
- `prisma/seed.ts` **sin cambios**.
- `/api/auth/login` **no modificado** (ya funcionaba).
- `/api/auth/demo` **no modificado**.
- Middleware **sin cambios**.
- No se agregó OAuth, recuperación de contraseña, registro
  público ni onboarding público.
- No se almacenan contraseñas en texto plano (la API ya usa
  bcrypt).
- No se hardcodean emails/passwords reales en código ni en
  docs.
- No se tocó Railway, secrets, `.env`, deploy ni producción.
- No se crearon usuarios reales.
