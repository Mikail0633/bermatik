import { call } from "@/lib/db";
import { GUID, authed, fail, ok } from "@/lib/mobile";

export const POST = authed(async (user, _req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!GUID.test(id)) return fail("Talep bulunamadı.", 404);
  await call("api.Request_Cancel", { ActorId: user.Id, RequestId: id });
  return ok({ ok: "Talebiniz iptal edildi." });
});
