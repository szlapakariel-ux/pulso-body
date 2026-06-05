# PB-14G — Resultado: fix de foco en comentario de comida

Microciclo: **PB-14G**.
Bugfix puntual reportado por Ariel: el campo de comentario/contexto
breve en el registro de comidas no permitía escribir de corrido;
parecía aceptar una letra por vez o perder foco al escribir.

## Causa confirmada

`src/app/patient/new-entry/new-entry-form.tsx` declaraba el
componente `ContextFields` **dentro** del cuerpo de `NewEntryForm`
y lo renderizaba como `<ContextFields />`.

Cada vez que el usuario tipeaba una letra:
1. `setContextNote` actualizaba el state de `NewEntryForm`.
2. `NewEntryForm` re-renderizaba.
3. La función `ContextFields` se redefinía como una **referencia
   nueva** en cada render.
4. React veía un "tipo de componente" distinto y
   **desmontaba/remontaba** todo el subárbol de `ContextFields`,
   incluido el `<input id="ctxnote">`.
5. El input remontado perdía el foco → el siguiente caracter no
   entraba o requería volver a tocar el campo.

Patrón clásico de "componente definido dentro de otro componente".

## Solución aplicada

- Se extrajo `ContextFields` **fuera** de `NewEntryForm`, como
  componente top-level del módulo.
- Recibe por props: `contextLabel`, `contextNote`,
  `setContextLabel`, `setContextNote`.
- En `NewEntryForm` se arma una sola instancia memorizada
  implícitamente vía variable local `contextFields` y se
  reutiliza en los dos lugares donde antes se usaba
  `<ContextFields />` (modo `attach` y modo grabación).
- Misma UI, mismos labels, mismos botones, mismo `<input>` con
  mismo `id`, mismo `maxLength`, mismo `placeholder`.
- Mismo guardado: el flujo de `save()` no se tocó, sigue leyendo
  `contextLabel` y `contextNote.trim()` igual que antes.

Resultado: el `<input>` ya no se desmonta en cada keystroke, el
foco se conserva y se puede escribir de corrido (ej. "volviendo
del trabajo") sin re-tocar el campo.

## Archivos modificados

- `src/app/patient/new-entry/new-entry-form.tsx` — extracción de
  `ContextFields` a top-level con props tipadas.
- `docs/pb-14g-resultado-fix-comentario-comida.md` — este documento.

## Qué NO se tocó

- Prisma, migraciones, DB.
- Railway, Cloudflare, deploy.
- Storage/R2/upload, lógica de carga de fotos.
- Auth, usuarios, passwords.
- Plan, rutina, mediciones, adherencia.
- Lógica de guardado (`save()`): payload, endpoints y firmas
  intactos.
- UI de `ContextFields`: mismo markup, mismas clases, mismo
  comportamiento de selección de chips.
- PB-15 no se avanzó.

## Validaciones

- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK (build completo de Next.js, todas las
  rutas compiladas).

(No corresponde `prisma validate` — no se tocó schema.)
