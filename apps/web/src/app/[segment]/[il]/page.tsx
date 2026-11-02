import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { call, callOne } from "@/lib/db";
import { SEGMENTS, isSegment, type ShopCard } from "@/lib/types";
import { ShopListPage } from "@/components/ShopListPage";

export const revalidate = 300;

type Area = { ProvinceId: number; Province: string; DistrictId: number | null; District: string | null };
type Params = Promise<{ segment: string; il: string }>;

async function load(params: Params) {
  const { segment, il } = await params;
  if (!isSegment(segment)) notFound();
  const area = await callOne<Area>("api.Area_Resolve", { ProvinceSlug: il });
  if (!area) notFound();
  return { segment, il, area };
}

// Google için: "İstanbul berberleri" sayfası
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { segment, il, area } = await load(params);
  const seg = SEGMENTS[segment];
  return {
    title: `${area.Province} ${seg.shops} — fiyatlar, yorumlar, online randevu`,
    description: `${area.Province} ilindeki ${seg.shops}: açık/kapalı durumu, bugünkü sıra, fiyat listesi ve müşteri yorumları. Bermatik ile hemen randevu al.`,
    alternates: { canonical: `/${segment}/${il}` },
  };
}

export default async function Page({ params }: { params: Params }) {
  const { segment, il, area } = await load(params);
  const seg = SEGMENTS[segment];
  const shops = await call<ShopCard>("api.Shop_Search", { Segment: segment, ProvinceId: area.ProvinceId, Limit: 1000 });

  // Dükkânı olan ilçeler (bağlantı listesi — Google ilçe sayfalarını da bulsun)
  const districts = [...new Map(shops.map((s) => [s.DistrictSlug, s.District])).entries()].sort((a, b) => a[1].localeCompare(b[1], "tr"));

  return (
    <ShopListPage
      segment={segment}
      title={`${area.Province} ${seg.shops}`}
      intro={`${area.Province} genelinde ${shops.length} ${seg.shop}. İlçe seçerek daralt.`}
      crumbs={[{ href: `/${segment}/${il}`, label: area.Province }]}
      shops={shops}
      extra={
        districts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {districts.map(([slug, name]) => (
              <Link key={slug} href={`/${segment}/${il}/${slug}`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-2">
                {name}
              </Link>
            ))}
          </div>
        )
      }
    />
  );
}
