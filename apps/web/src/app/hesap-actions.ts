"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, getUser, hashPassword, rateLimit, requireUser, verifyPassword } from "@/lib/auth";
import { AppError, call, callOne } from "@/lib/db";
import { pushConfigured, sendPush, type PushTarget } from "@/lib/push";
import { isBot } from "@/lib/bot";
import { checkPassword } from "@/lib/password";

// Müşterinin kendi hesabıyla ilgili işlemler: profil, şifre, bildirim ayarları,
// favoriler, şikayet ve hesap silme.
export type HesapState = { error?: string; ok?: string } | undefined;
const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());

async function run(fn: () => Promise<unknown>, ok: string, path?: string): Promise<HesapState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  if (path) revalidatePath(path);
  return { ok };
}

export async function updateProfile(_: HesapState, form: FormData): Promise<HesapState> {
  const user = await requireUser("/hesabim");
  const by = str(form.get("birthYear"));
  if (by && !/^\d{4}$/.test(by)) return { error: "Doğum yılını 4 haneli yazın (örn. 1995)." };
  return run(() => call("api.User_UpdateProfile", {
    ActorId: user.Id, FirstName: str(form.get("firstName")), LastName: str(form.get("lastName")),
    BirthYear: by ? Number(by) : null, Phone: str(form.get("phone")),
  }), "Bilgileriniz kaydedildi.", "/hesabim");
}

const pwSchema = z.object({
  current: z.string().min(1, "Mevcut şifrenizi yazın."),
  next: z.string().min(8, "Yeni şifre en az 8 karakter olmalı.").max(128),
});

export async function changePassword(_: HesapState, form: FormData): Promise<HesapState> {
  const user = await requireUser("/hesabim");
  if (!(await rateLimit("sifre", 5, 600_000))) return { error: "Çok fazla deneme yaptınız. Biraz sonra tekrar deneyin." };
  const parsed = pwSchema.safeParse({ current: String(form.get("current") ?? ""), next: String(form.get("next") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const pw = checkPassword(parsed.data.next, { email: user.Email, firstName: user.FirstName, lastName: user.LastName, phone: user.Phone ?? undefined });
  if (pw.error) return { error: pw.error };
  const row = await callOne<{ Id: string; PasswordHash: string }>("api.Auth_GetUserForLogin", { Email: user.Email });
  if (!row || !(await verifyPassword(row.PasswordHash, parsed.data.current))) return { error: "Mevcut şifreniz yanlış." };
  // Şifre değişince tüm oturumlar kapanır (çalınan oturum varsa düşer); bu cihazda yeniden açılır
  await call("api.Auth_SetPassword", { UserId: user.Id, PasswordHash: await hashPassword(parsed.data.next) });
  await createSession(user.Id);
  return { ok: "Şifreniz değişti. Diğer cihazlardaki oturumlarınız kapatıldı." };
}

export async function setNotifyPrefs(slotAlerts: boolean, push: boolean) {
  const user = await requireUser("/hesabim");
  return run(() => call("api.Notify_SetPreferences", { ActorId: user.Id, PushOptIn: push, SlotAlertsOptIn: slotAlerts }), "Bildirim ayarlarınız kaydedildi.", "/hesabim");
}

// Ticari ileti (kampanya) izinleri — İYS'ye aktarılmak üzere kaydedilir
export async function setConsentPrefs(email: boolean, sms: boolean) {
  const user = await requireUser("/hesabim");
  return run(() => call("api.Consent_Set", { ActorId: user.Id, Email: email, Sms: sms }), "İzinleriniz kaydedildi.");  // sayfa yenilenmez: son onay kapanınca bölüm hemen kaybolmasın, mesaj görünsün
}

// Bu tarayıcıyı bildirim alacak cihaz olarak kaydet / kaldır
type PushSub = { endpoint: string; keys?: { p256dh?: string; auth?: string } };

export async function savePushSubscription(sub: PushSub): Promise<HesapState> {
  const user = await requireUser("/hesabim");
  if (!/^https:\/\/\S{10,990}$/.test(sub?.endpoint ?? "") || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Bu tarayıcı bildirimleri desteklemiyor." };
  return run(() => call("api.Push_Subscribe", {
    ActorId: user.Id, Platform: "web", Endpoint: sub.endpoint, P256dh: sub.keys!.p256dh!.slice(0, 200), AuthKey: sub.keys!.auth!.slice(0, 100),
  }), "Bu cihaz bildirim alacak.", "/hesabim");
}

export async function removePushSubscription(endpoint: string) {
  await requireUser("/hesabim");
  if (endpoint) await call("api.Push_Unsubscribe", { Endpoint: endpoint });
}

export async function sendTestPush(): Promise<HesapState> {
  const user = await requireUser("/hesabim");
  if (!(await rateLimit("deneme-bildirim", 5, 600_000))) return { error: "Çok fazla deneme. Biraz sonra tekrar deneyin." };
  if (!pushConfigured()) return { error: "Telefon bildirimleri henüz ayarlanmadı." };
  const devices = await call<PushTarget>("api.Push_ListMine", { ActorId: user.Id });
  if (devices.length === 0) return { error: "Kayıtlı cihazınız yok. Önce “Telefonuma da gönder”i açın." };
  let sent = 0;
  for (const d of devices) {
    const r = await sendPush(d, { title: "Bermatik", body: `Merhaba ${user.FirstName}, bildirimler çalışıyor! ✂️`, url: "/hesabim", tag: "deneme" });
    if (r === "ok") sent++;
    else if (r === "gone") await call("api.Push_Unsubscribe", { Endpoint: d.Endpoint });
  }
  return sent ? { ok: `Deneme bildirimi gönderildi (${sent} cihaz).` } : { error: "Bildirim gönderilemedi. Bildirimleri kapatıp yeniden açmayı deneyin." };
}

export async function deleteAccount(_: HesapState, form: FormData): Promise<HesapState> {
  const user = await requireUser("/hesabim");
  if (str(form.get("confirm")).toLocaleUpperCase("tr-TR") !== "SİL") return { error: "Onaylamak için kutuya SİL yazın." };
  const r = await run(() => call("api.User_DeleteAccount", { ActorId: user.Id }), "");
  if (r?.error) return r;
  await destroySession();
  redirect("/");
}

// Favori ekle / çıkar (giriş yoksa giriş sayfasına)
export async function toggleFavorite(shopId: string, back: string): Promise<{ error?: string; isFavorite?: boolean }> {
  const user = await getUser();
  if (!user) redirect(`/giris?sonra=${encodeURIComponent(back)}`);
  try {
    const r = await callOne<{ IsFavorite: boolean }>("api.Favorite_Toggle", { ActorId: user.Id, ShopId: shopId });
    revalidatePath("/favorilerim");
    return { isFavorite: Boolean(r?.IsFavorite) };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}

// Dükkân, yorum veya fotoğrafı şikayet et
export async function reportContent(_: HesapState, form: FormData): Promise<HesapState> {
  const user = await getUser();
  if (!user) return { error: "Bildirmek için giriş yapın." };
  const bot = await isBot(form, "sikayet");
  if (bot) return { error: bot };
  const type = str(form.get("targetType"));
  if (!["shop", "review", "photo"].includes(type)) return { error: "Bildirim türü geçersiz." };
  return run(() => call("api.Report_Create", {
    ActorId: user.Id, TargetType: type, TargetId: str(form.get("targetId")), Reason: str(form.get("reason")), Note: str(form.get("note")) || null,
  }), "Teşekkürler, bildiriminiz incelenecek.");
}
