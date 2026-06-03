# PB-14B — Resultado: mediciones corporales ampliadas

Microciclo: **PB-14B**.
Base: PB-14A (contrato documental, default `2491bcc`).

## 1. Objetivo

Primer paso técnico de la familia PB-14: ampliar las mediciones
corporales que la app puede registrar, según el material de Laura
(Medidas.pdf + plan), con una migración **chica y aditiva**. Sin
tocar planes, comidas, adherencia, rutina ni producción.

## 2. Decisiones tomadas

- **`NECK`, `THIGH`, `BODY_FAT`** se agregan al enum
  `MeasurementType` (registro recurrente vía `MeasurementEntry`).
- **`HEIGHT` NO entra como `MeasurementType`**: la altura es
  casi-estática y ensuciaría los gráficos de evolución. Se modela
  como **dato de perfil**: `PatientProfile.heightCm Float?`
  (decisión del contrato PB-14A §10/§13).
- **`BODY_FAT` usa unidad `%`**; `NECK`/`THIGH` usan `cm`
  (consistente con las otras circunferencias).
- **Condición de medición** (ayunas/mañana/post-baño): NO se
  modela como campo. Sigue siendo protocolo del plan/nota libre,
  igual que decidió PB-14A §10 (opción a). El paciente puede
  seguir usando el campo `note` ("en ayunas") si quiere.
- **UI de altura**: no existe pantalla de perfil/settings del
  paciente. Según la condición #9 del encargo, **no se improvisa
  UI grande**: `heightCm` queda en schema, listo para una UI
  dedicada futura. Documentado como pendiente (§7).

## 3. Migración creada

`prisma/migrations/20260601170000_pb14b_mediciones_ampliadas/migration.sql`:

```sql
ALTER TYPE "MeasurementType" ADD VALUE IF NOT EXISTS 'NECK';
ALTER TYPE "MeasurementType" ADD VALUE IF NOT EXISTS 'THIGH';
ALTER TYPE "MeasurementType" ADD VALUE IF NOT EXISTS 'BODY_FAT';

ALTER TABLE "PatientProfile" ADD COLUMN "heightCm" DOUBLE PRECISION;
```

- **Aditiva y no destructiva**: solo agrega valores de enum y una
  columna nullable. No borra ni renombra nada. No toca filas
  existentes.
- `ADD VALUE IF NOT EXISTS` es seguro en Postgres 12+ (Railway
  corre 14+). Los nuevos valores no se *usan* en la misma
  migración (la columna nueva es `Float`), evitando el límite de
  "enum recién agregado no usable en la misma transacción".
- **No ejecutada contra ninguna DB real.** Queda en disco para
  que el `start` de Railway (`prisma migrate deploy`) la aplique
  en el próximo deploy autorizado, según el procedimiento de
  PB-13B.

## 4. Campos agregados

- `PatientProfile.heightCm Float?` — altura del paciente, dato
  de perfil. Nullable; sin default.

## 5. MeasurementType agregados

| Valor enum | Label | Unidad por defecto | Requiere valor |
|------------|-------|--------------------|----------------|
| `NECK`     | Cuello | `cm` | sí |
| `THIGH`    | Muslo | `cm` | sí |
| `BODY_FAT` | Grasa corporal | `%` | sí |

(`HEIGHT` **no** está acá — es perfil, no medición recurrente.)

## 6. Qué se modificó en UI

- **`/patient/measurements/new`** (`measurement-form.tsx`): el
  selector de tipo ahora ofrece Cuello, Muslo y Grasa corporal.
  El input numérico muestra la unidad correcta (`cm` / `%`) y un
  placeholder adecuado para porcentaje.
- **`/patient/measurements`** (historial paciente): el filtro por
  tipo incluye los tres nuevos; el listado los formatea con label
  + unidad correctos vía `formatMeasurementValue`.
- **`/psychologist/patients/[patientId]/measurements`** (historial
  profesional): mismo filtro y formateo ampliados.
- El resto de las vistas que muestran mediciones
  (`/today` y `/week` profesional, bloque resumen del timeline)
  usan los mismos helpers (`MEASUREMENT_TYPE_LABEL`,
  `formatMeasurementValue`), así que reflejan los nuevos tipos
  **sin cambios adicionales**.

`src/lib/measurements.ts` centraliza labels, unidades
(`defaultUnitFor`), tipos numéricos (`NUMERIC_TYPES`) y el
mapeo slug↔tipo, por lo que el cambio se propaga solo.

## 7. Qué quedó fuera

- **UI de carga de altura (`heightCm`)**: no hay pantalla de
  perfil del paciente. La columna existe; la UI queda pendiente.
  Opciones para un microciclo futuro:
  - pantalla `/patient/profile` mínima (paciente carga su altura
    una vez), o
  - campo de altura en la vista profesional del paciente
    (la profesional la registra).
  No se improvisa acá.
- **Condición de medición estructurada** (`condition` enum):
  postergada (PB-14A §10 opción b). Hoy se cubre con `note`.
- **Planes** (`NutritionPlan`, `GoalPlan`, `TrainingPlan`):
  no entran en PB-14B. Son PB-14C/PB-14D.
- **Cálculo / gráficos de % grasa, IMC** (la altura habilitaría
  IMC): postergado. La altura se guarda; no se computa nada aún.
- Railway, Cloudflare, deploy, DB real, seed, secrets: sin tocar.

## 8. Validaciones

- `npx prisma validate` — `schema is valid 🚀`.
- `npx prisma generate` — cliente regenerado con los nuevos
  valores de enum y `heightCm`.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK.
- Tests: no hay suite configurada en el repo.

**No ejecutado** (por alcance prohibido): `prisma migrate deploy`
/ `migrate reset` / `db seed` / `db:demo-reset` contra cualquier
DB; ningún comando contra Railway.

## 9. Riesgos

1. **Migración de enum en Postgres**: `ALTER TYPE ADD VALUE` es
   seguro y aditivo, pero requiere que el deploy lo aplique con
   `migrate deploy`. Validado localmente con `prisma validate` +
   `generate`. Sin riesgo de pérdida de datos.
2. **`heightCm` sin UI**: la columna queda inerte hasta que se
   construya su pantalla. No rompe nada (nullable), pero es
   deuda visible — documentada en §7.
3. **`BODY_FAT` rango**: la validación API reusa
   `value.positive().lt(1000)`; un % de grasa válido siempre
   cae ahí. Si se quisiera un tope semántico (`< 100`), sería un
   ajuste menor futuro; no se fuerza ahora para no sobre-validar.
4. **Datos existentes**: las mediciones ya cargadas en la beta no
   se ven afectadas; el enum solo crece. Filas previas conservan
   su `type` y `unit`.
5. **Orden de despliegue**: el código nuevo (form con los 3 tipos)
   y la migración deben ir juntos. Como ambos están en este PR y
   el `start` aplica la migración antes de servir, el orden queda
   garantizado en el próximo deploy.

## 10. Próximo paso recomendado

- **UI de altura** (microciclo chico): decidir entre
  `/patient/profile` mínima o carga desde la vista profesional,
  e implementar la lectura/escritura de `heightCm`. Habilita IMC
  descriptivo a futuro.
- **PB-14C — `NutritionPlan` + `MealGuideline` + objetivos**:
  primera ola de la capa de plan, según PB-14A §14. Migración
  mediana.
- Reglas heredadas vigentes: modelo propio por dominio, no
  extender `TimelineEntry`, migraciones aditivas, adherencia
  descriptiva, sin IA prescriptiva ni cálculo calórico.
