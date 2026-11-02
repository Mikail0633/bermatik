import { call } from "@/lib/db";
import { GUID, authed, body, fail, ok, str } from "@/lib/mobile";
import { panelShop } from "@/lib/mobile-panel";

type Row = {
  Id: string; DisplayName: string; Title: string | null; PhotoPath: string | null; Phone: string | null; ShowPhone: boolean; IsActive: boolean;
  HasAccount: boolean; BreaksJson: string | null; DaysOffJson: string | null;
};
type Break = { start: string; end: string; weekday: number | null };
type DayOff = { id: string; weekday: number | null; startDate: string | null; endDate: string | null; note: string | null };

const parse = <T,>(s: string | null): T[] => { try { return s ? (JSON.parse(s) as T[]) : []; } catch { return []; } };

// "Personel" sekmesi (yalnızca sahip / admin): personel, molası ve izinleri
export const GET = authed(async (user, _req: Request, { params }: { params: Promise<{ shopId: string }> }) => {
  const { shopId } = await params;
  if (!GUID.test(shopId)) return fail("Dükkân bulunamadı.", 404);
  const { canManage } = await panelShop(user, shopId);
  if (!canManage) return fail("Bu bölüm yalnızca dükkân sahibine açık.", 403);
  const rows = await call<Row>("api.Staff_ListForPanel", { ActorId: user.Id, ShopId: shopId });
  return ok({
    staff: rows.map((s) => {
      const brk = parse<Break>(s.BreaksJson)[0];
      return {
        id: s.Id, name: s.DisplayName, title: s.Title, photo: s.PhotoPath, phone: s.Phone, showPhone: Boolean(s.ShowPhone),
        isActive: s.IsActive !== false, hasAccount: Boolean(s.HasAccount),
        breakStart: brk?.start?.slice(0, 5) ?? null, breakEnd: brk?.end?.slice(0, 5) ?? null,
        daysOff: parse<DayOff>(s.DaysOffJson),
      };
    }),
  });
});

// Personel ekle / düzenle: { staffId?, name, title?, phone?, showPhone, isActive }
export const POST = authed(async (user, req: Request, { params }: { params: Promise<{ shopId: string }> }) => {
  const { shopId } = await params;
  if (!GUID.test(shopId)) return fail("Dükkân bulunamadı.", 404);
  const b = await body(req);
  const staffId = str(b.staffId, 36);
  await call("api.Staff_Save", {
    ActorId: user.Id, ShopId: shopId, StaffId: GUID.test(staffId) ? staffId : null,
    DisplayName: str(b.name, 60), Title: str(b.title, 60) || null, PhotoPath: null,
    IsActive: b.isActive !== false, Phone: str(b.phone, 40) || null, ShowPhone: b.showPhone === true,
  });
  return ok({ ok: "Personel kaydedildi." });
});
