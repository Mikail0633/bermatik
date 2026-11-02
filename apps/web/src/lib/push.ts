import "server-only";
import webpush from "web-push";

// Tarayıcı bildirimi (web push). Anahtarlar .env.local'de (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
export const pushConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

let ready = false;
function setup() {
  if (ready) return;
  // Bildirim servisleri (Google, Mozilla, Apple) sorun olursa bu adresle iletişim kurar
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? process.env.SITE_URL ?? "https://bermatik.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

export type PushTarget = { Endpoint: string; P256dh: string | null; AuthKey: string | null; Platform?: string | null };
export type PushPayload = { title: string; body: string; url?: string | null; tag?: string };

/** Telefon uygulaması (Android/iPhone): Expo'nun bildirim servisi; Endpoint = "ExponentPushToken[...]" */
async function sendExpo(t: PushTarget, p: PushPayload): Promise<"ok" | "gone" | string> {
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: t.Endpoint, title: p.title, body: p.body, data: { url: p.url ?? null }, sound: "default", channelId: "default", priority: "high" }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => null)) as { data?: { status?: string; message?: string; details?: { error?: string } } } | null;
    if (json?.data?.status === "ok") return "ok";
    if (json?.data?.details?.error === "DeviceNotRegistered") return "gone";
    return `${res.status} ${json?.data?.message ?? "Expo bildirimi gönderilemedi"}`.slice(0, 300);
  } catch (e) {
    return (e as Error).message.slice(0, 300);
  }
}

/** "ok" gönderildi, "gone" cihaz aboneliği artık geçersiz (silinmeli), aksi hâlde hata metni. */
export async function sendPush(t: PushTarget, p: PushPayload): Promise<"ok" | "gone" | string> {
  if (t.Platform === "android" || t.Platform === "ios") return sendExpo(t, p);
  setup();
  try {
    await webpush.sendNotification(
      { endpoint: t.Endpoint, keys: { p256dh: t.P256dh ?? "", auth: t.AuthKey ?? "" } },
      JSON.stringify(p),
      { TTL: 60 * 60 * 24, urgency: "normal" },
    );
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    return `${status ?? ""} ${(e as Error).message}`.trim().slice(0, 300);
  }
}
