# PB-13F — Resultado: ajuste UX de imágenes en vista profesional

Microciclo: **PB-13F**.
Origen: feedback de uso real durante la beta privada (PB-13D).

## Problema observado

En la vista profesional, las fotos cargadas por el paciente
(`<img className="w-full rounded-lg" />`) se renderizaban a
ancho completo del card y sin tope de altura. En fotos verticales
de celular, eso empujaba el resto del contenido del card muy
lejos hacia abajo, rompiendo el flujo de lectura cuando el
profesional escanea varios registros.

## Criterio UX elegido

1. **Preview acotada** por defecto.
2. **Click/tap** abre la imagen completa en un overlay simple
   (modal/lightbox).
3. **No cambia** ningún flujo funcional (registro, adherencia,
   upload). Es solo cómo se ve la foto ya cargada.

Implementado en un único componente cliente reutilizable:
`src/components/photo-preview.tsx`.

Parámetros visuales:

- `max-h-[260px]` en móvil (≤ 640 px de viewport).
- `sm:max-h-[320px]` en desktop.
- `object-cover` para que verticales y horizontales encajen sin
  deformación.
- `rounded-lg` consistente con el resto de la UI.
- `aria-label="Ampliar foto"` en el botón.
- Overlay full-screen `bg-black/80` con click en el fondo o
  tecla `Escape` para cerrar.
- `document.body.overflow="hidden"` mientras el overlay está
  abierto (evita scroll del fondo).
- Botón "Cerrar" arriba a la derecha para descubrir gestos no
  obvios.
- `loading="lazy"` en el thumbnail para no firmar/descargar
  todas las fotos del scroll de una vez.

## Archivos modificados

- `src/components/photo-preview.tsx` — **nuevo** componente
  cliente.
- `src/app/psychologist/patients/[patientId]/timeline/page.tsx`
  — reemplaza el `<img>` de PHOTO por `<PhotoPreview>`.
- `src/app/psychologist/patients/[patientId]/today/page.tsx`
  — 3 reemplazos (comida, peso/medida, ejercicio).
- `src/app/psychologist/patients/[patientId]/measurements/page.tsx`
  — 1 reemplazo (foto de progreso).
- `src/app/psychologist/patients/[patientId]/exercises/page.tsx`
  — 1 reemplazo (foto del ejercicio).
- `docs/pb-13f-resultado-ajuste-imagenes-profesional.md` — este
  doc.

`/psychologist/.../week` no se modificó: por diseño de PB-11A
no muestra fotos inline.

**Vistas de paciente sin cambios**: `/patient/timeline`,
`/patient/measurements`, `/patient/exercises`. El feedback fue
específico a la vista profesional; cambiar la del paciente
ameritaría su propia conversación de UX y queda fuera de
scope.

## Validaciones

- `npx prisma validate` — `schema is valid 🚀`.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — OK.

## Resultado esperado

- En `/psychologist/.../timeline`: la foto de comida ocupa máximo
  260 px en móvil y 320 px en desktop; el resto del card
  (notas, IA, controles) queda inmediatamente accesible.
- Click/tap sobre la foto abre la versión completa en overlay.
- En `/psychologist/.../today`: idem para comida, peso y
  ejercicio.
- En `/psychologist/.../measurements` y `.../exercises`: idem.
- En `/psychologist/.../week`: sin cambio.

## Fuera de alcance

- Vistas de paciente.
- Lógica de upload o storage.
- Cualquier endpoint, modelo o migración.
- Optimización de imágenes server-side (Next/Image, blur,
  responsive `srcset`). Queda como mejora futura.
- Reemplazo del `<img>` por `next/image`: requiere configurar
  `images.remotePatterns` con R2/S3 y agregar control de
  presigned URLs (las URLs firmadas cambian a 1h). No vale el
  riesgo hoy.

## Próximo paso recomendado

- **PB-13G — Mismo ajuste UX para el paciente**: si Ariel ve
  sus propias fotos con el mismo problema cuando hace scroll
  largo de `/patient/timeline`, replicar `<PhotoPreview>` ahí.
- O **PB-14** según el roadmap acordado tras el cierre de la
  beta.
