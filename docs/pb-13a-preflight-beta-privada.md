# PB-13A — Preflight beta privada usable

Microciclo: **PB-13A** (documental, sin código).
Estado del repo: post PB-12C (`c634f69`).

## 1. Objetivo de la beta privada

Pasar de "demo controlada local" a **uso real** durante 7-14
días con un solo profesional y un solo paciente. La intención no
es validar mercado, ni cerrar producto, ni abrir registros: es
**detectar fricciones concretas** del flujo cotidiano
(comida con foto, peso/medidas, ejercicio, adherencia,
revisión profesional) antes de invertir en cualquier expansión
funcional o de usuarios.

Resultado esperado al cierre de la beta: una lista priorizada
de ajustes (PB-13B, PB-13C, …) basada en uso real, no en
hipótesis.

## 2. Alcance

- **1 profesional**: nutricionista colaboradora.
- **1 paciente**: Ariel.
- **Duración**: 7 días iniciales, prorrogable a 14 si el flujo
  funciona.
- **Modalidad**: online, ambos usuarios entran desde sus propios
  dispositivos (no compartido).
- **Privacidad**: la URL pública existe pero **no se difunde**.
  No hay registro abierto: los dos usuarios se crean manualmente
  por el operador (Ariel mismo).
- **Comunicación fuera de la app**: WhatsApp/teléfono entre
  paciente y nutricionista para feedback de la herramienta, no
  para registrar comidas/medidas.

## 3. Funcionalidades a probar

| Dominio                | Cómo se prueba                                              |
|------------------------|-------------------------------------------------------------|
| Comida con foto        | Paciente registra desde `/patient/today` cada slot programado.|
| Peso                   | Paciente carga ≥ 1/semana en `/patient/measurements/new?type=weight`.|
| Cintura (medida)       | Paciente carga ≥ 1/semana en `/patient/measurements/new?type=waist`.|
| Ejercicio              | Paciente carga cada actividad en `/patient/exercises/new`.|
| Resumen diario         | Nutricionista revisa `/psychologist/patients/[id]/today` 1-2 veces/semana.|
| Resumen semanal        | Nutricionista revisa `/psychologist/patients/[id]/week` al cerrar la semana.|
| Adherencia de comidas  | Validar conteos `X/Y` día por día. Confirmar que tolerancia 60 min y estados (`PENDIENTE`/`REGISTRADO`/`REGISTRADO_TARDE`/`OMITIDO`) tienen sentido en uso real.|

## 4. Qué NO se prueba todavía

- **Venta** del producto.
- **Múltiples pacientes** por profesional (queda con 1).
- **WhatsApp / push / email** desde la app (comunicación fuera
  del producto).
- **IA prescriptiva**, recomendaciones automáticas, cálculo de
  calorías o macros.
- **Producción abierta**: nadie más se da de alta.
- **Self-onboarding** profesional/paciente.
- **`MeasurementSchedule`** / **`ExerciseSchedule`** /
  **`ClientPlan`** / **`Reminder`** (no existen aún).
- **Transcripción** y resumen IA (siguen siendo stub para
  audio/video; no aplica a la beta nutricional).
- **Edición / borrado** de registros (no implementado).

## 5. Checklist técnica pre-Railway

Aún **no** se hace deploy en este microciclo. Lo que sigue es la
lista de lo que hay que tener listo cuando se autorice el deploy
real (PB-13B o equivalente).

### Variables de entorno requeridas

| Variable                | Origen                                  | Notas                                                              |
|-------------------------|-----------------------------------------|--------------------------------------------------------------------|
| `DATABASE_URL`          | Postgres de Railway                     | Plan free alcanza para 1 paciente × 14 días.                       |
| `AUTH_SECRET`           | `openssl rand -hex 32`                  | Nunca compartir; rotación requiere reset de sesiones.              |
| `S3_ENDPOINT`           | Cloudflare R2 o AWS S3                  | Bucket privado.                                                    |
| `S3_REGION`             | `auto` (R2) o región AWS                |                                                                    |
| `S3_BUCKET`             | Bucket dedicado a la beta               | Recomendado: `pulso-body-beta-private`.                            |
| `S3_ACCESS_KEY_ID`      | Access key del bucket                   | Scope mínimo: solo este bucket.                                    |
| `S3_SECRET_ACCESS_KEY`  | Secret del access key                   |                                                                    |
| `S3_PUBLIC_BASE_URL`    | **Vacío** para la beta                  | Mantener URLs firmadas 1h; no exponer CDN público.                 |
| `MAX_UPLOAD_MB`         | `10` recomendado para la beta           | Foto de comida móvil pesa ≤ 5MB; con 10 hay margen.                |

### Infraestructura

- [ ] Postgres provisionada (Railway), con `DATABASE_URL`
      pegada en las variables del servicio.
- [ ] Bucket S3/R2 **privado** creado con CORS:
  ```json
  [{"AllowedOrigins":["https://<dominio-beta>"],"AllowedMethods":["PUT","GET"],"AllowedHeaders":["*"]}]
  ```
- [ ] Dominio: alcanza el subdominio `*.up.railway.app` que da
      Railway. No comprar dominio propio para la beta.
- [ ] HTTPS automático (Railway lo provee).
- [ ] `prisma migrate deploy` se corre en el `start` script (ya
      configurado en `package.json`). No requiere paso extra.

### Datos iniciales

- [ ] Decidir si se corre `npx prisma db seed`:
  - **Recomendación**: NO. El seed crea usuarios "Psicóloga
    Demo / Paciente Demo 1 / 2" que confunden el escenario real.
  - En su lugar, **alta manual** desde Postgres o desde un
    pequeño script ad-hoc: 2 `User` (nutricionista +
    Ariel), 1 `PatientProfile` que los vincula.
  - Sin `MealSchedule` precargado: la nutricionista los crea
    desde la UI como parte del onboarding.

## 6. Checklist funcional (smoke test en entorno beta)

A correr **una vez** apenas el deploy esté arriba y los
usuarios reales creados, antes de avisar a Ariel/nutricionista:

- [ ] Login profesional → `/psychologist/patients` muestra a
      Ariel.
- [ ] Login paciente (Ariel) → `/patient/today` carga sin
      errores; muestra fallback mock si todavía no hay
      schedules.
- [ ] Profesional crea 3-4 `MealSchedule` para Ariel desde
      `/psychologist/patients/[id]/meal-schedules`.
- [ ] Paciente recarga `/patient/today` y ve los 3-4 slots
      programados.
- [ ] Paciente registra 1 comida con foto desde `/patient/new-entry?intent=meal&slot=...`.
      Verificar que la foto sube al bucket y se ve en el
      timeline profesional.
- [ ] Paciente registra peso (`/patient/measurements/new?type=weight`).
- [ ] Paciente registra cintura (`/patient/measurements/new?type=waist`).
- [ ] Paciente registra ejercicio (`/patient/exercises/new`).
- [ ] Profesional ve los 4 dominios en
      `/psychologist/patients/[id]/timeline`,
      `.../today`, `.../week`.
- [ ] Adherencia diaria/semanal muestra `X/Y` razonable.
- [ ] Logout funciona en ambos roles.

## 7. Riesgos

### Datos sensibles

- **Fotos de comida** y **peso/medidas** son datos personales
  identificables del paciente.
- Mitigación actual: bucket privado + URLs firmadas 1h, JWT con
  `AUTH_SECRET`, validación de propiedad server-side
  (`psychologistId === user.id`).
- **No hay borrado**: si el paciente quiere irse, no existe
  delete de registros. Para la beta se acepta; documentado como
  deuda para post-beta.

### Timezone

- Server corre en huso del proceso Node (Railway = UTC por
  default). Paciente en ART (UTC-3). El "hoy" en la UI puede
  desfasar después de medianoche local.
- Mitigación: setear timezone del servicio Railway a
  `America/Argentina/Buenos_Aires` (variable `TZ`). Más simple
  que implementar timezone por usuario en una beta de 1 paciente.

### Pérdida de datos

- `npm run db:demo-reset` (PB-12C) **borra todos los datos**.
  Si se ejecuta por accidente con la `DATABASE_URL` de Railway,
  se pierde la beta.
- Mitigación operativa:
  1. Nunca cargar la `DATABASE_URL` de Railway en una shell
     local.
  2. Mantener un `.env` local con DB local separada del Railway.
  3. **No** habilitar Railway CLI con base de Railway montada
     localmente.
- (Opcional para PB-13B): renombrar el script a algo más
  defensivo y/o agregar guard contra hosts que no sean
  `localhost`/`127.0.0.1`. Hoy es deuda asumida.

### Storage mal configurado

- Si el bucket no tiene CORS correcto, la subida con presigned
  PUT falla con error genérico. La UI muestra *"No se pudo
  subir el archivo… Probable CORS del bucket"* (ya implementado
  en `new-entry-form.tsx`).
- Verificar CORS antes de avisar a Ariel.

### Confusión demo vs beta

- Si en Railway corre el seed por defecto, en el ambiente
  conviven Psicóloga Demo + Paciente Demo 1/2 + nutricionista
  real + Ariel. Confuso para la nutricionista en su lista de
  pacientes.
- Mitigación: **no** correr `db seed` en Railway. Alta manual
  de los dos usuarios reales.

### Otros riesgos

- **Bucket público accidental**: si `S3_PUBLIC_BASE_URL` se
  setea por error, las fotos pasan a servirse directo. Dejarlo
  vacío para la beta.
- **`MAX_UPLOAD_MB` alto** (default 100): permite subir videos
  pesados sin sentido. Bajar a 10 MB para la beta.
- **Auth sin rate limit**: ya documentado como TODO heredado.
  Riesgo bajo en beta privada de URL no difundida.
- **Sin tests E2E**: cambios futuros no tienen red de seguridad
  automática. Smoke test manual cubre la beta corta.

## 8. Plan de uso real (7 días)

| Día  | Paciente (Ariel)                                       | Profesional (nutricionista)                          |
|------|--------------------------------------------------------|------------------------------------------------------|
| 0    | Onboarding: instalar PWA / agregar a home, login.     | Crea schedules + nota inicial.                        |
| 1-7  | Registra desayuno / almuerzo / merienda / cena con foto cada día. Peso 1×. Cintura 1×. Ejercicio cuando ocurra. | Revisa `/today` Mar/Jue. Revisa `/week` al cierre.  |
| 7    | Cierre: ambos completan un mini-form de fricciones (anotado fuera de la app). | Idem.                                                |

Fricciones a anotar (paciente):
- ¿La foto se sube fácil desde el celular?
- ¿Los slots tienen sentido?
- ¿Falta algún tipo de comida que tengo seguido?
- ¿Cuesta entender qué falta cargar hoy?

Fricciones a anotar (nutricionista):
- ¿Encuentra rápido lo que necesita?
- ¿La adherencia descriptiva ayuda?
- ¿Necesita ver evolución de peso (gráfico)?
- ¿Le falta poder dejar notas/feedback al paciente?

Si en el día 3-4 hay bloqueo claro de UX, parar la beta y
priorizar fix. Si el flujo corre, extender a 14 días.

## 9. Dictamen

**B) Requiere ajustes antes de deploy beta privada.**

El producto compila, el flujo end-to-end es coherente y el
smoke test (PB-11F) no detectó bloqueantes funcionales. Pero
los pasos para "poner Pulso Body en Railway con datos reales"
todavía no están consolidados en un solo procedimiento:

- **No existe documento "Deploy beta privada"** con el
  procedimiento exacto (Railway, R2, alta manual de usuarios,
  variable `TZ`, CORS bucket, `MAX_UPLOAD_MB` ajustado).
- **Alta manual de usuarios** no está automatizada ni
  documentada. Hoy depende de saber Prisma o `psql`.
- **Seed corre por default**: si en Railway el `start` script
  o el operador corre el seed, contamina la beta con usuarios
  demo.
- **`db:demo-reset` no tiene guard** contra ejecutarse en
  Railway por accidente.
- **`TZ` del servicio Railway** no está documentada (afecta
  cálculo de "hoy" y adherencia).
- **Política de retención** y delete de datos del paciente no
  está definida para la beta.

Ninguno de estos bloquea técnicamente, pero acumulados son
suficientes para que la beta arranque incómoda o se
contamine. Vale resolverlos en un microciclo dedicado
(PB-13B) **antes** del deploy.

## Riesgos detectados (resumen)

1. **Confusión demo vs beta** si se ejecuta `db seed` en
   Railway (alto).
2. **Pérdida de datos** si `db:demo-reset` se corre con
   `DATABASE_URL` de Railway (alto, mitigable con disciplina).
3. **Timezone**: cálculo de "hoy" sin `TZ=America/Argentina/Buenos_Aires`
   en Railway (medio).
4. **Bucket público accidental** (medio).
5. **Sin borrado de datos** para baja del paciente post-beta
   (bajo, asumido).
6. **Sin rate limit** en `/api/auth/*` (bajo en beta privada).

## Próximo paso recomendado

**PB-13B — Documento de deploy beta privada + alta de usuarios
manual + guard del `db:demo-reset`**:

1. `docs/pb-13b-deploy-beta-privada.md`: procedimiento exacto
   para Railway + R2, variables, CORS, `TZ`, `MAX_UPLOAD_MB`,
   sin ejecutar `db seed`.
2. Script chico `scripts/create-beta-users.ts` (o snippet
   documentado de `psql`) para crear nutricionista + Ariel y el
   `PatientProfile`.
3. Guard en `db:demo-reset` que verifique que el host de
   `DATABASE_URL` es `localhost` o `127.0.0.1` antes de
   continuar.
4. Smoke test manual post-deploy (checklist de §6 de este doc).

Después de PB-13B, **PB-13C** ya puede ser el deploy real con
la autorización explícita.

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀`.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK.

No hay tests configurados en el repo.

## Confirmación de alcance

- **Solo documentación**. No se modifica código, Prisma, seed,
  migraciones, rutas ni helpers.
- No se ejecuta deploy.
- No se tocan secrets, `.env` ni variables de Railway.
- No se crean usuarios reales.
- No se conecta ningún servicio externo nuevo.
- No avanza a PB-13B/PB-13C.
