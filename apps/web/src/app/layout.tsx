import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "./styles.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://cobranzaap.tech"),
  title: {
    default: "cobranzapp | Control de cartera y cobranza",
    template: "%s | cobranzapp",
  },
  description: "Gestión de créditos y cobranzas para prestamistas independientes en Colombia.",
  applicationName: "cobranzapp",
  keywords: ["cobranza", "cartera", "rutas de cobro", "software de cobranza", "Colombia"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "cobranzapp",
    title: "cobranzapp | Control de cartera y cobranza",
    description: "Cartera, rutas, recaudo y cierres con trazabilidad para equipos colombianos.",
    images: [{ url: "/images/cobranzaap-world.webp", width: 1600, height: 900 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "cobranzapp | Control de cartera y cobranza",
    description: "Cartera, rutas, recaudo y cierres con trazabilidad para equipos colombianos.",
    images: ["/images/cobranzaap-world.webp"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="es-CO">
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}
