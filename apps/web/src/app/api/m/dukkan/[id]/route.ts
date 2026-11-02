import { call, callOne } from "@/lib/db";
import { GUID, fail, handler, mobileUser, ok } from "@/lib/mobile";
import { hours, localIso, review, service, shopDetail, staff } from "@/lib/mobile-map";
import type { Hours, Review, Service, ShopDetail, Staff } from "@/lib/types";

type Day = { StartsAtLocal: Date; EndsAtLocal: Date; StaffName: string; IsPast: boolean };
type Photo = { Id: string; Path: string; Caption: string | null; StaffName: string | null };

// Dükkân ekranı: bilgiler, hizmetler, ekip, çalışma saatleri, yorumlar, çalışmalar, bugünkü sıra
export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!GUID.test(id)) return fail("Dükkân bulunamadı.", 404);
  const user = await mobileUser();
  const shop = await callOne<ShopDetail>("api.Shop_Get", { ShopId: id, ActorId: user?.Id ?? null });
  if (!shop) return fail("Dükkân bulunamadı.", 404);

  const favs = user ? await call<{ Id: string }>("api.Favorite_ListMine", { ActorId: user.Id }) : [];
  const isFavorite = favs.some((f) => f.Id.toLowerCase() === shop.Id.toLowerCase());
  const withDesc = Boolean(shop.ShowServiceDescriptions);

  // Bermatik'e katılmamış dükkân: yalnızca bilgi + (girildiyse) fiyat ve saatler; randevu yerine "randevu talebi"
  if (!shop.IsClaimed) {
    const [svc, hrs, cats] = await Promise.all([
      call<Service>("api.ShopService_List", { ShopId: shop.Id }),
      call<Hours>("api.ShopHours_Get", { ShopId: shop.Id }),
      call<{ Id: number; Name: string }>("api.ServiceCategory_List", { Segment: shop.Segment }),
    ]);
    return ok({
      shop: shopDetail(shop), isFavorite, services: svc.map((x) => service(x, withDesc)), hours: hrs.map(hours),
      staff: [], reviews: [], gallery: [], today: [],
      // Randevu talebi formundaki "Hizmet" seçimi için
      categories: cats.map((c) => ({ id: c.Id, name: c.Name })),
    });
  }

  const [svc, team, revs, hrs, day, gallery] = await Promise.all([
    call<Service>("api.ShopService_List", { ShopId: shop.Id }),
    call<Staff>("api.Staff_List", { ShopId: shop.Id }),
    shop.ReviewsEnabled ? call<Review>("api.Review_List", { ShopId: shop.Id, Top: 20 }) : Promise.resolve([] as Review[]),
    call<Hours>("api.ShopHours_Get", { ShopId: shop.Id }),
    call<Day>("api.Shop_DaySchedule", { ShopId: shop.Id }),
    call<Photo>("api.Gallery_List", { ShopId: shop.Id }),
  ]);
  return ok({
    shop: shopDetail(shop), isFavorite,
    services: svc.map((x) => service(x, withDesc)),
    staff: team.map(staff),
    reviews: revs.map(review),
    hours: hrs.map(hours),
    gallery: gallery.map((g) => ({ id: g.Id, path: g.Path, caption: g.Caption, staff: g.StaffName })),
    // Bugünkü randevular ("Sırayı gör"): yalnızca saat ve personel, müşteri adı yok
    today: day.map((d) => ({ start: localIso(d.StartsAtLocal), end: localIso(d.EndsAtLocal), staff: d.StaffName, isPast: Boolean(d.IsPast) })),
  });
});
