import { call } from "@/lib/db";
import { fail, handler, ok } from "@/lib/mobile";
import { shopCard } from "@/lib/mobile-map";
import { isSegment, type ShopCard } from "@/lib/types";

/**
 * Ana ekran (sitedeki ana sayfanın aynısı):
 *   hizmet kısayolları + "Şu an açık, bugün müsait" + "En yüksek puanlılar" (aynı dükkân ikisinde çıkmaz)
 *   + "Berberler / Kuaförler" bölümü: Ankara'dakiler, Pursaklar ve çevresi önce.
 * Telefon konum verdiyse (?lat&lng) iki vitrin 25 km içinden, vermediyse sitedeki gibi Ankara'dan seçilir.
 */
export const GET = handler(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const seg = sp.get("bolum") ?? "";
  if (!isSegment(seg)) return fail("Bölüm geçersiz.");
  const lat = Number(sp.get("lat")), lng = Number(sp.get("lng"));
  const near = sp.get("lat") && sp.get("lng") && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  const [categories, ankaraShops, nearShops] = await Promise.all([
    call<{ Id: number; Slug: string; Name: string }>("api.ServiceCategory_List", { Segment: seg }),
    call<ShopCard>("api.Shop_Search", { Segment: seg, ProvinceId: 6, Limit: 100 }),
    near ? call<ShopCard>("api.Shop_Search", { Segment: seg, Latitude: lat, Longitude: lng, RadiusKm: 25, Limit: 200 }) : Promise.resolve(null),
  ]);
  const shops = nearShops ?? ankaraShops;

  const openShort = shops
    .filter((s) => s.IsOpen)
    .sort((a, b) => a.TodayAppointments - b.TodayAppointments || Number(b.AvgRating ?? 0) - Number(a.AvgRating ?? 0))
    .slice(0, 5);
  const shown = new Set(openShort.map((s) => s.Id));
  const topRated = shops
    .filter((s) => s.AvgRating && !shown.has(s.Id))
    .sort((a, b) => Number(b.AvgRating) - Number(a.AvgRating) || b.ReviewCount - a.ReviewCount)
    .slice(0, 5);

  // Sitedeki sıralama: Bermatik'e katılanlar önce, sonra Pursaklar ve çevresi, sonra ada göre
  const FOCUS = ["pursaklar", "kecioren", "cubuk", "akyurt", "altindag"];
  const rank = (s: ShopCard) => FOCUS.indexOf(s.DistrictSlug) + 1 || 99;
  const ankara = ankaraShops
    .filter((s) => s.ProvinceSlug === "ankara")
    .sort((a, b) => Number(b.IsClaimed) - Number(a.IsClaimed) || rank(a) - rank(b) || a.Name.localeCompare(b.Name, "tr"))
    .slice(0, 10);

  return ok({
    categories: categories.map((c) => ({ id: c.Id, slug: c.Slug, name: c.Name })),
    openShort: openShort.map(shopCard),
    topRated: topRated.map(shopCard),
    ankara: ankara.map(shopCard),
  });
});
