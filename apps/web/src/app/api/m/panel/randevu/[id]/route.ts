import { call } from "@/lib/db";
import { GUID, authed, body, fail, ok } from "@/lib/mobile";

const ALLOWED = new Set(["accepted", "rejected", "completed", "no_show", "cancelled"]);
const MSG: Record<string, string> = {
  accepted: "Randevu onaylandı.", rejected: "Randevu reddedildi.", completed: "Randevu tamamlandı.",
  no_show: "Gelmedi olarak işaretlendi.", cancelled: "Randevu iptal edildi; müşteriye bildirim gitti.",
};

// Randevu durumu: { status } — kimin neyi yapabileceği veritabanında denetlenir (sahip / ilgili personel / admin)
export const POST = authed(async (user, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!GUID.test(id)) return fail("Randevu bulunamadı.", 404);
  const status = String((await body(req)).status ?? "");
  if (!ALLOWED.has(status)) return fail("Geçersiz işlem.");
  await call("api.Appointment_SetStatus", { ActorId: user.Id, AppointmentId: id, Status: status });
  return ok({ ok: MSG[status] });
});
