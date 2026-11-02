import { call, callOne } from "@/lib/db";
import { fail, handler, ok } from "@/lib/mobile";
import { shopCard } from "@/lib/mobile-map";
import { isSegment, type ShopCard } from "@/lib/types";

const num = (v: string | null) => (v == null || v === "" ? null : Number(v));

/**
 * Dükkân listesi. Tek uç nokta, dört kullanım:
 *   ?bolum=erkek&lat=..&lng=..&km=10   → yakınımdakiler (mesafeye göre)
 *   ?bolum=erkek&il=ankara&ilce=pursaklar&mahalle=123 → bölgedekiler
 *   ?bolum=erkek&q=kadıköy             → ada / ilçe / il adına göre arama
 *   &hizmet=damat-trasi                 → yalnızca bu hizmeti verenler (diğerleriyle birlikte)
 * &adet= en fazla kaç dükkân (varsayılan 50, en çok 500); yanıtta "more" daha fazlası var mı
 */
export const GET = handler(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const seg = sp.get("bolum") ?? "";
  if (!isSegment(seg)) return fail("Bölüm geçersiz.");
  const limit = Math.min(Math.max(Number(sp.get("adet")) || 50, 1), 500);
  const lat = num(sp.get("lat")), lng = num(sp.get("lng"));
  const km = Math.min(Math.max(num(sp.get("km")) ?? 10, 1), 50);
  const q = (sp.get("q") ?? "").replace(/[%_[\]]/g, " ").trim().slice(0, 60);
  const cat = (sp.get("hizmet") ?? "").replace(/[^a-z0-9-]/g, "").slice(0, 40) || null;

  const params: Record<string, string | number | null> = { Segment: seg, Limit: limit + 1, CategorySlug: cat, Query: q || null };
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail("Konum geçersiz.");
    Object.assign(params, { Latitude: lat, Longitude: lng, RadiusKm: km });
  } else if (sp.get("il")) {
    const area = await callOne<{ ProvinceId: number; DistrictId: number | null }>("api.Area_Resolve", {
      ProvinceSlug: sp.get("il"), DistrictSlug: sp.get("ilce") || null,
    });
    if (!area) return fail("Bölge bulunamadı.", 404);
    Object.assign(params, { ProvinceId: area.ProvinceId, DistrictId: area.DistrictId ?? null, NeighborhoodId: num(sp.get("mahalle")) });
  } else if (!q) {
    return fail("Konum, bölge ya da arama yazısı gerekli.");
  }

  const rows = await call<ShopCard>("api.Shop_Search", params);
  return ok({ more: rows.length > limit, shops: rows.slice(0, limit).map(shopCard) });
});
