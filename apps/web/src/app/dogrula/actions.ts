"use server";

import { createHash, randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { requireUser, safeNext } from "@/lib/auth";
import { AppError, call, callOne } from "@/lib/db";
import { mailConfigured, sendMail } from "@/lib/mail";

export type DogrulaState = { error?: string; ok?: string; devCode?: string } | undefined;
const sha = (code: string) => createHash("sha256").update(code).digest();

// 6 haneli kod üret, özetini kaydet, e-postayla gönder
export async function sendCode(auto = false): Promise<DogrulaState> {
  const user = await requireUser("/dogrula");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    const to = await callOne<{ Email: string; FirstName: string }>("api.Email_CreateCode", { ActorId: user.Id, CodeHash: sha(code) });
    await sendMail(
      { email: to!.Email, name: to!.FirstName },
      `Bermatik doğrulama kodunuz: ${code}`,
      `Merhaba ${to!.FirstName},\n\nBermatik işletme hesabınızı doğrulamak için kodunuz: ${code}\n\nKod 15 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayın.\n\nBermatik`,
    );
  } catch (e) {
    // Sayfa kendiliğinden kod isterken az önce gönderilmişse hata değil, bilgi göster
    if (e instanceof AppError && auto && e.message.includes("1 dakika")) return { ok: `Kod az önce ${user.Email} adresine gönderildi; e-postanızı kontrol edin.` };
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  // E-posta servisi henüz bağlı değilse (geliştirme), kod ekranda gösterilir
  const dev = !mailConfigured() && process.env.NODE_ENV !== "production";
  return { ok: `Kod ${user.Email} adresine gönderildi.`, devCode: dev ? code : undefined };
}

export async function verifyCode(_: DogrulaState, form: FormData): Promise<DogrulaState> {
  const user = await requireUser("/dogrula");
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "6 haneli kodu girin." };
  try {
    await call("api.Email_VerifyCode", { ActorId: user.Id, CodeHash: sha(code) });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  redirect(safeNext(form.get("sonra")) === "/" ? "/panel" : safeNext(form.get("sonra")));
}
