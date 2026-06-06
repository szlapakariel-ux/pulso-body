# PB-15A-UX — Resultado: compactar cards de Hoy

Microciclo: **PB-15A-UX**.
Objetivo: reducir espacio en blanco en las cards de la vista
`/patient/today` y jerarquizar la información, sin cambiar la
lógica de adherencia.

## Archivo modificado

- `src/app/patient/today/page.tsx` (solo la sección **Comidas**;
  import de `ADHERENCE_LABEL` removido porque ya no se usa).

No se tocó ningún otro archivo.

## Antes / después visual

**Antes** (card alta, dos bloques, texto de estado prominente):

```
┌──────────────────────────────────────────┐
│ 08:00 · COMIDA              Registrado   │
│ Desayuno                       tarde     │
│                                          │
│ [ Ver en timeline ]                      │
└──────────────────────────────────────────┘
```

Padding: `p-4` (de `.card`) + `space-y-2` entre bloques + botón
con `py-3` (de `.btn`). Mucho alto vacío.

**Después** (una sola fila, marcador + nombre + hora + botón):

```
┌──────────────────────────────────────────┐
│ ✓  Desayuno · 09:00              [ Ver ] │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ ✓  Almuerzo · 13:00              [ Ver ] │
│    Tarde                                 │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ ○  Cena · 21:00            [ Registrar ] │
└──────────────────────────────────────────┘
```

## Qué se compactó

1. **Layout de una línea**: el `<article>` pasó de
   `card space-y-2` con dos bloques apilados (encabezado +
   botonera) a `card flex items-center gap-3 py-2.5 px-3` con
   marcador + texto + botón en la misma fila.
2. **Padding vertical reducido**: `py-2.5 px-3` en lugar del
   `p-4` heredado de `.card`. Los buttons usan `!py-1.5 !px-3
   text-xs` para no romper la altura.
3. **Marcador visual**:
   - cumplido (`REGISTRADO` o `REGISTRADO_TARDE`): `✓` en
     `text-pulso-accent`.
   - pendiente / omitido: `○` en `text-pulso-soft`.
   - `aria-hidden` en el marcador; la información sigue siendo
     legible por el texto y el label del botón.
4. **Línea principal compacta**: `{título} · {HH:MM}` en una sola
   línea con `truncate` y `flex-1 min-w-0` para que entre en
   mobile.
5. **"Registrado tarde" deja de ser texto principal**: cuando el
   estado es `REGISTRADO_TARDE` se muestra una sub-leyenda
   `Tarde` chiquita (`text-[10px] uppercase tracking-wide
   text-pulso-soft`) debajo del título. No genera alto extra
   relevante.
6. **Botones cortos**:
   - cumplidas → `Ver` (btn-ghost), link a `/patient/timeline`
     (mismo destino que el botón largo anterior).
   - pendientes → `Registrar` (btn-primary), link a
     `/patient/new-entry?intent=meal&slot=<slug>` (mismo destino
     que "Registrar con foto").
   - omitidas → `Registrar` (btn-ghost), mismo link (reemplaza
     "Registrar igual"). Sigue siendo el mismo flujo.

## Disposición mobile-first

- `flex items-center gap-3` con `flex-1 min-w-0 truncate` en el
  título: en pantallas chicas el título se recorta con `…` y el
  botón queda visible — no se necesita salto a 2 líneas.
- Cuando el estado es "tarde", la sub-leyenda baja a una segunda
  línea muy chica (10px) sin agrandar la card.

## Qué NO se tocó

- Reglas de adherencia (`resolveMealAdherence`,
  `scheduleAppliesToday`, `slotToSlug`).
- Prisma, schema, migraciones, DB.
- Railway, Cloudflare, deploy.
- Storage, upload, R2.
- Auth.
- Plan alimentario, rutina, mediciones, adherencia fina.
- Resto de la página: secciones "Peso / medidas" y "Ejercicio"
  quedan tal cual.
- Otras pantallas (timeline, new-entry, etc.) sin cambios.

## Validaciones

- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — ✓ Next.js compila y type-check pasa.
