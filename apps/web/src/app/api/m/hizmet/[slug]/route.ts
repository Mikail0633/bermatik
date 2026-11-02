import { call } from "@/lib/db";
import { fail, handler, ok } from "@/lib/mobile";
import { shopCard } from "@/lib/mobile-map";
import { isSegment, type ShopCard } from "@/lib/types";

type Category = { Slug: string; Name: string; Description: string | null };

/**
 * Hizmet ekranı (sitedeki /[bölüm]/hizmet/[slug] sayfasının aynısı):
 *   - hizmetin adı ve açıklaması + diğer hizmetler
 *   - "Bermatik'te bu hizmeti yapan" dükkânlar (Bermatik'e katılmış, hizmeti listesinde olanlar)
 *   - "Bölgedeki diğer" dükkânlar (henüz katılmamış; aranıp sorulabilir)
 * Bölge: telefon konum verdiyse (?lat&lng) 25 km çevresi, vermediyse sitedeki gibi Ankara.
 */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const sp = new URL(req.url).searchParams;
  const seg = sp.get("bolum") ?? "";
  if (!isSegment(seg)) return fail("Bölüm geçersiz.");
  const cats = await call<Category>("api.ServiceCategory_List", { Segment: seg });
  const cat = cats.find((c) => c.Slug === slug);
  if (!cat) return fail("Hizmet bulunamadı.", 404);

  const lat = Number(sp.get("lat")), lng = Number(sp.get("lng"));
  const near = sp.get("lat") && sp.get("lng") && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const [providers, others] = await Promise.all([
    call<ShopCard>("api.Shop_Search", near
      ? { Segment: seg, CategorySlug: slug, Latitude: lat, Longitude: lng, RadiusKm: 50, Limit: 100 }
      : { Segment: seg, CategorySlug: slug, Limit: 100 }),
    call<ShopCard>("api.Shop_Search", near
      ? { Segment: seg, Latitude: lat, Longitude: lng, RadiusKm: 25, Limit: 60 }
      : { Segment: seg, ProvinceId: 6, Limit: 30 }),
  ]);

  return ok({
    category: { slug: cat.Slug, name: cat.Name, description: cat.Description },
    categories: cats.filter((c) => c.Slug !== slug).map((c) => ({ slug: c.Slug, name: c.Name })),
    providers: providers.map(shopCard),
    others: others.filter((x) => !x.IsClaimed).slice(0, 15).map(shopCard),
  });
});
