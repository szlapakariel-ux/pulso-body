# PB-11A — Resultado: resumen semanal profesional

Microciclo: **PB-11A**
Referencias: PB-6, PB-8B/8C, PB-9, PB-10.

## Objetivo

Dar al profesional una vista de **últimos 7 días** del paciente,
agrupando comidas, peso/medidas y ejercicio por día. Solo lectura.
Sin tocar Prisma, schedules ni adherencia.

---

## Archivos modificados

- `src/app/psychologist/patients/[patientId]/week/page.tsx` —
  **nueva** vista server component.
- `src/app/psychologist/patients/[patientId]/timeline/page.tsx` —
  link adicional "Ver resumen semanal" en el header (junto al
  "Ver resumen de hoy" que sumó PB-10).
- `docs/pb-11a-resultado-resumen-semanal-profesional.md` — este
  documento.

**No se tocó** `prisma/schema.prisma`, migraciones, `TimelineEntry`,
`MeasurementEntry`, `ExerciseEntry`, endpoints ni helpers.

---

## Qué se implementó

### Vista — `/psychologist/patients/[patientId]/week`

- `requireRolePage("PSYCHOLOGIST")`.
- Check `profile.psychologistId === user.id`; `notFound()` si no.
- Header: link `← Timeline`, nombre + email del paciente,
  título "Resumen semanal" y rango de fechas (*"26 de mayo – 1 de
  junio"*).
- Para los últimos 7 días (incluyendo hoy), un `<section>` por día
  con:
  - **Comidas**: contador + chips con el slot de cada una. Si hay
    fotos, sufijo `"N con foto"`.
  - **Peso / medidas**: contador + la última medición del día
    (tipo + valor formateado).
  - **Ejercicio**: contador + total de minutos del día + chips con
    el tipo de cada actividad y su duración.
  - Vacío explícito: *"Sin registros."*
- Sin componentes cliente. Todo server.
- Sin fotos inline (las fotos solo viven en las vistas dedicadas
  por dominio y en `/today` profesional). El semanal queda
  liviano.

### Link desde el timeline profesional

En el header de
`/psychologist/patients/[patientId]/timeline`, los links pasan a
una fila con dos opciones: *"Ver resumen de hoy"* y *"Ver resumen
semanal"*. Sin rediseño.

---

## Cómo se calcula el rango semanal

```ts
const now = new Date();
const end = endOfLocalDay(now);
const startDay = new Date(now);
startDay.setDate(startDay.getDate() - 6);
const start = startOfLocalDay(startDay);
```

Es decir, **hoy y los 6 días previos** (7 días totales). Mismo
patrón que PB-10 con `setHours(0,0,0,0)` / `setHours(23,59,59,999)`.
Usa el **timezone del proceso Node** — limitación heredada,
documentada desde PB-5/PB-6.

---

## Cómo se agrupa por día

- Se construyen los 7 buckets vacíos del rango con clave
  `YYYY-MM-DD` (local) y label `"Lunes 1 de junio"` (`Intl.DateTimeFormat`
  en `es-AR`).
- Cada entrada se agrupa por `dayKey(recordedAt)` y se inserta en
  el bucket correspondiente con un `Map`.
- Los días se renderizan de **más reciente a más antiguo** para
  que "hoy" quede arriba.

Esto evita agregar una dependencia más allá de `Intl` y mantiene
la semántica local del día (no usar UTC).

---

## Qué datos muestra

Por día, en este orden:

1. **Comidas: N** + chips con `MEAL_SLOT_LABEL` (Desayuno,
   Almuerzo, etc.).
2. **Peso / medidas: N** + última medición del día con tipo y
   valor formateados (`Peso · 84.2 kg`).
3. **Ejercicio: N — total** + chips con tipo + duración (`Caminata
   · 30 min`).

Si el día no tiene registros: *"Sin registros."* y el bloque queda
compacto.

---

## Qué quedó fuera de alcance

- **`MealSchedule` / `MeasurementSchedule` / `ExerciseSchedule`**
  — no.
- **Adherencia esperado vs registrado** — no.
- **Selector de fecha o semana arbitraria** (`?week=YYYY-WW`) —
  no. Se fija a "últimos 7 días". Sumar `?date` o `?week` es
  trivial cuando se acompañe con `/today?date=`.
- **Link por día hacia `/today?date=…`** — no se agregó porque
  `/today` aún no acepta param de fecha. Documentado.
- **Gráficos / sparkline** — no.
- **Fotos inline** en el semanal — no, por diseño.
- **Edición / borrado** — no.
- **IA, calorías, recomendaciones** — no.
- **`ClientPlan` / `Reminder`** — no.
- **Railway, secrets, `.env`, deploy, producción** — sin cambios.

---

## Validaciones ejecutadas

- `npx prisma validate` — `schema is valid 🚀` (schema intacto).
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK; nueva ruta
  `/psychologist/patients/[patientId]/week` presente.

No hay tests configurados en el repo.

---

## Riesgos detectados

- **Timezone del proceso Node** para el cálculo de "hoy" y de los
  límites de día. Limitación heredada; cierre real con
  `timezone` por cliente.
- **Three queries por render**: `Promise.all` cubre lo común;
  para 7 días con uso moderado, alcanza. Si el paciente acumula
  muchísimo en una semana (decenas por día), conviene paginar o
  cachear con `unstable_cache`.
- **Buckets en memoria**: con 7 días no escala mal aunque haya
  cientos de entradas, pero ojo si crece a 30 días.
- **`dayKey` local**: depende del huso del server; un cliente en
  otro huso podría ver una comida del "lunes 23:30" agrupada en el
  martes para el server. Mismo problema heredado.
- **Falta de schedules**: el "Sin registros" no implica
  "incumplimiento". El profesional debe interpretar el dato como
  descriptivo, no prescriptivo.

---

## Confirmación de alcance

- `prisma/schema.prisma` **no modificado**.
- No se crearon migraciones.
- `TimelineEntry`, `MeasurementEntry`, `ExerciseEntry` **no
  modificados**.
- No se crearon `MealSchedule`, `MeasurementSchedule`,
  `ExerciseSchedule`, `ClientPlan` ni `Reminder`.
- No se modificó auth, endpoints ni lógica de comidas/medidas/
  ejercicio.
- No se tocó Railway, secrets, `.env`, deploy ni producción.

---

## Recomendación para PB-11B

Avanzar con **PB-11B — Selector de fecha en `/today` y link por
día desde `/week`** como puente antes de meter schedules. Bajo
costo, alto valor para el profesional. Pasos:

1. Aceptar `?date=YYYY-MM-DD` en
   `/psychologist/patients/[patientId]/today`. Parsear con
   `zod`/regex en server; si inválida, usar hoy.
2. Habilitar links por día en el semanal hacia
   `/today?date=YYYY-MM-DD`.
3. (Opcional) Agregar también `?date` en `/patient/today` para el
   paciente, si tiene sentido revisar días anteriores.

Si en lugar de eso se prefiere entrar al mundo de schedules,
**PB-11C — `MealSchedule` mínimo**:

1. Modelo `MealSchedule` con `psychologistId`, `mealSlot`,
   `weekday`, `time`, `active`.
2. Migración aditiva.
3. UI profesional para configurar slots por paciente.
4. Cruzar contra `TimelineEntry` para mostrar adherencia en
   `/today` y `/week`.

La regla heredada sigue valiendo: schedules en **tabla propia**,
no extender `TimelineEntry` ni los `*Entry`.
