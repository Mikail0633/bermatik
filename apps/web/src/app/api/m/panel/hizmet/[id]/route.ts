import { call } from "@/lib/db";
import { GUID, businessAuthed, fail, ok } from "@/lib/mobile";

// Hizmeti kaldır (yetki veritabanında: yalnızca dükkân sahibi / admin)
export const DELETE = businessAuthed(async (user, _req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!GUID.test(id)) return fail("Hizmet bulunamadı.", 404);
  await call("api.ShopService_Delete", { ActorId: user.Id, ServiceId: id });
  return ok({ ok: "Hizmet kaldırıldı." });
});
