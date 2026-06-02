# PB-13E — Resultado real del deploy beta privada

Microciclo: **PB-13E** (documental).
Base: PB-13A (preflight), PB-13B (procedimiento), PB-13C (login
real), PB-13D (operación manual asistida), PB-13F (ajuste UX
post-uso real).

> Este documento registra **hechos verificados** por el operador
> humano durante la ejecución real de la beta privada. No
> incluye URLs adicionales, smoke tests inventados ni datos
> sensibles.

---

## 1. Resumen ejecutivo

Pulso Body fue desplegado en Railway como **beta privada
controlada** con 1 profesional y 1 paciente (Ariel) como
usuarios reales de prueba. El flujo end-to-end fue validado en
vivo desde un dispositivo Android: login real, configuración
de comidas programadas, registro de comida con foto, visibilidad
en panel profesional. La URL no se difunde.

Durante el deploy aparecieron 2 incidentes, ambos detectados y
corregidos antes de cerrar el smoke test:

1. **Exposición accidental de Access Key R2** en chat →
   revocada y reemplazada por una key nueva, cargada en Railway.
2. **Permiso R2 read-only** insuficiente para el upload via
   presigned PUT → ajustado a read & write.

Dictamen: **A) Beta privada lista para uso controlado**.

---

## 2. URL beta privada

`https://pulso-body-production.up.railway.app`

- Dominio asignado por Railway.
- HTTPS automático provisto por la plataforma.
- **No difundir.** Solo profesional y paciente del alcance
  acordado.

---

## 3. Estado deploy

- Build Railway: **OK**.
- Start activo: `prisma migrate deploy && next start` (definido
  en `package.json` desde antes; sin overrides).
- `/api/healthz` responde:
  - `ok=true`
  - `database=configured`
  - `storage=configured`

---

## 4. Estado DB / migraciones

- Bootstrap inicial sobre DB vacía: `prisma db push` + `prisma
  migrate resolve` para reconciliar el historial existente con
  el schema actual.
- Después del bootstrap, el flujo normal corre `prisma migrate
  deploy` en cada start (sin intervención).
- Estado actual: **sin migraciones pendientes**.
- No se ejecutó `prisma migrate reset`.
- No se ejecutó `prisma db seed`.

---

## 5. Estado storage R2

- Bucket R2 **privado**.
- CORS configurado para el dominio Railway.
- `S3_PUBLIC_BASE_URL` **no seteada** → lecturas vía URL firmada
  1h (`presignDownload` en `src/lib/s3.ts`).
- `MAX_UPLOAD_MB` acotado al valor convenido para la beta.
- `TZ` del servicio Railway alineada a la zona horaria del
  paciente.

---

## 6. Incidente: key R2 expuesta y rotación

- **Detección**: Access Key R2 fue compartida en chat antes de
  cargarla en Railway. La superficie de exposición incluye el
  historial de chat.
- **Acción**: la key expuesta fue **revocada** en Cloudflare
  R2.
- **Reemplazo**: se generó una key nueva con el mismo scope
  (acceso al bucket de la beta), cargada en las variables del
  servicio Railway.
- **Confirmación operativa**: la key actual en Railway es la
  rotada, no la expuesta.

Lección registrada: las credenciales no deben pasar por canales
de chat. Para próximas rotaciones, generar la key directamente
en la pestaña de variables de Railway sin pegado intermedio.

---

## 7. Incidente: permiso R2 read-only → read & write

- **Síntoma**: durante el smoke test inicial, el `POST` a
  `/api/patient/entries` action=init devolvía la URL firmada
  correctamente, pero el `PUT` directo al bucket fallaba.
- **Causa**: la key R2 tenía scope **"Object Read only"**.
- **Fix**: ajustar la key a **"Object Read & Write"** sobre el
  bucket de la beta.
- **Resultado**: el `PUT` posterior devolvió OK, y el `POST`
  complete pudo persistir la entrada con la `mediaKey` real.

No requirió cambios en código.

---

## 8. Usuarios reales de prueba creados

- 1 `User` con `role = PSYCHOLOGIST` (profesional de prueba).
- 1 `User` con `role = PATIENT` (Ariel).
- 1 `PatientProfile` vinculando Ariel al profesional.

Alta hecha **manualmente** contra la DB de Railway por el
operador. Sin uso de `db seed`. Sin `DEMO_PROFILES` cargados en
la beta.

Este documento **no** incluye emails ni contraseñas.

---

## 9. Smoke test real paso por paso

| # | Paso                                                              | Resultado |
|---|-------------------------------------------------------------------|-----------|
| 1 | `/api/healthz`                                                    | ok=true · database=configured · storage=configured |
| 2 | Login profesional con usuario real (form email/password de PB-13C)| OK        |
| 3 | `/psychologist/patients` muestra solo a Ariel                     | OK        |
| 4 | Login paciente Ariel                                              | OK        |
| 5 | `/patient/today` carga                                            | OK        |
| 6 | Profesional crea comidas programadas (`/meal-schedules`)          | OK        |
| 7 | Paciente ve comidas programadas en `/patient/today`               | OK        |
| 8 | Paciente registra comida con foto desde Android                   | OK        |
| 9 | Foto sube al bucket y se ve en panel profesional                  | OK        |
| 13| Profesional ve timeline, today, week con paciente y fotos         | OK        |

Pasos 10–12 (peso, cintura, ejercicio): cubiertos por el flujo
ya validado en PB-12B / PB-11B-C / PB-11B-D; no se forzaron en
este smoke. Quedan como verificación a hacer durante el uso
real cotidiano de los 7-14 días.

---

## 10. Evidencia de upload foto

- `POST /api/patient/entries` action=init → **200**.
- `PUT` directo a R2 → inferido **OK** por la respuesta exitosa
  del paso siguiente.
- `POST /api/patient/entries` action=complete → **200**.
- Verificación visual: la foto aparece en el timeline del
  paciente.

---

## 11. Evidencia de vista profesional

- Listado de pacientes muestra **únicamente** a Ariel (el alta
  manual cargó un solo paciente vinculado a este profesional).
- En el timeline profesional de Ariel, la foto cargada se ve.
- El ajuste UX de fotos (PB-13F) ya estaba aplicado al momento
  del registro.

---

## 12. Confirmación de acciones NO ejecutadas

- `prisma db seed` en Railway: **no ejecutado**.
- `npm run db:demo-reset`: **no ejecutado**. Además, el guard
  agregado en PB-13B (`scripts/guard-demo-reset.ts`) bloquea su
  ejecución contra hosts no-locales.
- `prisma migrate reset`: **no ejecutado**.
- Carga de `DEMO_PROFILES` en Railway: **no ejecutado**.

---

## 13. Riesgos pendientes

1. **Rotación de password de prueba**: la contraseña usada para
   la primera alta queda activa. Para limpieza, conviene
   cambiarla por algo definitivo antes de que Ariel arranque
   con el uso cotidiano.
2. **Sin rate limit** en `/api/auth/*` (heredado).
3. **Sin borrado de registros** desde la UI: si Ariel decide
   irse, el operador hace delete manual contra la DB.
4. **Sesión JWT 7 días**: en una beta de 14 días requiere un
   re-login a mitad de camino.
5. **Bloque "Solo demo local"** sigue visible en `/login` en
   Railway. Con copy explícito alcanza para la beta, pero
   conviene esconder en producción (env-aware) en un microciclo
   futuro.
6. **`MOCK_MEALS` fallback** sigue vivo en `/patient/today`
   para pacientes sin schedules. Para la beta no afecta porque
   el profesional ya creó los schedules de Ariel.
7. **Timezone**: el huso del servicio Railway debe permanecer
   alineado a `America/Argentina/Buenos_Aires`. Cualquier
   cambio futuro de Railway requiere re-validar.
8. **Comparación post-rotación de R2 key**: si en el futuro
   hay otra rotación, repetir el smoke test de upload para
   confirmar permisos.

---

## 14. No bloqueantes

- Ajuste UX de tamaño de fotos en vista profesional: cerrado
  en PB-13F (`docs/pb-13f-resultado-ajuste-imagenes-profesional.md`).
- Mejoras futuras consideradas y descartadas para el alcance
  de la beta: `next/image` con presigned URLs, lightbox
  avanzado con swipe, soporte de múltiples fotos por entrada,
  paginación de timeline.

---

## 15. Dictamen

**A) Beta privada lista para uso controlado.**

Cumple:
- Deploy estable en Railway.
- DB con migraciones aplicadas.
- Storage privado funcional con CORS y URLs firmadas.
- Login real verificado.
- Smoke test de comida con foto exitoso en dispositivo real.
- Vista profesional verificada.
- Incidentes detectados y resueltos antes del cierre.
- Sin contaminación demo en la beta.

---

## 16. Próximo paso recomendado

**PB-14A — Contrato de datos nutricionales y mediciones a
partir del material de Laura / PDFs cargados.**

Sub-pasos sugeridos para PB-14A:

1. Revisar el material aportado por Laura (PDFs).
2. Identificar qué dimensiones de medición / categorías de
   alimentos / variables nutricionales aparecen y aún no están
   modeladas en `MeasurementType` o en el flujo de
   `TimelineEntry MEAL`.
3. Documentar el contrato técnico (qué se modela, qué se
   posterga, qué se descarta) **antes** de tocar Prisma.
4. Mantener la regla heredada: si el dominio merece modelo
   propio, tabla nueva (no extender `TimelineEntry`).

Solo documental. Sin migraciones ni código en PB-14A.
