import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/ingresar",
    name: "cobranzapp",
    short_name: "cobranzapp",
    description: "Operación móvil de créditos, clientes, rutas y cobranza.",
    start_url: "/ingresar",
    scope: "/",
    display: "standalone",
    background_color: "#f3f5f3",
    theme_color: "#171a18",
    lang: "es-CO",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Abrir panel", short_name: "Panel", url: "/panel" },
      { name: "Ingresar", short_name: "Ingresar", url: "/ingresar" },
    ],
  };
}
