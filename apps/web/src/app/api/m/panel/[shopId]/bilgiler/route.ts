import { call } from "@/lib/db";
import { GUID, authed, body, fail, ok, str } from "@/lib/mobile";
import { TIME, panelShop } from "@/lib/mobile-panel";
import { hhmm, type Hours } from "@/lib/types";

// "Bilgiler ve saatler" (yalnızca sahip / admin)
export const GET = authed(async (user, _req: Request, { params }: { params: Promise<{ shopId: string }> }) => {
  const { shopId } = await params;
  if (!GUID.test(shopId)) return fail("Dükkân bulunamadı.", 404);
  const { shop, canManage } = await panelShop(user, shopId);
  if (!canManage) return fail("Bu bölüm yalnızca dükkân sahibine açık.", 403);
  const hours = await call<Hours>("api.ShopHours_Get", { ShopId: shopId });
  return ok({
    info: {
      name: shop.Name, description: shop.Description, phone: shop.Phone, street: shop.Street, buildingNo: shop.BuildingNo,
      addressDetail: shop.AddressDetail, province: shop.Province, district: shop.District, neighborhood: shop.Neighborhood,
      isTemporarilyClosed: Boolean(shop.IsTemporarilyClosed), showServiceDescriptions: Boolean(shop.ShopShowServiceDescriptions),
      cover: shop.CoverImagePath,
    },
    hours: [1, 2, 3, 4, 5, 6, 7].map((d) => {
      const h = hours.find((x) => x.Weekday === d);
      const close = hhmm(h?.ClosesAt);
      return { weekday: d, isClosed: h ? Boolean(h.IsClosed) : true, opensAt: hhmm(h?.OpensAt) || null, closesAt: close === "23:59" ? "24:00" : close || null };
    }),
    hasHours: hours.length > 0,
  });
});

/**
 * Kaydet. İki tür:
 *   { tur: "bilgi", name, description?, phone, street, buildingNo?, addressDetail?, isTemporarilyClosed, showServiceDescriptions }
 *     — konum (il/ilçe/mahalle/harita), mağaza ayarı ve kapak fotoğrafı değişmeden kalır
 *   { tur: "saatler", hours: [{ weekday, isClosed, opensAt: "09:00", closesAt: "20:00" | "24:00" }] }
 */
export const POST = authed(async (user, req: Request, { params }: { params: Promise<{ shopId: string }> }) => {
  const { shopId } = await params;
  if (!GUID.test(shopId)) return fail("Dükkân bulunamadı.", 404);
  const b = await body(req);
  if (b.tur === "saatler") {
    if (!Array.isArray(b.hours)) return fail("Saatler eksik.");
    const hours = [1, 2, 3, 4, 5, 6, 7].map((d) => {
      const h = (b.hours as unknown[]).find((x) => (x as { weekday?: number })?.weekday === d) as { isClosed?: boolean; opensAt?: string; closesAt?: string } | undefined;
      const closed = !h || h.isClosed === true;
      const open = str(h?.opensAt, 5), close = str(h?.closesAt, 5);
      return { weekday: d, isClosed: closed, opensAt: closed ? null : open || null, closesAt: closed ? null : close === "24:00" ? "23:59:59" : close || null };
    });
    for (const h of hours) {
      if (!h.isClosed && (!h.opensAt || !TIME.test(h.opensAt) || !h.closesAt || !(h.closesAt === "23:59:59" || TIME.test(h.closesAt))))
        return fail("Açık günler için açılış ve kapanış saatini seçin.");
    }
    await call("api.ShopHours_Set", { ActorId: user.Id, ShopId: shopId, HoursJson: JSON.stringify(hours) });
    return ok({ ok: "Çalışma saatleri kaydedildi." });
  }
  if (b.tur === "bilgi") {
    const { shop } = await panelShop(user, shopId);
    await call("api.Shop_Update", {
      ActorId: user.Id, ShopId: shopId, Name: str(b.name, 100), Description: str(b.description, 2000) || null, Phone: str(b.phone, 40),
      ProvinceId: shop.ProvinceId, DistrictId: shop.DistrictId, NeighborhoodId: shop.NeighborhoodId,
      Street: str(b.street, 120), BuildingNo: str(b.buildingNo, 20) || "-", AddressDetail: str(b.addressDetail, 200) || null,
      Latitude: Number(shop.Latitude), Longitude: Number(shop.Longitude),
      IsTemporarilyClosed: b.isTemporarilyClosed === true, ShowServiceDescriptions: b.showServiceDescriptions === true,
      StoreEnabled: Boolean(shop.ShopStoreEnabled), QueueAvgMinutes: shop.QueueAvgMinutes ?? 20, CoverImagePath: null,
    });
    return ok({ ok: "Bilgiler kaydedildi." });
  }
  return fail("Geçersiz işlem.");
});
