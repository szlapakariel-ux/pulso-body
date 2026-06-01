# PB-5 — Resultado: agenda diaria interna mínima

Microciclo: **PB-5**
Referencias:
- `docs/contrato-producto-pulso-body.md`
- `docs/pb-1-mapa-tecnico-adaptacion.md`
- `docs/pb-3-modelo-prisma-objetivo.md`
- `docs/pb-4-resultado-photo-media-type.md`

## Objetivo

Crear una primera pantalla de **agenda diaria interna** para el
paciente/cliente, sin persistencia nueva y sin tocar Prisma. La pantalla
queda como base visual de los futuros horarios programados por el
profesional.

---

## Archivos modificados

- `src/app/patient/today/page.tsx` — nuevo. Página `/patient/today`.
- `src/app/patient/layout.tsx` — agrega navegación: "Hoy" y "Timeline".
  El logo "Pulso Body" del header ahora apunta a `/patient/today`.
- `docs/pb-5-resultado-agenda-diaria-interna.md` — este documento.

---

## Qué se implementó

- **Ruta** `/patient/today` (server component, `requireRolePage("PATIENT")`).
- **Encabezado**: título "Hoy", subtítulo "Agenda diaria de Pulso Body" y
  fecha actual en español (`toLocaleDateString("es-AR")`).
- **Nota explícita** en la página: *"Esta agenda es una primera versión
  interna. Los horarios reales serán configurables por el profesional en
  próximos microciclos."*
- **Cards de agenda** mock (array local `AGENDA`), con los siete ítems
  pedidos:
  - 08:00 Desayuno (PENDING, "Registrar con foto")
  - 08:00 Peso / medidas (OUT_OF_SCOPE, "Próximamente")
  - 11:00 Colación (PENDING, "Registrar con foto")
  - 13:30 Almuerzo (PENDING, "Registrar con foto")
  - 17:00 Merienda (PENDING, "Registrar con foto")
  - 19:00 Ejercicio (OUT_OF_SCOPE, "Próximamente")
  - 21:00 Cena (PENDING, "Registrar con foto")
- **Estados** (mock visual): `PENDING` / `REGISTERED` / `OUT_OF_SCOPE`,
  con etiquetas "Pendiente" / "Registrado" / "Próximamente".
- **Acción de comida**: link a `/patient/new-entry?intent=meal&slot=<id>`.
  El query param es **opcional y solo informativo** — `new-entry` lo ignora
  hoy y sigue funcionando igual.
- **Acción no-comida**: botón deshabilitado "Próximamente" (ejercicio y
  peso/medidas no se pueden cargar todavía).
- **Footer** de la página: "Por ahora las comidas se cargan desde el
  registro general con foto."
- **Navegación** del layout: enlaces "Hoy" y "Timeline" en el header del
  paciente.

---

## Qué quedó mockeado

- **Array `AGENDA`** local a la página. No viene de DB, no hay endpoint, no
  hay `MealSchedule` ni `ExerciseSchedule` ni `MeasurementSchedule`.
- **Horarios fijos** (08:00, 11:00, 13:30, etc.). No son configurables por
  el profesional todavía.
- **Estado de cada ítem** es estático (todos `PENDING` para comidas, todos
  `OUT_OF_SCOPE` para ejercicio y peso/medidas). No se cruza con
  `TimelineEntry` para determinar "ya registrado".
- **Fecha actual** se calcula en el server con el timezone del proceso. No
  hay todavía configuración de timezone por cliente.
- **Tolerancia de atraso, días activos, requiresPhoto** del contrato PB-0
  no aplican hoy (sin schedules persistidos).

---

## Qué NO se implementó

- **Prisma**: schema y migraciones intactos.
- `MealEntry`, `ExerciseEntry`, `MeasurementEntry`.
- `ClientPlan`, `MealSchedule`, `ExerciseSchedule`, `MeasurementSchedule`.
- `Reminder`, recordatorios reales, notificaciones push, WhatsApp/email.
- Renombrado de rutas (`/patient` se mantiene) ni de roles.
- Auth y permisos: sin cambios.
- Endpoints nuevos: ninguno.
- Producción, Railway, secrets, `.env`, deploy: sin cambios.

---

## Validaciones ejecutadas

- `npx prisma validate` — `The schema at prisma/schema.prisma is valid 🚀`.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK; nueva ruta `/patient/today` aparece en el listado
  (178 B / 96.1 kB First Load JS), 18 rutas en total, sin errores TS.

No hay tests configurados en el repo; no se ejecutaron tests.

---

## Riesgos detectados

- **Disonancia mock vs real**: el cliente verá "Pendiente" para todas las
  comidas incluso si ya cargó algo en `/patient/timeline` el mismo día.
  Esperable y aclarado en el copy, pero conviene cerrarlo apenas haya
  `MealEntry`.
- **Timezone del servidor**: `new Date()` y `toLocaleDateString("es-AR")`
  usan el timezone del proceso Node, no del cliente. Para Argentina/UTC-3
  suele alcanzar, pero un cliente en otro huso puede ver una fecha
  desfasada. PB-3 §14 ya marca este riesgo.
- **Query param `?intent=meal&slot=<id>`**: hoy es decorativo. Si alguien
  empieza a depender de él en `new-entry` sin validación, hay riesgo de
  estado roto. Conviene formalizarlo (zod) cuando se use de verdad.
- **Layout-header con tres links**: en pantallas chicas el header podría
  apretarse. El cambio es chico y no rompe nada hoy, pero conviene
  revisarlo cuando se agreguen más entradas de menú.
- **Logo del header** ahora apunta a `/patient/today`. Si el usuario
  esperaba volver al timeline tocando el logo, cambia el comportamiento.
  Aceptable porque `/today` se vuelve la home funcional del paciente, pero
  vale documentarlo.
- **Sin endpoint, sin DB**: no hay riesgo de fuga de datos en esta página
  (solo lee la sesión vía `requireRolePage`).

---

## Recomendación para PB-6

Avanzar con **PB-6 — Registro de comida con foto** según el orden de
`docs/pb-1-mapa-tecnico-adaptacion.md`.

Sub-pasos sugeridos para PB-6:

1. Decidir si se persiste **`MealEntry`** como tabla nueva o si se sigue
   reutilizando `TimelineEntry` con un campo discriminador
   (`entryKind: "MEAL" | "GENERIC"` o el `intent` del query param). La
   forma más conservadora para PB-6 es persistir en `TimelineEntry` y
   posponer `MealEntry` para cuando aparezca el plan/schedule.
2. Si se elige `MealEntry`: una migración Prisma chica con campos mínimos
   (`clientId`, `mediaKey`, `mealType`, `recordedAt`, `note`, `status`),
   más un endpoint `POST /api/patient/meals` (o similar bajo
   `/patient/entries` con `mediaType: PHOTO + meta: meal`).
3. Si se elige `TimelineEntry` con `intent`: aceptar `intent` en el body
   del `complete`, persistir como `contextLabel` o como nuevo campo
   opcional `entryKind`, y mostrar en la timeline el badge "Comida".
4. Cruzar la agenda de `/patient/today` con los registros del día para
   pasar items de `PENDING` a `REGISTERED`.
5. Mantener PHOTO ya implementado (PB-4) como única vía de captura para
   ingestas en MVP.
6. Documentar en `docs/pb-6-resultado-registro-comida-foto.md`.

La opción más chica y reversible para PB-6 es **reutilizar `TimelineEntry`
+ `intent=meal`** sin tocar el schema. Eso desbloquea la vista profesional
sin abrir migración.
