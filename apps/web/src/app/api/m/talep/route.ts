import { call } from "@/lib/db";
import { rateLimit } from "@/lib/auth";
import { GUID, authed, body, fail, ok, str } from "@/lib/mobile";

// Bermatik'e katılmamış dükkân için randevu TALEBİ: { shopId, day: "2026-11-02", time: "14:00", categoryId?, note? }
// Bermatik ekibi dükkânı arayıp ayarlar; onaylanınca bildirim gider.
export const POST = authed(async (user, req: Request) => {
  const b = await body(req);
  if (!(await rateLimit("m-talep", 10, 3_600_000))) return fail("Çok fazla talep bıraktınız. Biraz sonra tekrar deneyin.", 429);
  const shopId = str(b.shopId, 36), day = str(b.day, 10), time = str(b.time, 5);
  if (!GUID.test(shopId)) return fail("Dükkân bulunamadı.", 404);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return fail("Gün ve saat seçin.");
  await call("api.Request_Create", {
    ActorId: user.Id, ShopId: shopId, Kind: "randevu", CategoryId: Number(b.categoryId) || null,
    PreferredAtLocal: `${day}T${time}:00`, Note: str(b.note, 300) || null,
  });
  return ok({ ok: "Talebiniz alındı! Dükkânı arayıp sizin için ayarlayacağız; onaylanınca bildirim gelecek." }, 201);
});
