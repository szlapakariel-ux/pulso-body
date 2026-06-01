# Pulso Body

Bitácora diaria de **nutrición, ejercicio, peso y medidas corporales**, guiada
por un profesional y registrada en tiempo real por el paciente/cliente.

El profesional define un plan. El paciente registra. La app permite comparar lo
**programado** con lo **realmente registrado**.

Stack: **Next.js 14 (App Router) + TypeScript + Tailwind + Prisma + PostgreSQL (Railway) + S3/R2**.

> **Estado actual:** adaptación inicial desde la base técnica de Pulso. No es
> el MVP final. Algunas **rutas internas, modelos Prisma y nombres de roles**
> todavía conservan el vocabulario heredado (`/patient`, `/psychologist`,
> `PATIENT`, `PSYCHOLOGIST`, `TimelineEntry`, etc.) y se irán migrando en los
> próximos microciclos. Ver `docs/pb-1-mapa-tecnico-adaptacion.md`.

Documentos de referencia:

- `docs/contrato-producto-pulso-body.md` — qué es Pulso Body, roles y alcance.
- `docs/pb-1-mapa-tecnico-adaptacion.md` — mapa técnico de adaptación.
- `docs/pb-2-resultado-renombrado-identidad.md` — resultado de este microciclo.

---

## Roles

- **Paciente / cliente**: registra ingestas, ejercicio y medidas; ve su propia
  línea de tiempo.
- **Profesional** (nutricionista, entrenador, coach de hábitos o profesional de
  salud): define el plan, observa la bitácora, agrega notas privadas.

Internamente los roles todavía se llaman `PATIENT` y `PSYCHOLOGIST` por
herencia técnica. Se renombrarán en un microciclo dedicado.

Permisos aplicados en **backend** (no solo en frontend). Ver checklist más abajo.

---

## Setup local

```bash
cp .env.example .env
# completar DATABASE_URL, AUTH_SECRET y credenciales S3/R2

npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Abrir `http://localhost:3000`.

### Accesos demo (después del seed)

El login es por **selector de perfil** (no email/password). En `/login`
aparecen tres botones que crean sesión directamente contra el perfil demo
correspondiente.

| Botón                              | Nombre              | Email visible                  | Rol            |
|------------------------------------|---------------------|--------------------------------|----------------|
| Entrar como profesional demo       | Psicóloga Demo      | `psicologa.demo@pulso.local`   | `PSYCHOLOGIST` |
| Entrar como paciente demo 1        | Paciente Demo 1     | `paciente1.demo@pulso.local`   | `PATIENT`      |
| Entrar como paciente demo 2        | Paciente Demo 2     | `paciente2.demo@pulso.local`   | `PATIENT`      |

> El email visible es **cosmético**. Internamente cada perfil tiene un email
> único distinto (constraint `@unique` en Prisma) y un `id` distinto. Los
> permisos se validan por `user.id` y `user.role`, nunca por el email visible.

> Los registros de seed apuntan a `mediaKey` ficticias: aparecen en la timeline,
> pero la reproducción solo funciona con archivos subidos desde la app a R2/S3.

> Los nombres internos del seed (`Psicóloga Demo`, etc.) todavía corresponden
> al vocabulario heredado y se actualizarán cuando se renombren los roles.

---

## Comandos

```bash
npm install
npm run dev               # desarrollo
npm run build             # build de producción (incluye prisma generate)
npm run lint
npm start                 # servidor de producción
npx prisma migrate dev    # crear/aplicar migración en dev
npx prisma migrate deploy # aplicar migraciones en prod
npx prisma db seed        # poblar usuarios y datos de prueba
npx prisma validate
```

---

## Deploy

### Base de datos (Railway)

1. Crear un proyecto en Railway y agregar PostgreSQL.
2. Copiar el `DATABASE_URL` (formato `postgresql://...`) a las variables del proyecto.
3. Ejecutar migraciones: `npx prisma migrate deploy`.
4. (Opcional) Seed: `npx prisma db seed`.

### App (Railway o Vercel)

- Variables de entorno: todas las que aparecen en `.env.example`.
- Railway: agregar como servicio Node/Next; build command `npm run build`, start `npm start`.
- Vercel: importar el repo; agregar variables; build command por defecto.

### Almacenamiento (Cloudflare R2 o S3)

- Crear bucket privado.
- Crear access key.
- Configurar CORS para permitir PUT desde el dominio de la app:
  ```json
  [
    {
      "AllowedOrigins": ["https://<tu-dominio>"],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["*"]
    }
  ]
  ```
- Si el bucket es público, definir `S3_PUBLIC_BASE_URL` (las descargas serán directas).
  Si es privado, dejarla vacía y se usarán URLs firmadas de lectura.

---

## Páginas (estructura actual heredada)

```
/login
/patient/timeline
/patient/new-entry
/psychologist/patients
/psychologist/patients/[patientId]/timeline
```

> Rutas objetivo (`/client/...`, `/professional/...`) y nuevas vistas
> (agenda diaria, registro de comida con foto, peso/medidas) se incorporarán
> en los próximos microciclos según el orden definido en
> `docs/pb-1-mapa-tecnico-adaptacion.md`.

## Endpoints (API Routes — estructura actual heredada)

```
POST  /api/auth/login
POST  /api/auth/logout

GET   /api/patient/timeline
POST  /api/patient/entries           # action=init -> URL firmada; action=complete -> persiste

GET   /api/psychologist/patients
GET   /api/psychologist/patients/:patientId/timeline
POST  /api/psychologist/entries/:entryId/notes
POST  /api/psychologist/entries/:entryId/transcription-request
```

---

## Arquitectura

- **Next.js App Router** con Server Components para vistas, Route Handlers para API.
- **Auth**: cookie HttpOnly + JWT firmado con `jose` (HS256). Rol embebido en el token,
  pero el rol y la pertenencia se vuelven a verificar contra la DB en cada request crítico.
- **Prisma + PostgreSQL**: solo metadatos. Archivos viven en R2/S3.
- **Subida directa al bucket**: el cliente pide URL firmada (`action=init`), sube por
  `PUT`, y avisa con `action=complete`. Las claves del bucket nunca llegan al frontend.
- **Descarga**: si `S3_PUBLIC_BASE_URL` está definido, se sirve por CDN; si no, URL firmada
  de lectura por 1h. Como las URL son derivadas server-side, el cliente no ve claves.
- **Transcripción bajo demanda**: `src/lib/transcription.ts` es un stub que devuelve
  `PENDING`. La UI muestra *"Transcripción pendiente de configuración"* hasta que se
  conecte un proveedor real (Whisper, OpenAI, AssemblyAI).
- **Aislamiento**: cada query filtra por `patientId === user.id` (paciente) o
  `psychologistId === user.id` (profesional). Las relaciones se revalidan antes de
  cualquier escritura.

---

## Checklist de seguridad aplicado

- [x] Auth con cookie HttpOnly + JWT firmado (`AUTH_SECRET` por env).
- [x] Validación de rol en **todos** los endpoints sensibles (`requireRole`).
- [x] Validación de pertenencia paciente-profesional antes de leer/escribir.
- [x] Endpoint de paciente nunca devuelve `notes` ni `transcription`.
- [x] Validación server-side con `zod` en cada body de API.
- [x] Validación de tipo MIME y tamaño máximo (`MAX_UPLOAD_MB`).
- [x] `mediaKey` validada server-side: debe empezar con `patients/<userId>/` antes
      de persistir, evitando que un paciente reclame un objeto ajeno.
- [x] URLs firmadas para subida (PUT) y descarga (GET) — claves S3 nunca al frontend.
- [x] Variables de entorno para todos los secretos; `.env` ignorado por git.
- [x] Middleware redirige a `/login` rutas protegidas sin sesión.
- [x] `cookies()` con `secure` en producción y `sameSite=lax`.
- [x] Errores de permisos con códigos 401/403 claros, sin filtrar datos internos.

---

## TODO futuro (Pulso Body)

Ver `docs/pb-1-mapa-tecnico-adaptacion.md` para el orden recomendado de
microciclos (PB-3 modelo Prisma objetivo, PB-4 foto en registros, PB-5 agenda
diaria, PB-6 registro de comida con foto, PB-7 vista profesional de bitácora,
PB-8 peso y medidas, PB-9 ejercicio programado, PB-10 resumen semanal).

TODO técnico heredado todavía pendiente:

- [ ] Conectar proveedor real de transcripción en `src/lib/transcription.ts`.
- [ ] Worker/queue para transcripciones asíncronas.
- [ ] Grabación in-browser con `MediaRecorder`.
- [ ] Eliminación de registros y borrado de objetos en R2.
- [ ] Rate limiting en `/api/auth/login`.
- [ ] Self-onboarding de profesionales y asignación de clientes desde UI.
- [ ] Tests E2E (Playwright).
- [ ] Internacionalización (hoy ES-AR fijo).
- [ ] Indicador de progreso real durante la subida.

---

## Probar paciente

1. En `/login` tocar **Entrar como paciente demo 1** (o demo 2).
2. Tocar **+ Nuevo registro**.
3. Poner título, elegir Audio o Video, adjuntar/grabar.
4. Guardar → vuelve a `/patient/timeline` con el registro recién creado.
5. Verificar que **no** existe ningún link al panel del profesional.

## Probar profesional

1. En `/login` tocar **Entrar como profesional demo**.
2. Ver lista de pacientes/clientes.
3. Entrar a la timeline de un paciente.
4. Agregar una nota privada → aparece solo en este panel.
5. Tocar **Solicitar transcripción** → estado pasa a *Transcripción pendiente de configuración*.
6. Confirmar que el paciente, al loguearse en otra sesión, **no** ve ni la nota
   ni el estado de transcripción.
