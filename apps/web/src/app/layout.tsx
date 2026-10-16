import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { ServiceWorkerRegistration } from "../components/ServiceWorkerRegistration";
import "./styles.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://cobranzaap.tech"),
  title: {
    default: "cobranzapp | Operación de créditos y cobranza",
    template: "%s | cobranzapp",
  },
  description: "Clientes, rutas, verificación y seguimiento operativo para empresas colombianas.",
  applicationName: "cobranzapp",
  icons: {
    apple: [{ url: "/pwa/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "cobranzapp",
  },
  keywords: ["cobranza", "cartera", "rutas de cobro", "software de cobranza", "Colombia"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "cobranzapp",
    title: "cobranzapp | Operación de créditos y cobranza",
    description: "Clientes, rutas, verificación y seguimiento operativo para empresas colombianas.",
    images: [{ url: "/images/cobranzaap-world.webp", width: 1600, height: 900 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "cobranzapp | Operación de créditos y cobranza",
    description: "Clientes, rutas, verificación y seguimiento operativo para empresas colombianas.",
    images: ["/images/cobranzaap-world.webp"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171a18",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="es-CO">
      <body className={manrope.variable}>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
