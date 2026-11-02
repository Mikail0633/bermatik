import { call } from "@/lib/db";
import { GUID, authed, body, fail, ok, str } from "@/lib/mobile";
import { DATE, panelShop } from "@/lib/mobile-panel";

type Row = { Id: string; StartDate: Date; EndDate: Date; Reason: string | null };
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

// "Kapalı günler" (yalnızca sahip / admin): bayram, tatil, tadilat
export const GET = authed(async (user, _req: Request, { params }: { params: Promise<{ shopId: string }> }) => {
  const { shopId } = await params;
  if (!GUID.test(shopId)) return fail("Dükkân bulunamadı.", 404);
  const { canManage } = await panelShop(user, shopId);
  if (!canManage) return fail("Bu bölüm yalnızca dükkân sahibine açık.", 403);
  const rows = await call<Row>("api.ShopClosure_List", { ShopId: shopId });
  return ok({ closures: rows.map((r) => ({ id: r.Id, startDate: iso(r.StartDate), endDate: iso(r.EndDate), reason: r.Reason })) });
});

// Kapalı gün ekle: { startDate, endDate?, reason? }
export const POST = authed(async (user, req: Request, { params }: { params: Promise<{ shopId: string }> }) => {
  const { shopId } = await params;
  if (!GUID.test(shopId)) return fail("Dükkân bulunamadı.", 404);
  const b = await body(req);
  const start = str(b.startDate, 10), end = str(b.endDate, 10) || start;
  if (!DATE.test(start) || !DATE.test(end)) return fail("Başlangıç gününü seçin.");
  await call("api.ShopClosure_Add", { ActorId: user.Id, ShopId: shopId, StartDate: start, EndDate: end, Reason: str(b.reason, 100) || null });
  return ok({ ok: "Kapalı gün eklendi." });
});
