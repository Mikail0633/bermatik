import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { call } from "@/lib/db";
import { SEGMENTS, isSegment, type ShopCard } from "@/lib/types";
import { ShopListPage } from "@/components/ShopListPage";

// Konuma göre sonuçlar: kişiye özel olduğu için Google'a kapalı
export const metadata: Metadata = { title: "Yakınımdakiler", robots: { index: false } };

export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ segment: string }>;
  searchParams: Promise<{ lat?: string; lng?: string }>;
}) {
  const { segment } = await params;
  if (!isSegment(segment)) notFound();
  const { lat: latS, lng: lngS } = await searchParams;
  const lat = Number(latS), lng = Number(lngS);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 35 || lat > 43 || lng < 25 || lng > 45) notFound();

  // Önce 5 km, bulunamazsa 15, sonra 50 km
  let shops: ShopCard[] = [];
  let radius = 5;
  for (radius of [5, 15, 50]) {
    shops = await call<ShopCard>("api.Shop_Search", { Segment: segment, Latitude: lat, Longitude: lng, RadiusKm: radius, Limit: 50 });
    if (shops.length) break;
  }
  const seg = SEGMENTS[segment];
  return (
    <ShopListPage
      segment={segment}
      title={`Yakınındaki ${seg.shops}`}
      intro={shops.length ? `${radius} km içinde ${shops.length} ${seg.shop} bulundu. En yakın olan en üstte.` : `${radius} km içinde ${seg.shop} bulunamadı.`}
      crumbs={[{ href: `/${segment}/yakinimda?lat=${latS}&lng=${lngS}`, label: "Yakınımda" }]}
      shops={shops}
      center={[lat, lng]}
    />
  );
}
