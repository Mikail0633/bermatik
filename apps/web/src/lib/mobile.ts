import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse, after } from "next/server";
import { sendNewDeviceMail } from "./welcome-mail";
import { AppError, call, callOne } from "./db";
import type { SessionUser } from "./auth";

// =====================================================================
// Telefon uygulaması (Bermatik mobil) için yardımcılar.
// Uygulama çerez kullanmaz: girişte bir anahtar alır ve her istekte
// "Authorization: Bearer <anahtar>" başlığıyla gönderir. Veritabanında
// sitedeki gibi yalnızca anahtarın SHA-256 özeti tutulur (Client = 'mobile').
// Kural: bir hesap aynı anda 1 sitede + 1 telefonda açık olabilir.
// =====================================================================

const SESSION_DAYS = 90;
const sha256 = (s: string) => createHash("sha256").update(s).digest();

export async function createMobileSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  await call("api.Auth_CreateSession", {
    UserId: userId,
    TokenHash: sha256(token),
    ExpiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
    IpAddress: process.env.TRUST_PROXY === "1" ? (h.get("x-forwarded-for")?.split(",").pop()?.trim().slice(0, 45) || null) : null,
    UserAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    Client: "mobile",
  });
  return token;
}

async function bearer() {
  const v = (await headers()).get("authorization") ?? "";
  const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(v);
  return m?.[1] ?? null;
}

/** Uygulamadan gelen isteğin kullanıcısı (giriş yoksa null) */
export async function mobileUser(): Promise<SessionUser | null> {
  const token = await bearer();
  if (!token) return null;
  return (await callOne<SessionUser>("api.Auth_GetSession", { TokenHash: sha256(token) })) ?? null;
}

export async function endMobileSession() {
  const token = await bearer();
  if (token) await call("api.Auth_DeleteSession", { TokenHash: sha256(token) });
}

/** Uygulamaya döndürülen kullanıcı bilgisi (şifre/gizli alan yok) */
export const publicUser = (u: SessionUser) => ({
  id: u.Id, email: u.Email, role: u.Role, firstName: u.FirstName, lastName: u.LastName,
  phone: u.Phone, birthYear: u.BirthYear, emailVerified: Boolean(u.EmailVerified),
});

const NO_STORE = { "Cache-Control": "no-store" };
export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });
export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: NO_STORE });

/**
 * Uç noktayı sarar: veritabanının Türkçe hatalarını (AppError) uygulamaya aynen iletir,
 * beklenmeyen hatada genel bir mesaj döner (ayrıntı yalnızca sunucu kaydında).
 */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AppError) return fail(e.message, e.status);
      console.error("[mobil api]", e);
      return fail("Bir sorun oluştu. Lütfen biraz sonra tekrar deneyin.", 500);
    }
  };
}

/** Giriş zorunlu uç noktalar için */
export function authed<A extends unknown[]>(fn: (user: SessionUser, ...args: A) => Promise<Response>) {
  return handler(async (...args: A) => {
    const user = await mobileUser();
    if (!user) return fail("Oturumunuz kapanmış. Lütfen tekrar giriş yapın.", 401);
    return fn(user, ...args);
  });
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<Partial<T>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Partial<T>) : {};
  } catch {
    return {};
  }
}

export const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Yeni telefondan girişte güvenlik bildirimi (sitedeki "yeni cihaz" uyarısının aynısı) */
export async function rememberPhone(userId: string, deviceId: unknown, deviceName: unknown) {
  const id = typeof deviceId === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(deviceId) ? deviceId : null;
  if (!id) return;
  const label = (str(deviceName, 80) || "Telefon") + " (Bermatik uygulaması)";
  try {
    const r = await callOne<{ Alerted: boolean; Email: string; FirstName: string }>("api.Auth_SeenDevice", {
      UserId: userId, DeviceHash: createHash("sha256").update(`m:${id}`).digest(), UserAgent: null, DeviceLabel: label.slice(0, 100),
    });
    if (r?.Alerted) after(() => sendNewDeviceMail(r.Email, r.FirstName, label).catch((e) => console.error("Yeni cihaz e-postası:", e)));
  } catch (e) {
    console.error("[cihaz]", e);
  }
}
