import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Ticari e-posta / SMS'lerdeki "İletiden çık" bağlantısı.
// Bağlantı kullanıcı kimliği + kanal + imzadan oluşur; giriş gerektirmez ama imzasız bağlantı kabul edilmez.
export type IletiChannel = "EPOSTA" | "MESAJ";

function secret() {
  const s = process.env.ILETI_SECRET;
  if (!s || s.length < 32) throw new Error("ILETI_SECRET ayarlı değil (.env.local)");
  return s;
}

const sign = (userId: string, channel: IletiChannel) =>
  createHmac("sha256", secret()).update(`${userId.toLowerCase()}:${channel}`).digest("base64url");

/** Kampanya iletisinin altına eklenecek ret bağlantısı */
export function unsubscribeUrl(userId: string, channel: IletiChannel) {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  return `${site}/ileti-ret?u=${encodeURIComponent(userId)}&k=${channel}&i=${sign(userId, channel)}`;
}

/** Bağlantıdaki imza doğruysa kullanıcı ve kanalı döner */
export function verifyUnsubscribe(u: string, k: string, i: string): { userId: string; channel: IletiChannel } | null {
  if (!/^[0-9a-f-]{36}$/i.test(u) || (k !== "EPOSTA" && k !== "MESAJ")) return null;
  const want = Buffer.from(sign(u, k));
  const got = Buffer.from(i);
  return want.length === got.length && timingSafeEqual(want, got) ? { userId: u, channel: k } : null;
}
