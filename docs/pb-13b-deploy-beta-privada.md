# PB-13B — Procedimiento de deploy beta privada

Microciclo: **PB-13B** (documental + guard de seguridad).
Base: PB-13A (preflight).

> Este documento es el **procedimiento canónico** para llevar
> Pulso Body a Railway en modalidad **beta privada**. No es un
> instructivo para producción abierta.

---

## 1. Objetivo

- Tener Pulso Body corriendo online para **un (1) profesional
  nutricionista** y **un (1) paciente (Ariel)**.
- **Duración**: 7 días iniciales, prorrogable a 14.
- **Resultado esperado**: lista priorizada de fricciones reales
  para guiar el roadmap post-beta.

---

## 2. Qué NO es

- **Producción abierta.** La URL existe pero **no se difunde**.
- **No hay venta** del producto durante esta beta.
- **No hay múltiples pacientes** por profesional.
- **No hay onboarding público**: los 2 usuarios se cargan
  manualmente por el operador.
- **No hay WhatsApp / push / email** desde la app.
- **No hay IA prescriptiva** ni recomendaciones nutricionales
  automáticas.

---

## 3. Checklist Railway

| Paso | Acción                                                                                      | Notas                                                                                          |
|------|---------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| 3.1  | Crear nuevo proyecto en Railway.                                                            | Plan free alcanza para 1 paciente × 14 días.                                                   |
| 3.2  | Conectar el repo `szlapakariel-ux/pulso-body`.                                              | Permitir lectura del branch default.                                                           |
| 3.3  | Branch a deployar: el **default actual** del repo.                                          | No usar feature branches en la beta.                                                           |
| 3.4  | Agregar **PostgreSQL** como servicio managed.                                               | Railway expone `DATABASE_URL` automáticamente.                                                 |
| 3.5  | Variables de entorno del servicio web:                                                      |                                                                                                |
|      | `DATABASE_URL` (referencia al Postgres del paso 3.4)                                        | Usar la sintaxis de variables linkeadas de Railway.                                            |
|      | `AUTH_SECRET` = string aleatorio largo                                                      | Generar con `openssl rand -hex 32`. Nunca compartir.                                          |
|      | `TZ` = `America/Argentina/Buenos_Aires`                                                     | Crítico: sin esto, `startOfLocalDay/endOfLocalDay` corren en UTC y la adherencia se desfasa.   |
|      | `MAX_UPLOAD_MB` = `10`                                                                      | Foto móvil pesa ≤ 5MB; 10 deja margen sin permitir videos pesados.                             |
| 3.6  | Build command (default): `npm run build`.                                                    | Ya incluye `prisma generate`.                                                                  |
| 3.7  | Start command (default): `npm start`.                                                        | Equivale a `prisma migrate deploy && next start`. Aplica migraciones automáticamente al boot. |
| 3.8  | Healthcheck: `/api/healthz` debe responder 200.                                              | Si Railway lo soporta, configurar como healthcheck path.                                       |
| 3.9  | Confirmar dominio asignado por Railway (`*.up.railway.app`).                                 | No comprar dominio propio para la beta.                                                        |

---

## 4. Checklist R2 / S3

| Paso | Acción                                                                                  | Notas                                                                          |
|------|------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| 4.1  | Crear bucket **privado**: nombre sugerido `pulso-body-beta-private`.                    | No habilitar acceso público.                                                   |
| 4.2  | Crear access key con permisos solo sobre este bucket.                                   | Scope mínimo: PUT/GET sobre `pulso-body-beta-private`.                         |
| 4.3  | Agregar a las variables del servicio web:                                               |                                                                                |
|      | `S3_ENDPOINT` (URL del endpoint R2/S3)                                                   | Para R2: `https://<accountid>.r2.cloudflarestorage.com`.                       |
|      | `S3_REGION` (`auto` para R2; región AWS si S3)                                          |                                                                                |
|      | `S3_BUCKET` = nombre del bucket creado en 4.1                                           |                                                                                |
|      | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`                                              | Pegar exactamente lo que devolvió 4.2.                                         |
|      | `S3_PUBLIC_BASE_URL` = **vacío**                                                         | Mantener vacío: las descargas usan URLs firmadas 1h.                            |
| 4.4  | Configurar CORS del bucket para el dominio de Railway:                                  |                                                                                |
|      | ```json                                                                                 |                                                                                |
|      | [{"AllowedOrigins":["https://<subdominio>.up.railway.app"],"AllowedMethods":["PUT","GET"],"AllowedHeaders":["*"]}] |                                                                                |
|      | ```                                                                                     | Reemplazar `<subdominio>` por el real una vez asignado en 3.9.                 |
| 4.5  | Probar manualmente que el bucket NO es accesible sin firma.                             | `curl https://<endpoint>/<bucket>/test` debe dar 403/404.                       |

---

## 5. Migraciones

- **Sí**: el `start` script ya corre `prisma migrate deploy`
  automáticamente al iniciar el servicio. **No hay paso manual**.
- **No**: nunca correr `prisma migrate reset` contra Railway.
- **No**: nunca correr `npm run db:demo-reset` contra Railway.
  El guard agregado en PB-13B (sección 11) lo bloquea si la URL
  no es local, pero la disciplina humana sigue siendo la
  primera línea de defensa.
- Si una migración nueva entra al default después del deploy
  inicial, el siguiente reboot la aplica sola.

---

## 6. Seed

- **NO correr `npx prisma db seed` en Railway.**
- El seed crea **Psicóloga Demo / Paciente Demo 1 / Paciente Demo 2**
  + mini-seed Pulso Body (PB-12B): contamina el escenario real,
  confunde a la nutricionista en su listado de pacientes.
- El seed sigue siendo válido y útil **solo en desarrollo
  local**.
- La beta usa **usuarios reales** cargados manualmente. Ver §7.

---

## 7. Alta manual de usuarios reales

> No incluir emails reales ni passwords reales en este
> documento ni en el repo. Lo que sigue son **plantillas**.

### Opción A — Prisma Studio (solo si está autorizado)

1. En la máquina del operador, exportar
   `DATABASE_URL=<la URL de Railway>` **en una shell efímera**
   (no en `.env`, no persistir).
2. `npx prisma studio` abre el editor visual.
3. En tabla `User` crear 2 filas:
   - Nutricionista: `name`, `email` único interno
     (`<algo>@pulso.local` recomendado para mantener uniqueness),
     `role = PSYCHOLOGIST`, `passwordHash` = hash bcrypt de una
     contraseña descartable.
   - Paciente Ariel: idem con `role = PATIENT`.
4. En tabla `PatientProfile` crear 1 fila:
   `userId = <id de Ariel>`, `psychologistId = <id de nutricionista>`.
5. Cerrar Studio y limpiar la variable
   (`unset DATABASE_URL`).

### Opción B — Script ad-hoc (recomendado, sin emails reales)

Crear en máquina local (no commitear) un archivo
`scripts/_local-create-beta-users.ts` con la forma:

```ts
// NO COMMITEAR. Borrar después de usar.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD!, 10);

  const psy = await prisma.user.create({
    data: {
      name: process.env.PSY_NAME!,
      email: process.env.PSY_EMAIL!,
      passwordHash,
      role: "PSYCHOLOGIST",
    },
  });
  const patient = await prisma.user.create({
    data: {
      name: process.env.PATIENT_NAME!,
      email: process.env.PATIENT_EMAIL!,
      passwordHash,
      role: "PATIENT",
    },
  });
  await prisma.patientProfile.create({
    data: { userId: patient.id, psychologistId: psy.id },
  });
  console.log("Beta users creados.");
}
main().finally(() => prisma.$disconnect());
```

Correr con:

```bash
DATABASE_URL='<railway>' \
SEED_PASSWORD='<descartable>' \
PSY_NAME='<nombre>' PSY_EMAIL='<email-único-interno>' \
PATIENT_NAME='<nombre>' PATIENT_EMAIL='<email-único-interno>' \
  npx tsx scripts/_local-create-beta-users.ts
```

Borrar el archivo después de usar. **No** ingresarlo al repo.

### Notas sobre login

- Pulso Body usa **selector de perfil** demo en `/login` que
  apunta a `DEMO_PROFILES` (`src/lib/demo.ts`). Esos botones
  **no sirven** para usuarios reales.
- El login real depende de la combinación email/password contra
  `prisma.user`. Si todavía no hay UI estándar de email/password
  visible, usar el endpoint que ya consume el login estándar
  (`POST /api/auth/login`) o agregar un PB-13D corto que muestre
  el form. Confirmar antes de la beta.

---

## 8. Smoke test post-deploy

A correr **una vez** apenas el deploy esté arriba y los
usuarios reales creados, antes de avisar al paciente/profesional:

- [ ] `/api/healthz` responde 200.
- [ ] Login profesional → `/psychologist/patients` muestra a
      Ariel (y a nadie más).
- [ ] Login paciente (Ariel) → `/patient/today` carga.
- [ ] Profesional crea 3-4 `MealSchedule` para Ariel desde
      `/psychologist/patients/[id]/meal-schedules`.
- [ ] Paciente recarga `/patient/today` y ve los slots reales.
- [ ] Paciente registra **1 comida con foto** desde el celular.
      La foto sube al bucket y se ve inline en el resumen
      profesional.
- [ ] Paciente registra peso, cintura y 1 ejercicio.
- [ ] Profesional ve los 4 dominios en `/timeline`, `/today`,
      `/week`.
- [ ] Adherencia diaria muestra conteos coherentes.
- [ ] Logout funciona en ambos roles.

Si algún paso falla, **no avisar a Ariel/nutricionista hasta
arreglarlo**.

---

## 9. Riesgos y mitigaciones

| Riesgo                                          | Mitigación aplicada en PB-13B                                          | Mitigación operativa pendiente del operador          |
|-------------------------------------------------|------------------------------------------------------------------------|------------------------------------------------------|
| Confusión demo vs beta (correr `db seed`)       | §6 prohíbe explícitamente.                                             | Cero ejecución de `db seed` contra Railway.          |
| Pérdida de datos por `db:demo-reset` accidental | Guard `scripts/guard-demo-reset.ts` bloquea si host ≠ local.           | Nunca exportar `DATABASE_URL` de Railway en la shell de desarrollo. |
| Timezone desfasado                              | §3.5: `TZ=America/Argentina/Buenos_Aires` documentado como obligatorio.| Confirmar antes del primer login real.               |
| Bucket público accidental                       | §4.3: `S3_PUBLIC_BASE_URL` debe quedar vacío.                          | Doble-check antes de avisar usuarios.                |
| Datos reales sin política de retención          | Documentado como deuda; aceptado para 7-14 días.                       | Acordar con paciente que post-beta los datos se borran. |
| Sin rate limit en `/api/auth/*`                 | Documentado como TODO heredado.                                         | URL no difundida; riesgo bajo en beta privada.       |
| Sin borrado de registros por parte del usuario  | Documentado como deuda.                                                | Si el paciente quiere borrar, hacerlo manualmente vía Prisma Studio. |

---

## 10. Plan de uso real (resumen)

(Plan detallado en `docs/pb-13a-preflight-beta-privada.md` §8.)

- **Día 0**: deploy + alta manual + smoke test + onboarding.
- **Días 1–7**: paciente registra cotidiano. Profesional revisa
  Mar y Jue. Cierre de semana con `/week`.
- **Día 7**: ambos completan mini-form de fricciones por fuera
  de la app.
- **Día 8 en adelante**: si todo fluye, extender a 14. Si hay
  bloqueo claro, parar y priorizar fix.

---

## 11. Guard agregado en PB-13B

Archivo: `scripts/guard-demo-reset.ts`.

Comportamiento:

- Lee `DATABASE_URL` del entorno.
- Parsea como `URL` (acepta `postgres://`, `postgresql://`).
- Si `hostname` ∈ `{ localhost, 127.0.0.1, ::1 }` → continúa.
- Cualquier otro host → imprime mensaje claro y `process.exit(1)`.
- Si `DATABASE_URL` está vacía o no parsea → `exit(1)`.

`package.json`:

```json
"db:demo-reset": "tsx scripts/guard-demo-reset.ts && prisma migrate reset --force"
```

Por el `&&`, si el guard aborta, `prisma migrate reset` no se
ejecuta. La primera línea de defensa es el guard; la segunda es
la disciplina del operador (no exportar la URL de Railway en
ninguna shell de dev).

**No se ejecutó** `npm run db:demo-reset` en este microciclo: no
hay DB local segura disponible. El guard se valida solo por
build/lint/TS.

---

## 12. Criterio de aptitud para PB-13C

PB-13C puede ser **el deploy real autorizado** cuando todas las
condiciones siguientes se cumplen:

- [x] Guard de `db:demo-reset` agregado y validado vía TS/build.
- [x] Este documento existe y está mergeado en default.
- [x] `prisma validate` ✓, `npm run lint` ✓, `npm run build` ✓.
- [ ] Acordada la fecha de inicio con Ariel y la nutricionista.
- [ ] Bucket R2/S3 creado y con CORS correcto (operador).
- [ ] Proyecto Railway creado con todas las variables de §3.5
      (operador).
- [ ] Decisión sobre login real (botones demo vs form
      email/password) acordada.
- [ ] Aceptación explícita del riesgo "sin borrado de datos"
      por parte del paciente.

Cuando las casillas pendientes estén listas, abrir PB-13C como
microciclo de **ejecución del deploy** (no documental).
