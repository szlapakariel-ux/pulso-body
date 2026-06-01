# PB-3 — Modelo Prisma objetivo

Microciclo: **PB-3**
Estado: documento técnico. **No implica cambios en `prisma/schema.prisma` ni migraciones.**
Referencias:
- `docs/contrato-producto-pulso-body.md`
- `docs/pb-1-mapa-tecnico-adaptacion.md`
- `docs/pb-2-resultado-renombrado-identidad.md`

Este documento define el **modelo Prisma objetivo** para Pulso Body, antes de
tocar el schema real. Sirve como destino para los microciclos siguientes y
como base para una estrategia de migración incremental.

---

## 1. Estado actual del modelo heredado

`prisma/schema.prisma` todavía conserva los modelos de Pulso original,
orientados a **paciente/psicóloga**, **audio/video**, **timeline emocional**
y **transcripción bajo demanda**.

Modelos actuales:

- **User** — cuenta de acceso con `role: Role { PATIENT | PSYCHOLOGIST }`.
- **PatientProfile** — vincula un paciente a su psicóloga (`userId` único,
  `psychologistId`).
- **TimelineEntry** — entrada de timeline con `mediaType: MediaType { AUDIO | VIDEO }`,
  `mediaKey` a S3/R2, `aiTitle`, `aiSummary`, `aiStatus`.
- **PrivateNote** — nota privada de la psicóloga sobre una entrada.
- **Transcription** — estado y texto de transcripción por entrada.
- **DailySummarySettings** — preferencias de envío de resumen diario por
  psicóloga (canal `MANUAL | WHATSAPP | EMAIL`, hora, timezone, enabled).

Estos modelos son el **punto de partida**. No se borran ahora; conviven hasta
que la migración incremental los deprecie.

---

## 2. Modelo objetivo de Pulso Body

Propuesta de modelos para el destino, descritos a alto nivel (no DSL Prisma
final). Los nombres siguen el contrato PB-0/PB-1.

### User
- Cuenta de acceso. `role: Role { CLIENT | PROFESSIONAL }`.
- Campos heredables: `id`, `name`, `email` único, `passwordHash`, timestamps.
- Relaciones: `professionalProfile?`, `clientProfile?`, registros, notas, etc.

### ProfessionalProfile
- Perfil del profesional (nutricionista, entrenador, coach, salud).
- `userId @unique`.
- Datos descriptivos (especialidad, bio, etc.).
- Relación: `clients: ClientProfile[]`.

### ClientProfile
- Perfil del paciente/cliente.
- `userId @unique`.
- `professionalId` (profesional principal en MVP — sección 4).
- Datos básicos: fecha de nacimiento, género, altura inicial, etc.
- Relaciones: `plans: ClientPlan[]`, entradas, notas, mediciones.

### ClientPlan
- Plan activo del cliente: ver sección 5.

### MealSchedule
- Horarios de ingestas programadas: ver sección 6.

### ExerciseSchedule
- Ejercicios programados: ver sección 7.

### MeasurementSchedule
- Mediciones programadas: ver sección 8.

### BodyEntry
- **Entrada base** de bitácora corporal (registro genérico).
- `clientId`, `professionalId`, `type: EntryType`, `recordedAt`,
  `mediaKey?`, `mediaType?`, `note?`, `status: EntryStatus`, timestamps.
- Subtipos especializados: `MealEntry`, `ExerciseEntry`, `MeasurementEntry`.
- Decisión de modelado: usar **tabla base + tablas especializadas** (1-a-1) o
  **una tabla por tipo con discriminador**. Recomendación: tablas
  especializadas con FK opcional a un `BodyEntry` polimórfico **solo si**
  necesitamos timeline unificada. Para MVP, alcanzar con tablas
  especializadas y un view/union en la query.

### MealEntry
- Registro real de una ingesta: ver sección 6.

### ExerciseEntry
- Registro real de un ejercicio: ver sección 7.

### MeasurementEntry
- Registro real de una medida: ver sección 8.

### Reminder
- Recordatorio interno (etapa 1 = agenda dentro de la app).
- `clientId`, `scheduleId?`, `channel: ReminderChannel`,
  `status: ReminderStatus`, `scheduledFor`, `sentAt?`, `ackAt?`.

### ProfessionalNote
- Nota privada del profesional: ver sección 11.

### WeeklySummary
- Resumen semanal descriptivo: ver sección 12.

### CorrectionHistory
- Historial de edición de registros: ver sección 9.

---

## 3. Enums sugeridos

```text
Role:                  CLIENT, PROFESSIONAL
EntryType:             MEAL, EXERCISE, MEASUREMENT, NOTE
MediaType:             PHOTO, AUDIO, VIDEO
MealType:              BREAKFAST, SNACK, LUNCH, AFTERNOON_SNACK, DINNER, CUSTOM
EntryStatus:           SCHEDULED, REGISTERED, REGISTERED_LATE, OMITTED,
                       RESCHEDULED, CANCELLED_BY_PROFESSIONAL
MeasurementType:       WEIGHT, WAIST, HIP, CHEST, ARM, PROGRESS_PHOTO, CUSTOM
MeasurementFrequency:  DAILY, EVERY_15_DAYS, MONTHLY, CUSTOM
ExerciseIntensity:     LOW, MEDIUM, HIGH, CUSTOM
ReminderChannel:       IN_APP, PUSH, WHATSAPP, EMAIL
ReminderStatus:        PENDING, SENT, ACKNOWLEDGED, MISSED, DISABLED
SummaryStatus:         NOT_REQUESTED, PENDING, COMPLETED, FAILED
```

Notas:
- `MediaType` extiende el actual `AUDIO|VIDEO` agregando `PHOTO` como tipo
  dominante en Pulso Body.
- `EntryStatus` cubre los estados definidos en el contrato PB-0 (sección 4).
- `ReminderChannel` incluye `WHATSAPP` y `EMAIL` como **valores reservados**
  para etapas futuras; en MVP solo se usa `IN_APP`.
- `SummaryStatus` reemplaza el actual `AiStatus` para resúmenes semanales.

---

## 4. Relación profesional ↔ cliente

### MVP
- **Un cliente pertenece a un profesional principal**.
- `ClientProfile.professionalId` es FK obligatoria.
- Equivalente directo al actual `PatientProfile.psychologistId`.

### Versión futura
- Un cliente podría tener **varios profesionales** (ej.: nutricionista +
  entrenador).
- Para soportar esto sin migración disruptiva, dejar previsto:
  - Tabla intermedia `ProfessionalClient` con `(professionalId, clientId,
    role, active)`.
  - En MVP no se crea; `ClientProfile.professionalId` cubre el caso simple.
- La migración futura puede:
  1. Crear `ProfessionalClient` y poblarla desde
     `ClientProfile.professionalId`.
  2. Volver opcional `ClientProfile.professionalId` o deprecarla.

---

## 5. Plan del cliente — `ClientPlan`

Campos propuestos:

- `id`
- `professionalId` — FK a `User`/`ProfessionalProfile`.
- `clientId` — FK a `User`/`ClientProfile`.
- `startDate`
- `endDate?`
- `status: PlanStatus { ACTIVE, PAUSED, CLOSED }` (enum adicional propuesto).
- `notes?` — observaciones generales del plan.
- `createdAt`, `updatedAt`.

Relaciones:

- `mealSchedules: MealSchedule[]`
- `exerciseSchedules: ExerciseSchedule[]`
- `measurementSchedules: MeasurementSchedule[]`

Solo un plan **activo** por cliente a la vez. Reglas de unicidad parcial se
modelan a nivel app o con índices condicionales.

---

## 6. Ingestas programadas

### `MealSchedule`
- `id`
- `planId` — FK a `ClientPlan`.
- `mealType: MealType`
- `timeOfDay` — `HH:MM` local.
- `daysOfWeek` — bitmap o `Int[]` con días activos (`0..6`).
- `requiresPhoto: Boolean @default(true)`
- `lateToleranceMinutes: Int @default(60)` — define cuándo `REGISTERED_LATE`.
- `active: Boolean @default(true)`
- `customLabel?` — para `MealType.CUSTOM`.
- timestamps.

### `MealEntry`
- `id`
- `clientId`
- `scheduleId?` — FK opcional a `MealSchedule`. Si null, ingesta no programada.
- `mealType: MealType` — denormalizado para registros ad-hoc.
- `mediaKey?`, `mediaType: MediaType @default(PHOTO)`
- `recordedAt: DateTime @default(now())` — horario automático.
- `note?` — nota breve opcional.
- `status: EntryStatus`
- `wasOnTime: Boolean` — derivable; conviene persistir para queries simples.
- timestamps.

---

## 7. Ejercicios programados

### `ExerciseSchedule`
- `id`
- `planId`
- `exerciseLabel` — texto libre (`"caminata"`, `"fuerza tren superior"`, etc.).
- `daysOfWeek`, `timeOfDay`
- `expectedDurationMinutes?`
- `professionalNote?` — instrucción del profesional.
- `active: Boolean @default(true)`
- timestamps.

### `ExerciseEntry`
- `id`
- `clientId`
- `scheduleId?`
- `performed: Boolean`
- `actualDurationMinutes?`
- `perceivedIntensity: ExerciseIntensity?`
- `note?`
- `mediaKey?`, `mediaType?` — foto opcional.
- `recordedAt: DateTime @default(now())`
- `status: EntryStatus`
- timestamps.

---

## 8. Peso y medidas

### `MeasurementSchedule`
- `id`
- `planId`
- `measurementType: MeasurementType`
- `customLabel?`
- `frequency: MeasurementFrequency`
- `suggestedDayOfWeek?`, `suggestedTimeOfDay?`
- `active: Boolean @default(true)`
- timestamps.

### `MeasurementEntry`
- `id`
- `clientId`
- `scheduleId?`
- `measurementType: MeasurementType`
- `valueNumeric?` — opcional (ej. foto de progreso no tiene valor).
- `unit?` — `"kg"`, `"cm"`, etc.
- `mediaKey?`, `mediaType?: PHOTO` (típico).
- `recordedAt: DateTime @default(now())`
- `status: EntryStatus`
- timestamps.

---

## 9. Historial de correcciones — `CorrectionHistory`

Las mediciones, pesos, ingestas y ejercicios **pueden editarse**, pero
**toda edición debe quedar registrada**.

Campos propuestos:

- `id`
- `entityType: String` — `"MealEntry"`, `"MeasurementEntry"`, etc.
- `entityId: String`
- `fieldName: String`
- `oldValue: String?` — serializado.
- `newValue: String?`
- `editedById` — FK a `User` (cliente o profesional).
- `editedAt: DateTime @default(now())`
- `reason: String?`

Regla:
- El registro original no se sobrescribe sin generar una fila de
  `CorrectionHistory`.
- Para auditoría seria, esto debe aplicarse a nivel de servicio (no solo a
  nivel UI).

---

## 10. Fotos y archivos

Se **reutiliza la infraestructura S3/R2 actual** de Pulso original:

- **`mediaKey`** sigue siendo la clave canónica en el bucket.
- **`mediaType: MediaType`** se extiende a `PHOTO | AUDIO | VIDEO`.
- **Bucket privado por defecto.** Si `S3_PUBLIC_BASE_URL` está definido, se
  sirve por CDN; si no, **URL firmada** de lectura por 1h.
- **Subida** mediante URL firmada (`action=init` / `action=complete`) — las
  claves del bucket nunca llegan al frontend (igual que hoy).
- **Convención de keys** para Pulso Body (propuesta):
  `clients/<clientId>/meals/<entryId>.jpg`
  `clients/<clientId>/exercises/<entryId>.jpg`
  `clients/<clientId>/measurements/<entryId>.jpg`
- **Validación server-side**: el prefijo `clients/<userId>/` debe coincidir
  con `session.userId` antes de persistir, como ya se hace hoy con
  `patients/<userId>/`.

**Sensibilidad**: fotos de comida y, sobre todo, **fotos de progreso
corporal**, son datos sensibles. Reglas mínimas:
- Bucket privado.
- Acceso solo por URL firmada de corta duración.
- Visible solo para el cliente dueño y su profesional principal.
- Borrado en cascada cuando se elimina el `*Entry` correspondiente
  (TODO de Pulso original todavía pendiente; vale también para Pulso Body).
- No exponer keys ni secrets.

---

## 11. Notas privadas — `ProfessionalNote`

Reemplaza al actual `PrivateNote`, ampliando el alcance.

Campos propuestos:

- `id`
- `professionalId` — FK a `User`.
- `clientId` — FK a `User`.
- `entryType?` — opcional, si la nota refiere a un registro específico
  (`"MealEntry"`, `"ExerciseEntry"`, etc.).
- `entryId?` — opcional.
- `content: String`
- `createdAt`, `updatedAt`.

Reglas:
- Si `entryId` es null, la nota es **general** sobre el cliente.
- Si `entryId` está presente, la nota está **anclada** a un registro.
- **Nunca** visible para el cliente. Validación server-side por rol y
  pertenencia.

---

## 12. IA y resumen semanal — `WeeklySummary`

Reemplaza el flujo actual de `DailySummarySettings` + `aiSummary` por uno
**semanal y descriptivo**.

Campos propuestos:

- `id`
- `clientId`
- `professionalId`
- `weekStart: DateTime`
- `weekEnd: DateTime`
- `status: SummaryStatus`
- `summaryText?` — texto descriptivo generado.
- `metrics: Json` — con campos descriptivos:
  - `mealsScheduled`
  - `mealsRegistered`
  - `mealsOmitted`
  - `mealsLate`
  - `exercisesScheduled`
  - `exercisesPerformed`
  - `measurementsPending`
- `generatedAt?`
- timestamps.

Reglas (heredadas del contrato PB-0):

- **Permitido**: descripción de adherencia, patrones (omisiones,
  retrasos, ejercicios faltantes).
- **Prohibido**: diagnóstico, prescripción de dieta, juicio alimentario,
  recomendación médica.
- El prompt del modelo debe reflejar estos límites de forma explícita.

`DailySummarySettings` puede transformarse a `SummarySettings` (frecuencia
semanal, canal, hora, enabled) en una iteración posterior. Para PB-3 alcanza
con dejarlo documentado.

---

## 13. Estrategia de migración recomendada

Solo **propuesta**, no implementación. Fases incrementales para evitar
romper auth ni perder datos.

### Fase A — Roles y entidades nuevas mínimas (no destructiva)
- Mantener `Role { PATIENT, PSYCHOLOGIST }` en uso.
- Agregar entidades nuevas vacías: `ProfessionalProfile`, `ClientProfile`,
  `CorrectionHistory` (estructura).
- No tocar `User`, `PatientProfile`, `TimelineEntry` todavía.

### Fase B — Soporte PHOTO y registros corporales mínimos
- Extender `enum MediaType` con `PHOTO` (mantener `AUDIO`, `VIDEO`).
- Agregar `MealEntry` con campos mínimos (`clientId`, `mediaKey`,
  `recordedAt`, `note`, `status`).
- Agregar `BodyEntry` solo si se necesita timeline unificada; sino,
  postergar.

### Fase C — Plan y horarios de ingesta
- Agregar `ClientPlan` y `MealSchedule`.
- Asociar `MealEntry.scheduleId?` opcional.

### Fase D — Ejercicio y mediciones
- Agregar `ExerciseSchedule`, `ExerciseEntry`, `MeasurementSchedule`,
  `MeasurementEntry`.

### Fase E — Renombrado profundo de roles (opcional)
- Decidir si se renombran `Role { PATIENT, PSYCHOLOGIST }` →
  `Role { CLIENT, PROFESSIONAL }`.
- Esto **rompe** sesiones existentes (JWT con `role` viejo).
- Plan: migración doble (`role_legacy` + `role_new`), backfill, deprecación.

### Fase F — Deprecación de modelos heredados
- Marcar como deprecated `PatientProfile`, `TimelineEntry`,
  `PrivateNote`, `Transcription`, `DailySummarySettings`.
- Migrar datos a `ClientProfile` + `BodyEntry` + `ProfessionalNote` +
  `WeeklySummary`.
- Borrar tablas viejas solo después de varias semanas en producción
  con cobertura nueva.

Cada fase debería ser **una migración Prisma chica y reversible**.

---

## 14. Riesgos

- **Migración Prisma demasiado grande** en un solo paso — alto riesgo de
  bloqueo de tabla y rollback complejo.
- **Pérdida de datos** al renombrar/eliminar columnas en producción sin
  backup verificado.
- **Romper auth** si el `enum Role` cambia y el JWT existente queda
  inválido (sesiones cerradas masivamente).
- **Mezclar `PatientProfile` con `ClientProfile`** en consultas durante la
  transición — ambigüedad de fuente de verdad.
- **Fotos sensibles** (comida y progreso corporal) sin permisos claros — fuga
  de datos personales. Riesgo agravado si se loguea `mediaKey` o se generan
  URLs públicas por error.
- **Recordatorios sin base horaria sólida** — sin `timezone` por cliente, los
  estados `REGISTERED_LATE` y `OMITTED` se calculan mal.
- **IA prescriptiva** — el modelo puede deslizarse hacia recomendaciones si
  el prompt no acota explícitamente. Riesgo legal y de marca.
- **Tabla intermedia futura** (`ProfessionalClient`) si no se prevé desde el
  diseño, puede requerir cambios profundos cuando aparezca el caso real.
- **`CorrectionHistory` evadido** si las ediciones se hacen por raw SQL o por
  un endpoint que olvida llamar al servicio de auditoría.

---

## 15. Recomendación para PB-4

Hay dos opciones tractables:

**Opción A — Documento de migración Prisma incremental.**
Un documento que cierre **fase A** y **fase B** del plan: enums, modelos
mínimos, migraciones SQL aproximadas, orden de despliegue, plan de
rollback. Cero código.

**Opción B — Implementación mínima de soporte `PHOTO`.**
Modificar `prisma/schema.prisma` para agregar `PHOTO` al enum `MediaType` +
migración Prisma chica + ajuste de validación de upload para aceptar
`image/*`. Sin nuevas entidades; solo extender lo existente.

**Recomendación: opción B (implementación mínima de `PHOTO`).**

Motivos:
- Es el cambio más chico que **desbloquea** PB-5 (agenda diaria) y PB-6
  (registro de comida con foto).
- Es **reversible** y aislado: una sola migración, un enum extendido, un
  filtro MIME más permisivo.
- Permite probar el flujo real de subida con `image/jpeg` en R2/S3 antes de
  introducir cualquier modelo nuevo.
- No toca auth, ni roles, ni relaciones.
- Si surge un bloqueo, la fase A documental (opción A) puede entrar como
  PB-4.5 antes de PB-5.

Riesgo a controlar en PB-4: que la migración del enum no rompa los registros
existentes (`AUDIO`, `VIDEO`); Prisma maneja extensión de enum sin pérdida
de datos, pero conviene migrar en dev primero y verificar `prisma migrate
deploy` en una copia de la DB de producción.

---

## Alcance de PB-3

Solo documentación. No se modifica `prisma/schema.prisma`, migraciones,
código, rutas, endpoints, auth, seeds, `package.json`, README, Railway,
secrets ni producción.
