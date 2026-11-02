import { call } from "@/lib/db";
import { GUID, authed, fail, ok } from "@/lib/mobile";

// Kapalı günü kaldır (yetki veritabanında)
export const DELETE = authed(async (user, _req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!GUID.test(id)) return fail("Kayıt bulunamadı.", 404);
  await call("api.ShopClosure_Remove", { ActorId: user.Id, ClosureId: id });
  return ok({ ok: "Kapalı gün kaldırıldı." });
});
