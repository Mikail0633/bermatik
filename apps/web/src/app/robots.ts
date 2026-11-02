import type { MetadataRoute } from "next";

// Arama motorlarına: panel, API ve kişiye özel sayfaları tarama
export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/panel/", "/admin/", "/giris", "/kayit", "/*/yakinimda"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
