# PB-13B — Resultado: preparación segura para deploy beta privada

Microciclo: **PB-13B**.
Base: PB-13A (preflight, dictamen B).

## Cambios realizados

### Guard agregado

- `scripts/guard-demo-reset.ts` (nuevo): lee `DATABASE_URL` y
  aborta si el host no es `localhost`, `127.0.0.1` o `::1`.
  Maneja URLs sin parsear y URL vacía con `exit(1)`. Mensajes
  claros en consola.

### Script modificado

- `package.json`:
  ```diff
  - "db:demo-reset": "prisma migrate reset --force",
  + "db:demo-reset": "tsx scripts/guard-demo-reset.ts && prisma migrate reset --force",
  ```
  Por el `&&`, si el guard aborta, `prisma migrate reset` no se
  ejecuta. Doble red: guard automático + disciplina del operador.

### Documentos creados

- `docs/pb-13b-deploy-beta-privada.md` — procedimiento
  canónico de deploy en Railway + R2 + alta manual de usuarios
  + smoke test + riesgos + criterio de aptitud para PB-13C.
- `docs/pb-13b-resultado-preparacion-beta.md` — este resumen.

## Qué NO se ejecutó

- `npm run db:demo-reset` — no, no hay DB local segura.
- `prisma db seed` — no.
- `prisma migrate reset` — no.
- Comandos contra Railway / Neon / Supabase / cualquier DB
  remota — no.
- Deploy — no.
- Creación de usuarios reales — no.

## Validaciones

| Comando                                         | Resultado |
|-------------------------------------------------|-----------|
| `npx prisma validate`                           | ✓ `schema is valid` |
| `npm run lint`                                  | ✓ sin warnings |
| `npm run build`                                 | ✓ |
| `npx tsc --noEmit -p tsconfig.json`             | ✓ (cubre `scripts/guard-demo-reset.ts`) |

Schema, modelos, endpoints, UI y `prisma/seed.ts` no
modificados.

## Dictamen

**A) Apto para abrir PB-13C como microciclo de deploy real
autorizado**, sujeto a las casillas pendientes documentadas en
`pb-13b-deploy-beta-privada.md §12`:

- Acordar fecha de inicio con paciente/profesional.
- Crear bucket R2/S3 con CORS.
- Crear proyecto Railway con variables (`DATABASE_URL`,
  `AUTH_SECRET`, `TZ`, `MAX_UPLOAD_MB`, `S3_*`).
- Decidir flujo de login real (form email/password vs alternativa).
- Aceptación explícita de "sin borrado de datos" por parte del
  paciente.

Las piezas operativas que dejaba pendientes PB-13A
(procedimiento de deploy, evitar `db seed` en Railway, guard de
`db:demo-reset`, `TZ` documentada) **están todas cubiertas**.

## Próximo paso recomendado

**PB-13C — Deploy beta privada (ejecución)**: con la
autorización explícita del operador y la confirmación de las
casillas de §12 cumplidas, ejecutar Railway + R2 + alta manual
+ smoke test + onboarding.

Si antes de eso aparece la duda del **login real** (botones demo
de `/login` apuntan solo a `DEMO_PROFILES`), abrir un PB-13D
chico para mostrar un form `email + password` cubriendo el
caso. Es un trabajo cerrado y de bajo riesgo.

## Confirmación de alcance

- Prisma schema **no modificado**.
- Migraciones **no creadas**.
- Modelos **no modificados**.
- Endpoints, UI, auth **sin cambios**.
- `prisma/seed.ts` **sin cambios**.
- No se hizo deploy, no se tocó Railway, secrets, `.env`,
  producción ni servicios externos.
- No se crearon usuarios reales.
