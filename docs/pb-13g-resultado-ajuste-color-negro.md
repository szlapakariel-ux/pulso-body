# PB-13G — Resultado: ajuste de color primario a negro

Microciclo: **PB-13G**.
Origen: pedido de Ariel post-beta privada (PB-13D / PB-13F).

## Problema / decisión de diseño

El color primario verde (`#5C8770`) usado como marca en botones
primarios, foco de inputs y borde hover de cards no encajaba
con la dirección visual que Ariel quiere para la beta. Se
solicitó cambiar a **negro**.

Decisión: dado que el repo ya tiene la marca **centralizada en
un token de Tailwind** (`pulso.accent`), basta con mover ese
token a negro y propagar a los dos metadatos (`themeColor` /
`theme_color`). No hay reemplazos masivos de clases.

## Criterio visual elegido

- **`pulso.accent`**: `#5C8770` (verde) → `#111111` (negro
  cercano, no `#000` puro para evitar artefactos de contraste
  en pantallas OLED). Aplica automáticamente a:
  - `.btn-primary` (background).
  - `:focus` de `.input` (border).
  - `hover:border-pulso-accent` en cards de `/psychologist/patients`
    y en `video-card.tsx`.
- **`pulso.ai`**: `#EAF1EC` (verde tinte muy claro de fondo del
  bloque IA en `entry-controls.tsx`) → `#F1F0EB` (gris cálido
  alineado a `pulso.bg`), para evitar que el único "fondo
  verde" residual delate la marca anterior.
- **`themeColor` / `theme_color`** en `layout.tsx` y
  `manifest.ts`: `#5C8770` → `#111111` para consistencia en la
  barra del navegador móvil y en el splash de la PWA.
- **`pulso.highlight = #C99563`** (acento ámbar): se mantiene.
  No se usa hoy como color de marca; sirve como acento
  secundario futuro.
- **Mensajes semánticos**: `text-green-700` en
  `psychologist/settings/settings-form.tsx` indica éxito de
  guardado; **se mantiene**. El prompt protege explícitamente
  los colores semánticos de éxito/error/warning.
- **Errores en rojo** (`text-red-600` en varios forms): se
  mantienen.

## Archivos modificados

- `tailwind.config.ts` — actualiza `pulso.accent` y `pulso.ai`.
- `src/app/layout.tsx` — `themeColor` a negro.
- `src/app/manifest.ts` — `theme_color` a negro.
- `docs/pb-13g-resultado-ajuste-color-negro.md` — este doc.

## Qué se cambió visualmente

- Botones primarios (`.btn-primary`) ahora son **negros con
  texto blanco** en lugar de verdes.
- El foco de los inputs (`:focus`) muestra **borde negro** en
  lugar de borde verde.
- Las cards de pacientes (`/psychologist/patients`) y el botón
  de video preview tienen **hover negro** en lugar de hover
  verde.
- El bloque "Análisis IA" en el panel profesional
  (`entry-controls.tsx`) pasa de **fondo verde clarito** a
  **fondo gris cálido neutro** alineado a la paleta general.
- La barra del navegador móvil y el splash de la PWA se
  muestran en negro.

## Qué se dejó igual

- Layout, jerarquías, espaciados, tipografía.
- `pulso.highlight` (ámbar) para acentos futuros.
- Mensajes de éxito (`text-green-700` en settings) y de error
  (`text-red-600` en forms).
- Backgrounds del card y del cuerpo (`pulso.bg`, `pulso.card`,
  `pulso.mute`).
- `pulso.ink` (`#1B221F`) sigue siendo el color principal de
  texto.

## Validaciones

- `npx prisma validate` — `schema is valid 🚀`.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK.

## Fuera de alcance

- Cambios en Prisma, migraciones, modelos, endpoints, auth,
  upload/storage, Cloudflare, Railway, DB real, usuarios.
- Deploy.
- Cambios de lógica de comidas, medidas, ejercicios,
  adherencia.
- Modificación de los colores semánticos de éxito/error/warning.
- Cambio de tipografía o de espaciados.
- Iconos / favicons (los SVG en `/public/icons` no se tocan;
  si se quiere oscurecerlos, vale un PB-13H corto).

## Próximo paso recomendado

- **PB-14A — Contrato de datos nutricionales y mediciones a
  partir del material de Laura / PDFs cargados**, según lo
  acordado en PB-13E §16.

Si después del primer redeploy Ariel ve algún elemento que
todavía "tira a verde" (p. ej. emojis nativos, iconos del SVG,
algún `bg-green-*` perdido), abrir un PB-13H chico con la lista
puntual.
