import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import { call, callOne } from "./db";

// =====================================================================
// Oturum: tarayıcıda rastgele bir anahtar (çerez), veritabanında yalnızca
// anahtarın SHA-256 özeti saklanır. Şifreler argon2id ile özetlenir.
// =====================================================================

const COOKIE = "bm_oturum";
const SESSION_DAYS = 30;

export type Role = "customer" | "shop_owner" | "staff" | "admin";
export type SessionUser = {
  Id: string;
  Email: string;
  Role: Role;
  FirstName: string;
  LastName: string;
  BirthYear: number | null;
  Phone: string | null;
  TotpEnabled: boolean;
  EmailVerified: boolean;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest();

export const hashPassword = (pw: string) => hash(pw);
export async function verifyPassword(stored: string, pw: string) {
  if (!stored || stored === "!") return false; // şifresiz hesap (sistem hesabı, silinmiş hesap)
  try {
    return await verify(stored, pw);
  } catch {
    return false;
  }
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const h = await headers();
  await call("api.Auth_CreateSession", {
    UserId: userId,
    TokenHash: sha256(token),
    ExpiresAt: expires,
    IpAddress: (h.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 45) || null,
    UserAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** Giriş yapmış kullanıcı (yoksa null). Aynı istekte bir kez sorgulanır. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return (await callOne<SessionUser>("api.Auth_GetSession", { TokenHash: sha256(token) })) ?? null;
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await call("api.Auth_DeleteSession", { TokenHash: sha256(token) });
  jar.delete(COOKIE);
}

/** Tarayıcıda oturum çerezi var ama oturum kapanmış (ör. aynı hesapla başka cihazdan girildi) */
export async function sessionEnded() {
  return Boolean((await cookies()).get(COOKIE)?.value) && !(await getUser());
}

/** Giriş zorunlu sayfalar için: giriş yoksa giriş sayfasına yollar. */
export async function requireUser(next: string) {
  const user = await getUser();
  if (!user) redirect(`/giris?sonra=${encodeURIComponent(next)}${(await sessionEnded()) ? "&neden=oturum" : ""}`);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.Role !== "admin") redirect("/");
  return user;
}

/** Güvenli yönlendirme: yalnızca site içi adresler ("//site.com" ve "/\site.com" gibi dışarı kaçışlar engellenir) */
export const safeNext = (v: unknown) =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") && !/[\x00-\x1f]/.test(v) ? v : "/";

/**
 * Ziyaretçinin IP adresi. X-Forwarded-For başlığını ziyaretçi kendisi uydurabilir; bu yüzden ona yalnızca
 * site önünde güvenilir bir sunucu varken (TRUST_PROXY=1, yayında) güvenilir ve o sunucunun eklediği son adres alınır.
 */
export async function clientIp() {
  if (process.env.TRUST_PROXY !== "1") return "yerel";
  const xff = (await headers()).get("x-forwarded-for");
  return xff?.split(",").pop()?.trim().slice(0, 45) || "bilinmiyor";
}

// ---------------------------------------------------------------------
// Hız sınırı (aynı adresten çok fazla deneme): sayaç veritabanında tutulur,
// site yeniden başlasa da sıfırlanmaz. Veritabanına ulaşılamazsa engellemez.
// ---------------------------------------------------------------------
export async function rateLimit(key: string, max: number, windowMs: number) {
  try {
    const r = await callOne<{ Allowed: boolean }>("api.RateLimit_Hit", {
      Key: `${key}:${await clientIp()}`.slice(0, 200), Max: max, WindowSeconds: Math.ceil(windowMs / 1000),
    });
    return r?.Allowed !== false;
  } catch (e) {
    console.error("[hız sınırı]", e);
    return true;
  }
}

// ---------------------------------------------------------------------
// Yeni cihaz uyarısı: her tarayıcıya rastgele bir cihaz kimliği (çerez, 2 yıl) verilir;
// veritabanında yalnızca özeti tutulur. Hesaba tanımadığımız bir cihazdan girilince
// kişiye bildirim (ve e-posta servisi bağlıysa e-posta) gider.
// ---------------------------------------------------------------------
const DEVICE_COOKIE = "bm_cihaz";

/** "Chrome, Windows" gibi okunur cihaz adı */
export function deviceLabel(ua: string) {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung İnternet"
    : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Tarayıcı";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "bilinmeyen sistem";
  return `${browser}, ${os}`;
}

/** Girişten/kayıttan sonra çağrılır; yeni cihazsa { alerted, email, firstName, label } döner */
export async function rememberDevice(userId: string) {
  const jar = await cookies();
  let id = jar.get(DEVICE_COOKIE)?.value;
  if (!id || !/^[A-Za-z0-9_-]{32,64}$/.test(id)) {
    id = randomBytes(24).toString("base64url");
    jar.set(DEVICE_COOKIE, id, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: 2 * 365 * 86_400,
    });
  }
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? "";
  const label = deviceLabel(ua);
  try {
    const r = await callOne<{ IsNew: boolean; Alerted: boolean; Email: string; FirstName: string }>("api.Auth_SeenDevice", {
      UserId: userId, DeviceHash: sha256(id), UserAgent: ua || null, DeviceLabel: label,
    });
    return { alerted: Boolean(r?.Alerted), email: r?.Email ?? "", firstName: r?.FirstName ?? "", label };
  } catch (e) {
    console.error("[cihaz]", e);
    return { alerted: false, email: "", firstName: "", label };
  }
}
