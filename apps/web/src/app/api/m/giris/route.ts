import { createHash } from "node:crypto";
import { call, callOne } from "@/lib/db";
import { hashPassword, rateLimit, verifyPassword } from "@/lib/auth";
import { body, createMobileSession, fail, handler, ok, publicUser, rememberPhone, str } from "@/lib/mobile";
import type { SessionUser } from "@/lib/auth";

type LoginRow = { Id: string; PasswordHash: string; IsActive: boolean; LockedUntil: Date | null };
let dummyHash: Promise<string> | undefined;

// Uygulamadan giriş: { email, password, deviceId, deviceName } → { token, user }
export const POST = handler(async (req: Request) => {
  const b = await body(req);
  const email = str(b.email, 254), password = typeof b.password === "string" ? b.password.slice(0, 128) : "";
  if (!(await rateLimit("m-giris", 10, 60_000))) return fail("Çok fazla deneme yaptınız. Bir dakika sonra tekrar deneyin.", 429);
  if (!email || !password) return fail("E-posta ve şifrenizi girin.");

  const row = await callOne<LoginRow>("api.Auth_GetUserForLogin", { Email: email });
  if (!row) {
    dummyHash ??= hashPassword("bermatik-sahte-sifre");
    await verifyPassword(await dummyHash, password);
    return fail("E-posta veya şifre hatalı.", 401);
  }
  if (!row.IsActive) return fail("Bu hesap kapatılmış. Yardım için bize ulaşın.", 403);
  if (row.LockedUntil && new Date(row.LockedUntil) > new Date()) {
    const mins = Math.ceil((new Date(row.LockedUntil).getTime() - Date.now()) / 60_000);
    return fail(`Çok fazla hatalı deneme. ${mins} dakika sonra tekrar deneyin.`, 429);
  }
  const good = await verifyPassword(row.PasswordHash, password);
  await call("api.Auth_RecordLoginResult", { UserId: row.Id, Success: good });
  if (!good) return fail("E-posta veya şifre hatalı.", 401);

  const token = await createMobileSession(row.Id);
  const user = (await callOne<SessionUser>("api.Auth_GetSession", { TokenHash: createHash("sha256").update(token).digest() }))!;
  await rememberPhone(row.Id, b.deviceId, b.deviceName);
  return ok({ token, user: publicUser(user) });
});
