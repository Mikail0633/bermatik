import { call, callOne } from "@/lib/db";
import { GUID, authed, body, fail, ok, str } from "@/lib/mobile";
import { DATE, TIME } from "@/lib/mobile-panel";

/**
 * Bir personel için işlemler (yetki veritabanında: sahip / admin; mola için personelin kendisi de):
 *   { islem: "davet" }                                   → davet kodu oluştur → { code }
 *   { islem: "mola", start: "13:00", end: "14:00" }       → günlük mola (ikisi boşsa mola kaldırılır)
 *   { islem: "izin", weekday: 1-7 } ya da { islem: "izin", startDate, endDate, note? } → izin ekle
 */
export const POST = authed(async (user, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!GUID.test(id)) return fail("Personel bulunamadı.", 404);
  const b = await body(req);
  switch (b.islem) {
    case "davet": {
      const r = await callOne<{ InviteCode: string }>("api.Staff_CreateInvite", { ActorId: user.Id, StaffId: id });
      return ok({ ok: "Davet kodu oluşturuldu.", code: r?.InviteCode ?? null });
    }
    case "mola": {
      const start = str(b.start, 5), end = str(b.end, 5);
      if ((start || end) && (!TIME.test(start) || !TIME.test(end))) return fail("Mola başlangıç ve bitiş saatini seçin.");
      const json = start && end ? JSON.stringify([{ weekday: null, start, end }]) : "[]";
      await call("api.Staff_SetBreaks", { ActorId: user.Id, StaffId: id, BreaksJson: json });
      return ok({ ok: start ? "Mola kaydedildi." : "Mola kaldırıldı." });
    }
    case "izin": {
      const wd = Number(b.weekday);
      const weekly = Number.isInteger(wd) && wd >= 1 && wd <= 7;
      const startDate = str(b.startDate, 10), endDate = str(b.endDate, 10) || startDate;
      if (!weekly && (!DATE.test(startDate) || !DATE.test(endDate))) return fail("İzin gününü ya da tarih aralığını seçin.");
      await call("api.Staff_AddDayOff", {
        ActorId: user.Id, StaffId: id, Weekday: weekly ? wd : null,
        StartDate: weekly ? null : startDate, EndDate: weekly ? null : endDate, Note: str(b.note, 100) || null,
      });
      return ok({ ok: "İzin eklendi." });
    }
    default:
      return fail("Geçersiz işlem.");
  }
});
