import { call } from "@/lib/db";
import { GUID, authed, body, fail, ok, str } from "@/lib/mobile";
import { DATE, TIME, panelAppt, panelShop, todayTR, type PanelAppt } from "@/lib/mobile-panel";
import type { Service, Staff } from "@/lib/types";

// "Randevular" sekmesi: seçilen günün tüm randevuları (?gun=2026-11-02) + telefon randevusu formu için hizmet ve personel
export const GET = authed(async (user, req: Request, { params }: { params: Promise<{ shopId: string }> }) => {
  const { shopId } = await params;
  if (!GUID.test(shopId)) return fail("Dükkân bulunamadı.", 404);
  await panelShop(user, shopId);
  const gun = new URL(req.url).searchParams.get("gun") ?? "";
  const day = DATE.test(gun) ? gun : todayTR();
  const [rows, services, staff] = await Promise.all([
    call<PanelAppt>("api.Appointment_ListForShop", { ActorId: user.Id, ShopId: shopId, Date: day }),
    call<Service & { IsActive: boolean }>("api.ShopService_List", { ShopId: shopId, ActorId: user.Id }),
    call<Staff & { IsActive?: boolean }>("api.Staff_List", { ShopId: shopId, ActorId: user.Id }),
  ]);
  return ok({
    day,
    appointments: rows.map(panelAppt),
    services: services.filter((s) => s.IsActive !== false).map((s) => ({ id: s.Id, name: s.Name })),
    staff: staff.filter((s) => s.IsActive !== false).map((s) => ({ id: s.Id, name: s.DisplayName })),
  });
});

// Telefonla gelen randevu: { customerName, customerPhone, serviceIds, staffId, date, time, note } — doğrudan onaylı kaydedilir
export const POST = authed(async (user, req: Request, { params }: { params: Promise<{ shopId: string }> }) => {
  const { shopId } = await params;
  if (!GUID.test(shopId)) return fail("Dükkân bulunamadı.", 404);
  const b = await body(req);
  const services = Array.isArray(b.serviceIds) ? b.serviceIds.filter((x): x is string => typeof x === "string" && GUID.test(x)).slice(0, 10) : [];
  const date = str(b.date, 10), time = str(b.time, 5), staffId = str(b.staffId, 36);
  if (!services.length || !DATE.test(date) || !TIME.test(time)) return fail("Hizmet, gün ve saat seçin.");
  if (!GUID.test(staffId)) return fail("Personel seçin.");
  await call("api.Appointment_Book", {
    ActorId: user.Id, ShopId: shopId, StaffId: staffId, ServiceIdsJson: JSON.stringify(services),
    StartsAtLocal: `${date}T${time}:00`, Note: str(b.note, 500) || null,
    CustomerName: str(b.customerName, 100), CustomerPhone: str(b.customerPhone, 40),
  });
  return ok({ ok: "Telefonla gelen randevu eklendi." }, 201);
});
