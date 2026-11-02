import { call } from "@/lib/db";
import { GUID, authed, body, fail, ok, str } from "@/lib/mobile";
import { panelShop } from "@/lib/mobile-panel";

type Row = {
  Id: string; CategoryId: number; CategoryName: string; Name: string; OwnDescription: string | null;
  Price: number; DurationMinutes: number; IsActive: boolean; SortOrder: number;
};

// "Hizmetler ve fiyatlar" (yalnızca sahip / admin): fiyat listesi + kategoriler
export const GET = authed(async (user, _req: Request, { params }: { params: Promise<{ shopId: string }> }) => {
  const { shopId } = await params;
  if (!GUID.test(shopId)) return fail("Dükkân bulunamadı.", 404);
  const { shop, canManage } = await panelShop(user, shopId);
  if (!canManage) return fail("Bu bölüm yalnızca dükkân sahibine açık.", 403);
  const [rows, cats] = await Promise.all([
    call<Row>("api.ShopService_List", { ShopId: shopId, ActorId: user.Id }),
    call<{ Id: number; Name: string; Description: string | null }>("api.ServiceCategory_List", { Segment: shop.Segment }),
  ]);
  return ok({
    services: rows.map((s) => ({
      id: s.Id, categoryId: s.CategoryId, category: s.CategoryName, name: s.Name, description: s.OwnDescription,
      price: Number(s.Price), minutes: s.DurationMinutes, isActive: s.IsActive !== false, sortOrder: s.SortOrder ?? 0,
    })),
    categories: cats.map((c) => ({ id: c.Id, name: c.Name, description: c.Description })),
  });
});

// Hizmet ekle / düzenle: { serviceId?, categoryId, name, description?, price, minutes, isActive }
export const POST = authed(async (user, req: Request, { params }: { params: Promise<{ shopId: string }> }) => {
  const { shopId } = await params;
  if (!GUID.test(shopId)) return fail("Dükkân bulunamadı.", 404);
  const b = await body(req);
  const price = Number(String(b.price ?? "").replace(",", "."));
  const minutes = Number(b.minutes);
  if (!Number.isFinite(price)) return fail("Fiyatı rakamla yazın.");
  if (!Number.isInteger(minutes)) return fail("Süreyi dakika olarak yazın.");
  const serviceId = str(b.serviceId, 36);
  await call("api.ShopService_Save", {
    ActorId: user.Id, ShopId: shopId, ServiceId: GUID.test(serviceId) ? serviceId : null,
    CategoryId: Number(b.categoryId) || null, Name: str(b.name, 80), Description: str(b.description, 1000) || null,
    Price: price, DurationMinutes: minutes, IsActive: b.isActive !== false, SortOrder: Number(b.sortOrder) || 0,
  });
  return ok({ ok: "Hizmet kaydedildi." });
});
