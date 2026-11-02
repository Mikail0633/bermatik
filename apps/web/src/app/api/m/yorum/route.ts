import { call } from "@/lib/db";
import { GUID, authed, body, fail, ok, str } from "@/lib/mobile";

// Tamamlanan randevuya yorum: { appointmentId, rating: 1-5, comment? }
export const POST = authed(async (user, req: Request) => {
  const b = await body(req);
  const id = str(b.appointmentId, 36), rating = Number(b.rating);
  if (!GUID.test(id)) return fail("Randevu bulunamadı.", 404);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail("1 ile 5 arasında puan verin.");
  await call("api.Review_Add", { ActorId: user.Id, AppointmentId: id, Rating: rating, Comment: str(b.comment, 1000) || null });
  return ok({ ok: "Yorumunuz için teşekkürler!" }, 201);
});
