import { call, callOne } from "@/lib/db";
import { GUID, authed, body, fail, ok, str } from "@/lib/mobile";
import { localIso } from "@/lib/mobile-map";
import type { Segment } from "@/lib/types";

type Row = {
  Id: string; Status: string; StartsAtLocal: Date; EndsAtLocal: Date; TotalPrice: number; Note: string | null;
  ShopId: string; ShopName: string; ShopPhone: string | null; StaffName: string; StaffId: string; Services: string; CanReview: boolean;
  Segment: Segment;
};
type Req = {
  Id: string; Kind: string; Status: string; PreferredAtLocal: Date; ConfirmedAtLocal: Date | null; Note: string | null; AdminNote: string | null;
  CategoryName: string | null; ShopId?: string; ShopName: string; ShopPhone: string | null; Segment: Segment; District: string;
};

// Randevularım: randevular + Bermatik'e katılmamış dükkânlar için bırakılan talepler
export const GET = authed(async (user) => {
  const [rows, reqs] = await Promise.all([
    call<Row>("api.Appointment_ListMine", { ActorId: user.Id }),
    call<Req>("api.Request_ListMine", { ActorId: user.Id }),
  ]);
  return ok({
    appointments: rows.map((r) => ({
      id: r.Id, status: r.Status, start: localIso(r.StartsAtLocal), end: localIso(r.EndsAtLocal), price: Number(r.TotalPrice), note: r.Note,
      shopId: r.ShopId, shopName: r.ShopName, shopPhone: r.ShopPhone, staffId: r.StaffId, staffName: r.StaffName,
      services: r.Services, canReview: Boolean(r.CanReview), segment: r.Segment,
    })),
    requests: reqs.map((q) => ({
      id: q.Id, kind: q.Kind, status: q.Status, preferred: localIso(q.PreferredAtLocal), confirmed: q.ConfirmedAtLocal ? localIso(q.ConfirmedAtLocal) : null,
      note: q.Note, adminNote: q.AdminNote, category: q.CategoryName, shopId: q.ShopId ?? null, shopName: q.ShopName, shopPhone: q.ShopPhone,
      segment: q.Segment, district: q.District,
    })),
  });
});

// Randevu al: { shopId, staffId, serviceIds: [...], start: "2026-11-02T10:30", note }
export const POST = authed(async (user, req: Request) => {
  const b = await body(req);
  const shopId = str(b.shopId, 36), staffId = str(b.staffId, 36), start = str(b.start, 16);
  const services = Array.isArray(b.serviceIds) ? b.serviceIds.filter((x): x is string => typeof x === "string" && GUID.test(x)).slice(0, 10) : [];
  if (!GUID.test(shopId) || !GUID.test(staffId)) return fail("Dükkân ve personel seçin.");
  if (!services.length || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) return fail("Hizmet ve saat seçin.");
  const row = await callOne<{ Id?: string; AppointmentId?: string }>("api.Appointment_Book", {
    ActorId: user.Id, ShopId: shopId, StaffId: staffId, ServiceIdsJson: JSON.stringify(services),
    StartsAtLocal: `${start}:00`, Note: str(b.note, 500) || null,
  });
  return ok({ id: row?.Id ?? row?.AppointmentId ?? null }, 201);
});
