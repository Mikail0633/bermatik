import { createHash } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { call, callOne } from "@/lib/db";
import { hashPassword, rateLimit, type SessionUser } from "@/lib/auth";
import { checkPassword } from "@/lib/password";
import { sendWelcomeMail } from "@/lib/welcome-mail";
import { body, createMobileSession, fail, handler, ok, publicUser, rememberPhone } from "@/lib/mobile";

const schema = z.object({
  firstName: z.string().trim().min(1, "Adınızı girin.").max(60),
  lastName: z.string().trim().min(1, "Soyadınızı girin.").max(60),
  email: z.string().trim().email("Geçerli bir e-posta adresi girin.").max(254),
  phone: z.string().trim().min(10, "Geçerli bir telefon numarası girin.").max(20),
  birthYear: z.string().trim().regex(/^(|\d{4})$/, "Doğum yılını 4 haneli yazın (örn. 1995).").optional().default(""),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı.").max(128),
  kvkk: z.literal(true, { error: "Devam etmek için KVKK aydınlatma metnini onaylayın." }),
  isBusiness: z.boolean().optional().default(false),
  consentEmail: z.boolean().optional().default(false),
  consentSms: z.boolean().optional().default(false),
});

// Kayıt ekranı ayarı: kampanya izni kutuları yalnızca bu özellik açıkken gösterilir (sitedeki gibi)
export const GET = handler(async () => {
  const s = await callOne<{ CommercialConsentEnabled: boolean }>("api.Settings_Get");
  return ok({ consentEnabled: Boolean(s?.CommercialConsentEnabled) });
});

// Uygulamadan kayıt → { token, user }. İşletme hesabı açılırsa e-posta doğrulaması sitedeki gibi sonra yapılır.
export const POST = handler(async (req: Request) => {
  const b = await body(req);
  if (!(await rateLimit("m-kayit", 5, 600_000))) return fail("Çok fazla kayıt denemesi. Biraz sonra tekrar deneyin.", 429);
  const parsed = schema.safeParse(b);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const pw = checkPassword(d.password, { email: d.email, firstName: d.firstName, lastName: d.lastName, phone: d.phone });
  if (pw.error) return fail(pw.error);

  const row = await callOne<{ Id: string }>("api.Auth_Register", {
    Email: d.email, PasswordHash: await hashPassword(d.password), FirstName: d.firstName, LastName: d.lastName,
    BirthYear: d.birthYear ? Number(d.birthYear) : null, Phone: d.phone, KvkkAccepted: true, IsBusiness: d.isBusiness,
  });
  const id = row!.Id;
  const token = await createMobileSession(id);
  await rememberPhone(id, b.deviceId, b.deviceName);
  if (d.consentEmail || d.consentSms) {
    await call("api.Consent_Set", { ActorId: id, Email: d.consentEmail, Sms: d.consentSms }).catch((e) => console.error("Ticari ileti onayı:", e));
  }
  after(() => sendWelcomeMail(d.email, d.firstName, d.isBusiness).catch((e) => console.error("Hoş geldin e-postası:", e)));
  const user = (await callOne<SessionUser>("api.Auth_GetSession", { TokenHash: createHash("sha256").update(token).digest() }))!;
  return ok({ token, user: publicUser(user) }, 201);
});
