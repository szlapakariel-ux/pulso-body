import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pulso Body",
    short_name: "Pulso Body",
    description: "Bitácora diaria de nutrición, ejercicio, peso y medidas, guiada por tu profesional",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F7F2",
    theme_color: "#111111",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
