# PB-14F — Resultado: UX rápido (anti-cartero)

Microciclo: **PB-14F**.
Modo: aplicar lo simple y seguro **ya**, documentar lo que queda
para mañana. Sin Prisma, DB, deploy ni adherencia.

## Cambios aplicados

### A) Títulos de registros destacados

`src/app/patient/timeline/page.tsx`:
- El título del registro pasa a ser **prominente**: `text-base`
  bold, mayúsculas, color `pulso-ink`. Ej.: **DESAYUNO**, **FOTO**,
  **AUDIO**, **VIDEO**.
- La fecha/hora pasa debajo, **más chica y gris** (`text-xs
  text-pulso-soft`).
- Helper `entryTitle(e)`: MEAL → label del slot (o "Comida");
  audio/video/foto según `mediaType`.
- Resultado visual:
  ```
  DESAYUNO
  03/06/2026, 08:47
  ```
- Se quitó el badge "Comida" redondeado a favor del título
  directo (más legible, menos ruido).

### B) Navegación paciente reordenada

`src/app/patient/layout.tsx`:
- Orden nuevo del nav:
  `Pulso Body | Hoy | Timeline | Ejercicio | Plan | Rutina | {nombre} | Medidas | Salir`
- "Medidas" se movió al final, después del nombre de sesión y
  antes de "Salir". Sin cambios de rutas ni lógica.

### C) Imágenes como miniatura + modal

- Se extendió el componente reusable existente
  `src/components/photo-preview.tsx` (creado en PB-13F) con una
  variante **`thumb`**: miniatura cuadrada **150×150**,
  `object-cover`, clickeable, que abre el **modal/overlay
  fullscreen** ya existente (con botón Cerrar, Escape, click en
  fondo, scroll-lock). Funciona en mobile.
- La variante `full` (comportamiento anterior, ancho completo con
  alto acotado) **queda intacta** → las vistas profesionales que
  ya usaban `PhotoPreview` no cambian.
- Se convirtieron a miniatura `thumb` las fotos de las listas del
  **paciente** (donde todavía había `<img>` a ancho completo):
  - `src/app/patient/timeline/page.tsx`
  - `src/app/patient/measurements/page.tsx`
  - `src/app/patient/exercises/page.tsx`
- Sin librerías externas (se reutiliza el componente propio). Sin
  compresión ni transforms de imagen.

## Archivos modificados

- `src/components/photo-preview.tsx` — variante `thumb`.
- `src/app/patient/timeline/page.tsx` — título destacado + miniatura.
- `src/app/patient/measurements/page.tsx` — miniatura.
- `src/app/patient/exercises/page.tsx` — miniatura.
- `src/app/patient/layout.tsx` — reorden de nav.
- `docs/pb-14f-resultado-ux-rapido.md` — este documento.

## Cambios NO aplicados y motivo

- **Título destacado en vistas profesionales** (timeline, today,
  week): el header profesional mezcla badges, filtros y bloques
  de adherencia; rehacerlo bien excede "rápido y seguro". Se
  aplicó solo a la timeline del paciente (lo que Ariel ve como
  usuario). Queda como follow-up de bajo riesgo.
- **Miniatura en vistas profesionales**: ya usan `PhotoPreview`
  en variante `full` desde PB-13F; cambiarlas a `thumb` es una
  decisión de UX del profesional (puede preferir ver la foto más
  grande al revisar). No se tocó para no alterar esa vista sin
  pedido explícito.
- **Compresión real de miniaturas / `next/image`**: fuera de
  alcance (requiere config de `remotePatterns` + presigned URLs);
  documentado para más adelante.

## Explícitamente para mañana (PB-15 / posterior)

- Checklist Hoy/Ayer/Mañana.
- Estados Cumplido / Parcial / Pendiente / No cumplido.
- Navegación múltiple por días.
- Cálculo de porcentaje de cumplimiento.
- Compresión real de miniaturas.
- Reglas de adherencia fina.

## Validaciones

- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK.

(No corresponde `prisma validate` — no se tocó schema.)

## Confirmación de alcance

- No se tocó: Prisma, migraciones, DB, Railway, Cloudflare,
  deploy, auth, usuarios, passwords, storage/R2/upload, lógica
  de carga de fotos, plan alimentario, rutina, mediciones (lógica),
  adherencia.
- No se rediseñó "Hoy" como checklist ni se implementó
  Ayer/Hoy/Mañana, cumplimiento parcial ni porcentajes.
- Sin avanzar PB-15.
