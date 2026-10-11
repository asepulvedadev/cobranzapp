import type { MetadataRoute } from "next";
import { blogPosts } from "../data/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://cobranzaap.tech";
  return [
    { url: baseUrl, lastModified: new Date("2026-10-11"), changeFrequency: "weekly", priority: 1 },
    {
      url: `${baseUrl}/producto`,
      lastModified: new Date("2026-10-11"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date("2026-10-11"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/nosotros`,
      lastModified: new Date("2026-10-11"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contacto`,
      lastModified: new Date("2026-10-11"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacidad`,
      lastModified: new Date("2026-10-11"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terminos`,
      lastModified: new Date("2026-10-11"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...blogPosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
