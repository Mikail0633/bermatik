"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { AppError, call, callOne } from "@/lib/db";
import { createSession, destroySession, hashPassword, rateLimit, rememberDevice, safeNext, verifyPassword } from "@/lib/auth";
import { sendNewDeviceMail, sendWelcomeMail } from "@/lib/welcome-mail";
import { isBot } from "@/lib/bot";
import { checkPassword } from "@/lib/password";


export type FormState = { error?: string; values?: Record<string, string> } | undefined;

type LoginRow = { Id: string; PasswordHash: string; Role: string; IsActive: boolean; LockedUntil: Date | null };

// Zamanlama farkından "bu e-posta kayıtlı mı" anlaşılmasın diye sahte doğrulama
let dummyHash: Promise<string> | undefined;

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("sonra"));
  const values = { email };

  const bot = await isBot(form, "giris", 0);
  if (bot) return { error: bot, values };
  if (!(await rateLimit("giris", 10, 60_000))) return { error: "Çok fazla deneme yaptınız. Bir dakika sonra tekrar deneyin.", values };
  if (!email || !password) return { error: "E-posta ve şifrenizi girin.", values };

  const user = await callOne<LoginRow>("api.Auth_GetUserForLogin", { Email: email });
  if (!user) {
    dummyHash ??= hashPassword("bermatik-sahte-sifre");
    await verifyPassword(await dummyHash, password);
    return { error: "E-posta veya şifre hatalı.", values };
  }
  if (!user.IsActive) return { error: "Bu hesap kapatılmış. Yardım için bize ulaşın.", values };
  if (user.LockedUntil && new Date(user.LockedUntil) > new Date()) {
    const mins = Math.ceil((new Date(user.LockedUntil).getTime() - Date.now()) / 60_000);
    return { error: `Çok fazla hatalı deneme. ${mins} dakika sonra tekrar deneyin.`, values };
  }

  const ok = await verifyPassword(user.PasswordHash, password);
  await call("api.Auth_RecordLoginResult", { UserId: user.Id, Success: ok });
  if (!ok) return { error: "E-posta veya şifre hatalı.", values };

  await createSession(user.Id);
  const device = await rememberDevice(user.Id);
  if (device.alerted) after(() => sendNewDeviceMail(device.email, device.firstName, device.label).catch((e) => console.error("Yeni cihaz e-postası:", e)));
  // Admin doğrudan yönetime, dükkân sahibi ve personel doğrudan işletme paneline
  if (next === "/" && user.Role === "admin") redirect("/admin");
  if (next === "/" && (user.Role === "shop_owner" || user.Role === "staff")) redirect("/panel");
  redirect(next);
}

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Adınızı girin.").max(60),
  lastName: z.string().trim().min(1, "Soyadınızı girin.").max(60),
  email: z.string().trim().email("Geçerli bir e-posta adresi girin.").max(254),
  phone: z.string().trim().min(10, "Geçerli bir telefon numarası girin.").max(20),
  birthYear: z.string().trim().regex(/^(|\d{4})$/, "Doğum yılını 4 haneli yazın (örn. 1995)."),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı.").max(128),
  kvkk: z.literal("on", { error: "Devam etmek için KVKK aydınlatma metnini onaylayın." }),
});

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(["firstName", "lastName", "email", "phone", "birthYear", "password", "kvkk", "accountType", "consentEmail", "consentSms"].map((k) => [k, String(form.get(k) ?? "")]));
  const values = { ...raw, password: "" };
  const isBusiness = raw.accountType === "isletme";
  let next = safeNext(form.get("sonra"));
  if (isBusiness && next === "/") next = "/panel";

  const bot = await isBot(form, "kayit");
  if (bot) return { error: bot, values };
  if (!(await rateLimit("kayit", 5, 600_000))) return { error: "Çok fazla kayıt denemesi. Biraz sonra tekrar deneyin.", values };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const d = parsed.data;
  const pw = checkPassword(d.password, { email: d.email, firstName: d.firstName, lastName: d.lastName, phone: d.phone });
  if (pw.error) return { error: pw.error, values };

  let id: string;
  try {
    const row = await callOne<{ Id: string }>("api.Auth_Register", {
      Email: d.email,
      PasswordHash: await hashPassword(d.password),
      FirstName: d.firstName,
      LastName: d.lastName,
      BirthYear: d.birthYear ? Number(d.birthYear) : null,
      Phone: d.phone,
      KvkkAccepted: true,
      IsBusiness: isBusiness,
    });
    id = row!.Id;
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, values };
    throw e;
  }
  await createSession(id);
  await rememberDevice(id);
  // Ticari ileti onayı (yalnızca kutu işaretliyse; özellik kapalıysa veritabanı reddeder, kayıt etkilenmez)
  if (raw.consentEmail === "on" || raw.consentSms === "on") {
    await call("api.Consent_Set", { ActorId: id, Email: raw.consentEmail === "on", Sms: raw.consentSms === "on" })
      .catch((e) => console.error("Ticari ileti onayı:", e));
  }
  // Hoş geldin e-postası kayıttan sonra arka planda gider; gönderilemezse kayıt etkilenmez
  after(() => sendWelcomeMail(d.email, d.firstName, isBusiness).catch((e) => console.error("Hoş geldin e-postası:", e)));
  redirect(isBusiness ? `/dogrula?sonra=${encodeURIComponent(next)}` : next);
}

export async function logout() {
  await destroySession();
  redirect("/");
}
