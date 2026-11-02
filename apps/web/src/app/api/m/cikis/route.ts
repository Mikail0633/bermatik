import { call } from "@/lib/db";
import { body, endMobileSession, handler, ok, str } from "@/lib/mobile";

// Çıkış: oturum anahtarı silinir; uygulama bildirim anahtarını da gönderirse bu telefona bildirim gitmez
export const POST = handler(async (req: Request) => {
  const b = await body(req);
  const pushToken = str(b.pushToken, 1000);
  if (pushToken) await call("api.Push_Unsubscribe", { Endpoint: pushToken }).catch(() => {});
  await endMobileSession();
  return ok({ ok: true });
});
