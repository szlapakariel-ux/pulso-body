# PB-12C — Resultado: script de reset demo local

Microciclo: **PB-12C**.
Base: PB-12B (mini-seed demo).

## Objetivo

Permitir resetear la base local y volver al estado de seed con
un solo comando, para iterar demos consecutivas sin pasos
manuales.

## Script agregado

En `package.json`:

```json
"db:demo-reset": "prisma migrate reset --force"
```

Una sola invocación porque `prisma migrate reset` ya corre
automáticamente el seed configurado en
`"prisma": { "seed": "tsx prisma/seed.ts" }` del mismo
`package.json`. No hace falta encadenar `&& prisma db seed`.

## Cómo usarlo

```bash
npm run db:demo-reset
```

Lo que hace, en orden:

1. Drop de todas las tablas de la DB apuntada por
   `DATABASE_URL`.
2. Re-creación del schema corriendo todas las migraciones desde
   cero.
3. Ejecución del seed (`tsx prisma/seed.ts`):
   - Crea/actualiza los 3 usuarios demo + sus `PatientProfile`.
   - Crea las 4 `TimelineEntry` legacy AUDIO/VIDEO.
   - Crea el mini-seed Pulso Body de PB-12B para Paciente Demo 1
     (4 schedules + peso/cintura + caminata).
4. Resultado: base en el estado canónico de demo, lista para
   loguearse y mostrar el flujo paciente/profesional.

## Advertencia importante

`prisma migrate reset --force` **borra todos los datos** de la
base apuntada por `DATABASE_URL` sin confirmación interactiva
(`--force` desactiva el prompt). **No usar contra una base
compartida ni contra producción**.

Antes de correrlo, verificar:

```bash
echo "$DATABASE_URL"     # debe apuntar a tu Postgres local
```

Cualquier valor que apunte a Railway, Neon, Supabase u otro
proveedor productivo es **rojo** y conviene cancelar.

Recomendación operativa:
- Mantener un `.env` separado o un `.env.local` con la
  `DATABASE_URL` local.
- Nunca correr `npm run db:demo-reset` desde una terminal con
  variables de producción cargadas.

## Uso recomendado

- **Sí**: entorno de desarrollo individual, demos locales,
  laptops de demo previo a una presentación.
- **No**: staging, producción, ambientes compartidos.

El script es **dev-only por convención**, no por restricción
técnica. La protección depende del operador.

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀` (schema sin
  cambios).
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK.
- **`npm run db:demo-reset` NO ejecutado**: el entorno de este
  microciclo no tiene Postgres local seguro disponible y la
  `DATABASE_URL` actual no debe ser tratada como dev. La
  verificación funcional queda para la demo local real.

## Fuera de alcance

- `prisma/schema.prisma` — no modificado.
- Migraciones — no creadas.
- Modelos — no modificados.
- `prisma/seed.ts` — no modificado.
- Endpoints, UI, auth — sin cambios.
- Railway, secrets, `.env`, deploy, producción — sin cambios.

## Próximo paso recomendado

- **PB-13 — Comidas con foto en seed**: subir 1-2 fotos
  placeholder a un bucket demo dedicado y referenciarlas desde
  `TimelineEntry entryKind = MEAL` para que la adherencia del
  Paciente Demo 1 muestre comidas registradas sin pasos
  manuales. Requiere coordinar `S3_PUBLIC_BASE_URL` y un set de
  archivos estables.
- Alternativa más chica: **PB-12D — `.env.local.example`** que
  apunte explícitamente a `localhost` para evitar accidentes al
  correr el reset.
