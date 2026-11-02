import { call } from "@/lib/db";
import { GUID, authed, fail, ok } from "@/lib/mobile";

// Müşteri kendi randevusunu iptal eder (kurallar veritabanında: geçmiş/tamamlanmış randevu iptal edilemez)
export const POST = authed(async (user, _req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!GUID.test(id)) return fail("Randevu bulunamadı.", 404);
  await call("api.Appointment_SetStatus", { ActorId: user.Id, AppointmentId: id, Status: "cancelled" });
  return ok({ ok: "Randevu iptal edildi." });
});
