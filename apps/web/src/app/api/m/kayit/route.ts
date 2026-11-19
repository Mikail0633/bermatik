import { createHash } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { AppError, call, callOne } from "@/lib/db";
import { hashPassword, rateLimit, type SessionUser } from "@/lib/auth";
import { checkPassword } from "@/lib/password";
import { sendAdminDocumentAlert, sendWelcomeMail } from "@/lib/welcome-mail";
import { LEGAL } from "@/lib/legal";
import { verifyDocumentForm, type VerifiedDoc } from "@/lib/doc-verify";
import { body, createMobileSession, fail, handler, ok, publicUser, rememberPhone } from "@/lib/mobile";

// İşletme hesabı belgesi (sitedeki kayıt formuyla aynı): tür + numara + fotoğraf (base64). Fotoğraf en fazla 8 MB.
const docSchema = z.object({
  kind: z.string().max(20),
  number: z.string().max(40),
  fileBase64: z.string().min(1, "Belgenin fotoğrafını seçin.").max(11_300_000, "Dosya en fazla 8 MB olabilir."),
  mimeType: z.string().max(40).optional().default("image/jpeg"),
});

const schema = z.object({
  firstName: z.string().trim().min(1, "Adınızı girin.").max(60),
  lastName: z.string().trim().min(1, "Soyadınızı girin.").max(60),
  email: z.string().trim().email("Geçerli bir e-posta adresi girin.").max(254),
  phone: z.string().trim().min(10, "Geçerli bir telefon numarası girin.").max(20),
  birthYear: z.string().trim().regex(/^(|\d{4})$/, "Doğum yılını 4 haneli yazın (örn. 1995).").optional().default(""),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı.").max(128),
  kvkk: z.literal(true, { error: "Devam etmek için KVKK aydınlatma metnini onaylayın." }),
  isBusiness: z.boolean().optional().default(false),
  doc: docSchema.optional(),
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

  // İşletme hesabı: doğrulama belgesi zorunlu (sitedeki kayıtla aynı kontroller). Hesap açılmadan önce kontrol edilir:
  // numara türüne göre, kimlik nüfustan; aynı belge başka hesapta kullanılıyorsa hesap hiç açılmaz.
  let doc: VerifiedDoc | undefined;
  let discardDoc = async () => {};
  if (d.isBusiness) {
    if (!d.doc) return fail("İşletme hesabı için doğrulama belgesi yükleyin.");
    const form = new FormData();
    form.set("kind", d.doc.kind);
    form.set("docNumber", d.doc.number);
    form.set("file", new File([Buffer.from(d.doc.fileBase64, "base64")], "belge", { type: d.doc.mimeType }));
    const v = await verifyDocumentForm(form, { firstName: d.firstName, lastName: d.lastName, birthYear: d.birthYear ? Number(d.birthYear) : null });
    if (!v.doc) return fail(`Belge: ${v.error}`);
    doc = v.doc;
    discardDoc = v.discard;
    try {
      await call("api.OwnerDocument_CheckUnique", { Kind: doc.Kind, NumberHash: doc.NumberHash, FileHash: doc.FileHash });
    } catch (e) {
      await discardDoc();
      if (e instanceof AppError) return fail(`Belge: ${e.message}`);
      throw e;
    }
  }

  let id: string;
  try {
    const row = await callOne<{ Id: string }>("api.Auth_Register", {
      Email: d.email, PasswordHash: await hashPassword(d.password), FirstName: d.firstName, LastName: d.lastName,
      BirthYear: d.birthYear ? Number(d.birthYear) : null, Phone: d.phone, KvkkAccepted: true, KvkkVersion: LEGAL.version, IsBusiness: d.isBusiness,
    });
    id = row!.Id;
  } catch (e) {
    await discardDoc();
    throw e;
  }
  if (doc) {
    // Olmazsa (ör. aynı anda başka hesap aynı belgeyi yükledi) hesap belgesiz kalır; panel kilit ekranı yeniden belge ister
    const added = await call("api.OwnerDocument_Add", { ActorId: id, ShopId: null, ClaimId: null, ...doc })
      .then(() => true, async (e) => { console.error("Kayıt belgesi:", e); await discardDoc(); return false; });
    const k = doc.Kind, auto = doc.NviResult === "dogru";
    if (added) after(() => sendAdminDocumentAlert(`${d.firstName} ${d.lastName}`, k, auto).catch((e) => console.error("Admin belge e-postası:", e)));
  }
  const token = await createMobileSession(id);
  await rememberPhone(id, b.deviceId, b.deviceName);
  if (d.consentEmail || d.consentSms) {
    await call("api.Consent_Set", { ActorId: id, Email: d.consentEmail, Sms: d.consentSms }).catch((e) => console.error("Ticari ileti onayı:", e));
  }
  after(() => sendWelcomeMail(d.email, d.firstName, d.isBusiness).catch((e) => console.error("Hoş geldin e-postası:", e)));
  const user = (await callOne<SessionUser>("api.Auth_GetSession", { TokenHash: createHash("sha256").update(token).digest() }))!;
  return ok({ token, user: publicUser(user) }, 201);
});
