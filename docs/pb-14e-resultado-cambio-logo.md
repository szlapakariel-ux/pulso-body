# PB-14E — Resultado: cambio de color del logo

Microciclo: **PB-14E**.
Pedido: Ariel — cambiar **solo** el color del logo/ícono (se
confunde visualmente). Sin tocar la paleta general.

## Dónde estaba el logo

El logo gráfico de Pulso Body son los **iconos PWA** en
`public/icons/`:
- `public/icons/icon-192.svg`
- `public/icons/icon-512.svg`

Ambos: un `rect` de fondo redondeado + una `polyline` tipo
"pulso" (latido) en color crema (`#F8F7F2`).

El logo de **texto** "Pulso Body" (header paciente, header
profesional, login) **no usa color verde** — hereda el color de
texto `pulso-ink` (`#1B221F`). No requería cambios.

> Nota: PB-13G ya había pasado el `themeColor` / `theme_color` a
> negro, pero dejó **explícitamente** los SVG de iconos fuera de
> alcance. PB-14E cierra justamente ese pendiente.

## Qué color tenía antes / qué color tiene ahora

| Elemento | Antes | Ahora |
|----------|-------|-------|
| Fondo de `icon-192.svg` (`rect fill`) | `#5C8770` (verde) | `#111111` (negro) |
| Fondo de `icon-512.svg` (`rect fill`) | `#5C8770` (verde) | `#111111` (negro) |

- La **línea de pulso** crema (`#F8F7F2`) y la forma se mantienen
  idénticas: solo cambia el color de fondo del ícono.
- `#111111` es el mismo negro que ya usa `pulso.accent` y el
  `themeColor` desde PB-13G — consistencia total con la marca
  actual.

## Archivos modificados

- `public/icons/icon-192.svg` — `fill` del rect de fondo.
- `public/icons/icon-512.svg` — `fill` del rect de fondo.
- `docs/pb-14e-resultado-cambio-logo.md` — este documento.

## Qué NO se tocó

- Texto "Pulso Body" (sin cambios; ya era negro/ink).
- Botones, cards, formularios, inputs.
- Paleta general (`tailwind.config.ts`, `globals.css`): sin
  cambios.
- `manifest.ts` / `layout.tsx`: sin cambios (el `themeColor` ya
  era negro desde PB-13G).
- El ícono de play en `video-card.tsx` (no es el logo).
- Prisma, migraciones, DB, Railway, Cloudflare, auth, usuarios,
  passwords, storage/upload/fotos.
- Plan alimentario, rutina, mediciones, adherencia.
- No se avanzó a PB-15.

## Validaciones

- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK.

(No corresponde `prisma validate` — no se tocó schema.)

## Pendiente / nota operativa

- El cambio impacta el **ícono instalado de la PWA** y el
  splash. Los dispositivos que ya tengan la PWA instalada pueden
  conservar el ícono viejo en caché hasta reinstalar / refrescar.
  No requiere acción de código.
- No se hace deploy en este microciclo (alcance prohibido). El
  ícono nuevo se ve live recién tras el próximo deploy autorizado.
