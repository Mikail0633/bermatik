import { call, callOne } from "@/lib/db";
import { GUID, authed, fail, ok } from "@/lib/mobile";
import { panelAppt, panelShop, todayTR, type PanelAppt } from "@/lib/mobile-panel";

type Stats = { CompletedAppointments: number; AppointmentRevenue: number; NoShows: number; UniqueCustomers: number };

// "Bugün" sekmesi: dükkân özeti + son 7 gün (yalnızca sahip/admin) + onay bekleyenler + bugünün onaylı randevuları
export const GET = authed(async (user, _req: Request, { params }: { params: Promise<{ shopId: string }> }) => {
  const { shopId } = await params;
  if (!GUID.test(shopId)) return fail("Dükkân bulunamadı.", 404);
  const { shop, canManage } = await panelShop(user, shopId);
  const [pending, today, stats] = await Promise.all([
    call<PanelAppt>("api.Appointment_ListForShop", { ActorId: user.Id, ShopId: shopId, Status: "pending" }),
    call<PanelAppt>("api.Appointment_ListForShop", { ActorId: user.Id, ShopId: shopId, Date: todayTR() }),
    canManage ? callOne<Stats>("api.Shop_Stats", { ActorId: user.Id, ShopId: shopId, Days: 7 }) : Promise.resolve(undefined),
  ]);
  return ok({
    shop: {
      id: shop.Id, code: shop.Code, name: shop.Name, segment: shop.Segment, status: shop.Status, statusReason: shop.StatusReason,
      isOwner: Boolean(shop.IsOwner), canManage, isAdmin: user.Role === "admin",
    },
    stats: stats ? {
      completed: stats.CompletedAppointments, revenue: Number(stats.AppointmentRevenue), uniqueCustomers: stats.UniqueCustomers, noShows: stats.NoShows,
    } : null,
    pending: pending.map(panelAppt),
    today: today.filter((a) => a.Status === "accepted").map(panelAppt),
  });
});
