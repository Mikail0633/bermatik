import type { MetadataRoute } from "next";
import { call } from "@/lib/db";

// Google'ın tüm dükkân ve il/ilçe sayfalarını bulması için site haritası (/sitemap.xml)
export const revalidate = 3600;

type ShopRow = { Segment: string; ProvinceSlug: string; DistrictSlug: string; ShopSlug: string; UpdatedAt: Date };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  const shops = await call<ShopRow>("api.Seo_SitemapEntries");
  // Dükkânı olan il ve ilçe sayfaları
  const areas = new Set<string>();
  for (const s of shops) {
    areas.add(`/${s.Segment}/${s.ProvinceSlug}`);
    areas.add(`/${s.Segment}/${s.ProvinceSlug}/${s.DistrictSlug}`);
  }
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/kadin`, changeFrequency: "daily", priority: 1 },
    ...[...areas].map((p) => ({ url: `${base}${p}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...shops.map((s) => ({
      url: `${base}/${s.Segment}/${s.ProvinceSlug}/${s.DistrictSlug}/${s.ShopSlug}`,
      lastModified: s.UpdatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
