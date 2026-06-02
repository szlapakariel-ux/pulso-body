# PB-12A — Demo local controlada del MVP

Microciclo: **PB-12A** (documental, sin código).
Estado del repo al cierre: post PB-11G (commit en default `9d5c30e`).

## Objetivo

Dejar un **runbook único** para correr Pulso Body localmente y
guiar una demo end-to-end (paciente → profesional) con datos
suficientes para que el flujo de comidas, peso/medidas, ejercicio
y adherencia se vea funcional. Identificar qué datos demo faltan
hoy y cómo cargarlos sobre la marcha **sin tocar el seed**.

---

## 1. Pre-requisitos

| Componente | Versión / opción mínima                                     |
|------------|-------------------------------------------------------------|
| Node       | 18.18+ (mejor 20+ por Next 14)                              |
| npm        | 9+                                                          |
| Postgres   | 14+ local **o** una instancia remota (Railway/Neon/Supabase)|
| Bucket S3  | Cloudflare R2 o AWS S3 con CORS para PUT/GET                |

Opcional para demo sin foto:
- Si solo se va a mostrar peso/medidas, ejercicio (sin foto), y
  comidas en modo "sin foto" no es posible: el registro de
  **comida con foto** está hardcoded para `mediaType = PHOTO`
  (PB-6). Para una demo completa hay que tener S3/R2 configurado.

---

## 2. Setup local paso a paso

```bash
git clone git@github.com:szlapakariel-ux/pulso-body.git
cd pulso-body
cp .env.example .env
```

Completar `.env`:

```ini
DATABASE_URL=postgresql://USER:PASS@localhost:5432/pulso_body
AUTH_SECRET=$(openssl rand -hex 32)        # cualquier string largo aleatorio

S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=pulso-media-demo
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=                         # vacío → URLs firmadas

MAX_UPLOAD_MB=100
```

Después:

```bash
npm install
npx prisma migrate deploy          # aplica todas las migraciones acumuladas
npx prisma db seed                 # crea Psicóloga + 2 Pacientes + 4 entries
npm run dev                        # http://localhost:3000
```

> **Importante**: en local correr `migrate deploy` (no `migrate dev`),
> así Prisma aplica el set ya commiteado (PB-4, PB-6, PB-8B, PB-9,
> PB-11B-B) sin pedir confirmación interactiva.

### CORS del bucket (mínimo para subir fotos)

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"]
  }
]
```

### Verificación rápida

- `npx prisma validate` debe decir `schema is valid 🚀`.
- `npm run build` debe terminar OK.
- `http://localhost:3000/api/healthz` debe responder 200.

---

## 3. Qué hay y qué falta en el seed

`prisma/seed.ts` actual crea:

- Usuarios: **Psicóloga Demo**, **Paciente Demo 1**,
  **Paciente Demo 2** (idempotente, upsert por `email`).
- `PatientProfile` para los dos pacientes apuntando a la
  Psicóloga.
- 4 `TimelineEntry` legacy con `mediaType` AUDIO/VIDEO + nota
  privada para cada uno. **No** son meals (`entryKind = GENERIC`).

**Gaps para demo de Pulso Body**:

| Dominio              | Estado en seed | Efecto en la demo si no se cargan datos |
|----------------------|----------------|------------------------------------------|
| `MealSchedule`       | **0**          | `/patient/today` cae al fallback mock; `/today` y `/week` profesional dicen "Sin comidas programadas".|
| `TimelineEntry MEAL` | **0**          | "Bitácora de comidas" vacía en el panel profesional.|
| `MeasurementEntry`   | **0**          | Bloques "Peso y medidas" vacíos.|
| `ExerciseEntry`      | **0**          | Bloques "Ejercicio" vacíos.|
| Fotos en bucket      | **0**          | Las `mediaKey` del seed legacy son ficticias (`seed/<userId>/…`): no reproducen audio/foto.|

**Decisión deliberada de PB-12A**: no extender el seed en este
microciclo. Documentar el flujo de carga manual desde la app:
da una demo mucho más representativa que un seed estático y deja
limpio el escenario para PB-13 (seed extendido si hace falta).

---

## 4. Datos demo a cargar antes de la demo

Pre-demo (≈ 5 min con un asistente):

1. Loguearse como **Psicóloga Demo**.
2. Entrar al perfil de **Paciente Demo 1** desde
   `/psychologist/patients`.
3. Tocar **"Configurar comidas"** y crear 3-4 schedules:
   - Desayuno · 08:00 · L-V
   - Almuerzo · 13:30 · L-V
   - Merienda · 17:00 · L-V
   - Cena · 21:00 · todos los días
4. (Opcional) Para que aparezcan tipos "Registrado tarde" y
   "Omitido" en la demo, conviene tener al menos un schedule
   cuya hora ya haya pasado (ej.: si la demo es 16:00, el
   desayuno ya está fuera de tolerancia).
5. Loguearse como **Paciente Demo 1** en otra pestaña/ventana.
6. Registrar:
   - 1 comida con foto desde `/patient/today` (slot que ya pasó
     → quedará "Registrado tarde"; slot dentro de ventana →
     "Registrado").
   - 1 peso (ej. 74.5 kg) en `/patient/measurements/new?type=weight`.
   - 1 medida (ej. cintura 82 cm).
   - 1 actividad (ej. caminata 30 min, intensidad media) en
     `/patient/exercises/new`.

Con esto los 3 dominios + adherencia muestran datos reales.

---

## 5. Guion de demo (paciente → profesional)

Tiempo objetivo: **8–10 min**.

### A) Paciente — 4 min

1. Abrir `/login` → **Entrar como Paciente Demo 1**.
2. En `/patient/today` mostrar:
   - Sección **Comidas** con cada slot programado y su estado
     real (`Pendiente` / `Registrado` / `Registrado tarde` /
     `Omitido`).
   - Sección **Peso / medidas** marcada como Registrado con
     link "Ver historial".
   - Sección **Ejercicio** idem.
3. Tap **"Registrar con foto"** en un slot pendiente:
   `/patient/new-entry?intent=meal&slot=...` → sacar/adjuntar
   foto → Guardar → vuelve a `/patient/today` con el slot ya en
   "Registrado".
4. Mostrar `/patient/measurements` y `/patient/exercises`:
   historial reciente con filtros por tipo.

### B) Profesional — 4 min

5. En otra ventana → `/login` → **Entrar como profesional demo**.
6. `/psychologist/patients` → entrar a **Paciente Demo 1**.
7. Header del timeline muestra: "Ver resumen de hoy",
   "Ver resumen semanal", "Configurar comidas".
8. **Resumen de hoy**:
   - Bloque "Adherencia de comidas": conteo `X/Y` + lista por
     schedule con estados.
   - Bloque "Comidas de hoy" con foto inline.
   - Bloque "Peso y medidas" con valor.
   - Bloque "Ejercicio" con duración.
9. **Resumen semanal**:
   - Adherencia semanal arriba.
   - Línea por día con adherencia local + comidas/medidas/
     ejercicio.
10. **Configurar comidas**: mostrar form, agregar/pausar un
    schedule y ver el cambio reflejado en `/patient/today` al
    recargar.

### Cierre — 1 min

- Recordar que todo se valida server-side (`requireRole` +
  `psychologistId === user.id`).
- Adherencia es **descriptiva**, no juicio clínico.
- No hay IA, no hay calorías, no hay recomendaciones médicas en
  el MVP — fuera de scope por diseño.

---

## 6. Variantes de demo

- **Sin S3 configurado**: posible mostrar peso/medidas y
  ejercicio sin foto; no posible registrar comidas con foto. La
  app responde `503 "Almacenamiento no configurado"` en
  `/api/patient/entries action=init`. Para una demo "sin
  internet" usar este modo + datos de medidas/ejercicio cargados
  por API directa (`curl` o `httpie` apuntando a las rutas POST).
- **Sin schedules**: `/patient/today` muestra el fallback mock
  con copy explícito. Sirve para mostrar la diferencia entre
  "antes" y "después" de configurar comidas.

---

## 7. Hallazgos: qué falta para que la demo sea más fluida

Detectados en este microciclo, **no se implementan acá**:

1. **Seed extendido (PB-13?)**: agregar al `seed.ts` 1-2
   `MealSchedule` por paciente, 1 `MeasurementEntry` con peso,
   1 `ExerciseEntry` con caminata. Subir 1 foto-placeholder al
   bucket demo (o usar `S3_PUBLIC_BASE_URL` con un dominio
   estático). Hace que la demo arranque "viva" sin preámbulo.
2. **Comando dev `db:reset` documentado**: pasos para borrar y
   re-seedear rápido entre demos (`prisma migrate reset
   --force` + `prisma db seed`).
3. **Indicador visual de timezone** en pantallas que cruzan
   "hoy": útil cuando el server corre en UTC y el demo se hace en
   ART. Hoy no se muestra el huso en la UI.
4. **Botón "Repetir demo"** que limpie `MealSchedule` /
   entries del día. Útil para hacer demos consecutivas.
5. **Logout-as** rápido: hoy hay que `/api/auth/logout` y volver
   a `/login`. Un menú de "cambiar de perfil" agilizaría las
   demos.

---

## 8. Confirmación de alcance

- **Solo documentación**. No se crea código, no se modifica
  Prisma, no se altera el seed.
- No se ejecuta ninguna migración contra base real.
- No se modifican rutas, endpoints, auth ni helpers.
- No se toca Railway, secrets, `.env`, deploy ni producción.
- No se renombra ningún módulo.

---

## 9. Recomendación para PB-12B / PB-13

Si después de hacer la demo aparece fricción real:

- **PB-12B — Mini-seed de Pulso Body**: extender `prisma/seed.ts`
  con 1 `MealSchedule` por paciente + 1 medición + 1 ejercicio.
  Aditivo, idempotente (`upsert` o guards por count). Sigue sin
  tocar producción.
- **PB-13 — Reset & re-seed dev**: agregar script `npm run
  db:demo-reset` que combine `migrate reset --force` + `db
  seed`. Documentar uso.

Ninguno entra en este microciclo. PB-12A queda cerrado como
runbook + guion + checklist de gaps detectados.
