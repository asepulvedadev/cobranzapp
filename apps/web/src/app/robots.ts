import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/ingresar"] },
    sitemap: "https://cobranzaap.tech/sitemap.xml",
  };
}
