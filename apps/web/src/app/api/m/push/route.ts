import { call } from "@/lib/db";
import { authed, body, fail, ok, str } from "@/lib/mobile";

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/;

// Telefonu bildirimlere kaydet: { token: "ExponentPushToken[...]", platform: "android" | "ios" }
export const POST = authed(async (user, req: Request) => {
  const b = await body(req);
  const token = str(b.token, 300), platform = str(b.platform, 10);
  if (!EXPO_TOKEN.test(token)) return fail("Bildirim anahtarı geçersiz.");
  if (platform !== "android" && platform !== "ios") return fail("Telefon türü geçersiz.");
  await call("api.Push_Subscribe", { ActorId: user.Id, Platform: platform, Endpoint: token, P256dh: null, AuthKey: null });
  return ok({ ok: true });
});

// Bu telefona bildirim gönderme
export const DELETE = authed(async (_user, req: Request) => {
  const token = str((await body(req)).token, 300);
  if (EXPO_TOKEN.test(token)) await call("api.Push_Unsubscribe", { Endpoint: token });
  return ok({ ok: true });
});
