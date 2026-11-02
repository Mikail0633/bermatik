"use server";

import { createHash, randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { hashPassword, rateLimit } from "@/lib/auth";
import { AppError, call, callOne } from "@/lib/db";
import { mailConfigured, sendMail } from "@/lib/mail";
import { isBot } from "@/lib/bot";
import { checkPassword } from "@/lib/password";

export type ResetState = { step: "email" | "code"; email?: string; error?: string; ok?: string; devCode?: string };

const normEmail = (s: unknown) => String(s ?? "").trim().toLowerCase();
// Özet e-postayla birlikte alınır: iki kişiye aynı 6 haneli kod düşerse de çakışmaz
const codeHash = (email: string, code: string) => createHash("sha256").update(`${email}:${code}`).digest();

// 1) Kod iste. Kayıtlı olsun olmasın aynı cevap verilir (kimin kayıtlı olduğu sızmasın).
export async function requestCode(_: ResetState, form: FormData): Promise<ResetState> {
  const email = normEmail(form.get("email"));
  if (!/^\S+@\S+\.\S+$/.test(email)) return { step: "email", error: "Geçerli bir e-posta adresi girin." };
  // Tek alanlı form: tarayıcı e-postayı otomatik doldurunca anında gönderilebilir, süre şartı yok
  const bot = await isBot(form, "sifre-kod", 0);
  if (bot) return { step: "email", email, error: bot };
  if (!(await rateLimit("sifre-kod", 5, 600_000))) return { step: "email", email, error: "Çok fazla deneme. Biraz sonra tekrar deneyin." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const row = await callOne<{ UserId: string; FirstName: string }>("api.Auth_CreatePasswordReset", {
    Email: email, TokenHash: codeHash(email, code), ExpiresAt: new Date(Date.now() + 15 * 60_000),
  });
  if (row) {
    await sendMail(
      { email, name: row.FirstName },
      `Bermatik şifre sıfırlama kodunuz: ${code}`,
      `Merhaba ${row.FirstName},\n\nŞifrenizi sıfırlamak için kodunuz: ${code}\n\nKod 15 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayın; şifreniz değişmez.\n\nBermatik`,
    );
  }
  // E-posta servisi bağlı değilse (yalnızca geliştirmede) kod ekranda gösterilir
  const dev = row && !mailConfigured() && process.env.NODE_ENV !== "production";
  return {
    step: "code", email,
    ok: `Bu adres kayıtlıysa ${email} adresine 6 haneli bir kod gönderdik.`,
    devCode: dev ? code : undefined,
  };
}

// 2) Kod + yeni şifre
export async function resetPassword(prev: ResetState, form: FormData): Promise<ResetState> {
  const email = normEmail(form.get("email"));
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  const password = String(form.get("password") ?? "");
  const back = { step: "code" as const, email, ok: prev.ok, devCode: prev.devCode };
  if (!(await rateLimit("sifre-yenile", 10, 600_000))) return { ...back, error: "Çok fazla deneme. Biraz sonra tekrar deneyin." };
  if (code.length !== 6) return { ...back, error: "E-postanıza gelen 6 haneli kodu girin." };
  const pw = checkPassword(password, { email });
  if (pw.error) return { ...back, error: pw.error };
  try {
    await call("api.Auth_ResetPassword", { Email: email, TokenHash: codeHash(email, code), PasswordHash: await hashPassword(password) });
  } catch (e) {
    if (e instanceof AppError) return { ...back, error: e.message };
    throw e;
  }
  redirect("/giris?neden=sifre");
}
