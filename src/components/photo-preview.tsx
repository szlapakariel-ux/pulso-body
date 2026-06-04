"use client";

import { useEffect, useState } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  /** "full" (default) ocupa el ancho con alto acotado; "thumb" es miniatura cuadrada 150x150. */
  variant?: "full" | "thumb";
};

/**
 * Preview de imagen con tamaño acotado y modal "lightbox" simple al click.
 * Usado en la vista profesional para no romper el flujo del card con fotos grandes.
 */
export default function PhotoPreview({ src, alt, className = "", variant = "full" }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isThumb = variant === "thumb";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          isThumb
            ? `block h-[150px] w-[150px] overflow-hidden rounded-lg ${className}`
            : `block w-full overflow-hidden rounded-lg ${className}`
        }
        aria-label="Ampliar foto"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={
            isThumb
              ? "h-[150px] w-[150px] object-cover rounded-lg"
              : "w-full max-h-[260px] sm:max-h-[320px] object-cover rounded-lg"
          }
        />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 rounded-full bg-black/60 px-3 py-1 text-sm text-white"
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>
      )}
    </>
  );
}
