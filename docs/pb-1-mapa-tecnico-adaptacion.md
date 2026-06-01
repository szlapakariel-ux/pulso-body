# PB-1 — Mapa técnico de adaptación Pulso → Pulso Body

Microciclo: **PB-1**
Estado: documento técnico inicial. **No implica cambios de código.**
Referencia: `docs/contrato-producto-pulso-body.md` (PB-0).

Este documento traza el camino para adaptar el repositorio actual, heredado de Pulso, hacia Pulso Body. Define qué se conserva, qué cambia, qué se renombra, qué entidades y rutas se proponen, y en qué orden avanzar.

---

## 1. Estado actual del repo

El repositorio mantiene la estructura del producto **Pulso original**, orientado a acompañamiento emocional/terapéutico entre sesiones.

Conceptos heredados detectados:

- **Roles:** paciente / psicóloga.
- **Timeline** como eje central de registros.
- **Audio y video** como tipos de media principales.
- **Transcripción** de audio/video.
- **Resumen IA** descriptivo del timeline.
- **Notas privadas** del profesional.
- **Almacenamiento:** S3 / R2 para archivos.
- **Base de datos:** Prisma + PostgreSQL.
- **Autenticación:** flujo actual con roles paciente/profesional.

Esta base técnica es sólida y reutilizable; el cambio será principalmente de **dominio funcional** y **vocabulario**, no de stack.

---

## 2. Qué se conserva

- Next.js
- TypeScript
- Tailwind
- Prisma
- PostgreSQL
- S3 / R2
- Autenticación
- Lógica de roles
- Timeline
- Subida de archivos
- Notas privadas del profesional
- IA descriptiva (con los límites definidos en PB-0)

---

## 3. Qué debe cambiar

- **Identidad visual y textual:** de Pulso a Pulso Body.
- **Dominio funcional:** de registro emocional a bitácora corporal (nutrición, ejercicio, peso, medidas).
- **Soporte de media:** agregar **foto** como tipo principal (ingestas, ejercicio, medidas).
- **Rutas actuales `/patient` y `/psychologist`:** decidir si se mantienen temporalmente o se migran a `/client` y `/professional`. Recomendación: migrar en PB-2 con redirects temporales para no romper enlaces.
- **Textos:** eliminar referencias a "psicóloga", "paciente terapéutico", "sesión", "emoción".
- **Seed demo:** generar profesional + cliente + plan + ingestas programadas.
- **README:** redirigir a Pulso Body.
- **Prisma schema:** adaptar al modelo objetivo (sección 5).
- **Tipos de registros:** de `AUDIO/VIDEO` a `PHOTO/AUDIO/VIDEO` con `PHOTO` como tipo dominante.

---

## 4. Conceptos a renombrar

| Actual | Nuevo sugerido | Notas |
|---|---|---|
| `Psychologist` | `Professional` | Cubre nutricionista, entrenador, coach, salud. |
| `Patient` | `Client` (o `Patient`) | Preferencia: `Client`. Mantener `Patient` solo si hay impacto fuerte en auth. |
| `TimelineEntry` | `BodyEntry` | Entrada base de bitácora corporal. |
| `PrivateNote` | `ProfessionalNote` | Nota visible solo para el profesional. |
| `MediaType AUDIO/VIDEO` | `MediaType PHOTO/AUDIO/VIDEO` | Agregar `PHOTO` como principal. |
| `Transcription` | Mantener solo si se conserva audio/video. | Opcional para nota de voz. |
| `aiSummary` | `descriptiveSummary` | Refuerza el límite "solo descriptivo". |
| `PatientProfile` | `ClientProfile` | Coherente con el renombre. |
| `DailySummarySettings` | `SummarySettings` o `ReminderSettings` | Según uso final (resumen vs recordatorio). |

---

## 5. Modelo de datos objetivo

Entidades propuestas y función:

- **User** — cuenta de acceso, credenciales, rol base.
- **ProfessionalProfile** — perfil del profesional (nutricionista, entrenador, coach, salud).
- **ClientProfile** — perfil del paciente/cliente con datos básicos y vínculo a su profesional.
- **ClientPlan** — plan activo del cliente: vincula horarios de ingesta, ejercicio y medidas.
- **MealSchedule** — horarios de ingestas programadas (desayuno, colación, almuerzo, merienda, cena, custom).
- **ExerciseSchedule** — ejercicios programados por día y horario.
- **MeasurementSchedule** — qué medir y con qué frecuencia (diario, 15 días, mensual, custom).
- **MealEntry** — registro real de una ingesta (foto, hora, tipo, nota, estado).
- **ExerciseEntry** — registro real de un ejercicio (realizado, duración, intensidad, nota, foto).
- **MeasurementEntry** — registro real de una medida (valor, fecha, foto opcional).
- **Reminder** — recordatorio interno (etapa 1: agenda interna).
- **ProfessionalNote** — nota privada del profesional sobre un cliente o entrada.
- **WeeklySummary** — resumen descriptivo semanal (adherencia, patrones).
- **CorrectionHistory** — historial de ediciones (valor anterior, nuevo, autor, fecha).

---

## 6. Rutas sugeridas para MVP

### Paciente / cliente

- `/login`
- `/client/today`
- `/client/meals/new`
- `/client/exercises/new`
- `/client/measurements/new`
- `/client/timeline`

### Profesional

- `/professional/clients`
- `/professional/clients/[clientId]/today`
- `/professional/clients/[clientId]/timeline`
- `/professional/clients/[clientId]/plan`
- `/professional/clients/[clientId]/measurements`

---

## 7. Endpoints sugeridos

Propuesta inicial (no implementación):

- `POST /api/client/meals`
- `GET  /api/client/today`
- `POST /api/client/exercises`
- `POST /api/client/measurements`
- `GET  /api/professional/clients`
- `GET  /api/professional/clients/:clientId/timeline`
- `POST /api/professional/clients/:clientId/plan`
- `POST /api/professional/entries/:entryId/notes`

---

## 8. MVP técnico recomendado

### MVP 1 incluye

- Login demo.
- Profesional demo.
- Paciente demo.
- Profesional configura horarios de ingesta.
- Paciente ve agenda del día.
- Paciente registra comida con foto.
- Horario automático del registro.
- Timeline del paciente.
- Vista profesional de bitácora diaria.

### MVP 1 excluye

- WhatsApp.
- Push notifications.
- IA compleja.
- Cálculo calórico automático.
- Recomendaciones de dieta.
- Diagnóstico médico.
- Deploy a producción.

---

## 9. Riesgos técnicos

- Mezclar demasiado rápido Pulso original con Pulso Body (deuda de identidad y datos cruzados).
- Romper autenticación al renombrar roles (`Psychologist` → `Professional`).
- Migración Prisma demasiado grande en un solo paso.
- Implementar recordatorios antes de tener agenda interna funcionando.
- Meter IA prescriptiva (cruza los límites del contrato PB-0).
- Manejar fotos corporales sin permisos claros (consentimiento, retención, acceso del profesional).

---

## 10. Orden recomendado de próximos microciclos

- **PB-2** — Renombrado seguro de identidad visual/textual.
- **PB-3** — Modelo Prisma objetivo documental.
- **PB-4** — Implementación mínima de foto en registros.
- **PB-5** — Agenda diaria interna.
- **PB-6** — Registro de comida con foto.
- **PB-7** — Vista profesional de bitácora.
- **PB-8** — Peso y medidas.
- **PB-9** — Ejercicio programado.
- **PB-10** — Resumen semanal descriptivo.

---

## Alcance de PB-1

Solo documentación. No se modifica código, Prisma, rutas, seeds, configuración, dependencias ni producción.
