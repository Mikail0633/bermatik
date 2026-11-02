"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  changePassword, deleteAccount, removePushSubscription, savePushSubscription, sendTestPush, setConsentPrefs, setNotifyPrefs, updateProfile, type HesapState,
} from "../hesap-actions";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { PasswordField } from "@/components/PasswordField";

const Ok = ({ s }: { s: HesapState }) => (s?.ok ? <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{s.ok}</p> : null);

export function ProfileForm({ firstName, lastName, phone, birthYear }: { firstName: string; lastName: string; phone: string; birthYear: number | null }) {
  const [state, action] = useActionState<HesapState, FormData>(updateProfile, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} /><Ok s={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ad" name="firstName" required defaultValue={firstName} autoComplete="given-name" />
        <Field label="Soyad" name="lastName" required defaultValue={lastName} autoComplete="family-name" />
      </div>
      <Field label="Telefon" name="phone" type="tel" required defaultValue={phone} autoComplete="tel" />
      <Field label="Doğum yılı (isteğe bağlı)" name="birthYear" inputMode="numeric" defaultValue={birthYear ? String(birthYear) : ""} />
      <SubmitButton>Kaydet</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<HesapState, FormData>(changePassword, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <FormError message={state?.error} /><Ok s={state} />
      <Field label="Mevcut şifre" name="current" type="password" required autoComplete="current-password" />
      <PasswordField label="Yeni şifre" name="next" />
      <SubmitButton>Şifreyi değiştir</SubmitButton>
    </form>
  );
}

// Açma/kapama anahtarı
function Switch({ checked, onChange, disabled, label, text }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; text: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span><span className="block font-semibold">{label}</span><span className="block text-sm text-muted">{text}</span></span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className="relative mt-1 h-6 w-11 shrink-0 rounded-full bg-line transition peer-checked:bg-open peer-focus-visible:ring-2 peer-focus-visible:ring-primary after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}

// Ticari ileti izinleri: kapatmak her zaman mümkün; açmak yalnızca Bermatik onay alırken (canEnable)
export function ConsentPrefs({ email, sms, canEnable }: { email: boolean; sms: boolean; canEnable: boolean }) {
  const [v, setV] = useState({ email, sms });
  const [msg, setMsg] = useState<HesapState>();
  const [pending, start] = useTransition();
  const save = (next: typeof v) => {
    const prev = v;
    setV(next);
    start(async () => {
      const r = await setConsentPrefs(next.email, next.sms);
      if (r?.error) setV(prev);
      setMsg(r);
    });
  };
  return (
    <div className="divide-y divide-line">
      <p className="pb-2 text-sm text-muted">Randevu, hatırlatma ve şifre gibi bilgilendirme iletileri bu ayardan etkilenmez.</p>
      <Switch label="E-posta ile kampanya ve fırsatlar" text="Bermatik ve dükkânların kampanyalarından e-postayla haberdar olun."
        checked={v.email} disabled={pending || (!v.email && !canEnable)} onChange={(email) => save({ ...v, email })} />
      <Switch label="SMS ile kampanya ve fırsatlar" text="Bermatik ve dükkânların kampanyalarından SMS ile haberdar olun."
        checked={v.sms} disabled={pending || (!v.sms && !canEnable)} onChange={(sms) => save({ ...v, sms })} />
      {msg?.error && <p className="pt-2 text-sm text-closed">{msg.error}</p>}
      {msg?.ok && <p className="pt-2 text-sm text-open">{msg.ok}</p>}
    </div>
  );
}

// Sunucunun açık anahtarı (base64url) → tarayıcının beklediği bayt dizisi
function keyBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Bu tarayıcıyı bildirim alacak cihaz olarak kaydeder; hata varsa açıklamasını döner
async function subscribeThisDevice(vapidKey: string): Promise<string | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "Bu tarayıcı bildirimleri desteklemiyor. iPhone'da önce siteyi “Ana Ekrana Ekle” ile uygulama gibi kurun.";
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "Bildirim izni verilmedi. Tarayıcının site ayarlarından bildirimlere izin verip tekrar deneyin.";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
  const r = await savePushSubscription(sub.toJSON() as Parameters<typeof savePushSubscription>[0]);
  return r?.error ?? null;
}

async function unsubscribeThisDevice() {
  if (!("serviceWorker" in navigator)) return;
  const sub = await (await navigator.serviceWorker.getRegistration("/sw.js"))?.pushManager.getSubscription();
  if (!sub) return;
  await removePushSubscription(sub.endpoint);
  await sub.unsubscribe();
}

export function NotifyPrefs({ slotAlerts, push, vapidKey }: { slotAlerts: boolean; push: boolean; vapidKey: string | null }) {
  const [v, setV] = useState({ slotAlerts, push });
  const [msg, setMsg] = useState<HesapState>();
  const [pending, start] = useTransition();
  const save = (next: typeof v) => {
    const pushChanged = next.push !== v.push;
    setV(next);
    start(async () => {
      try {
        if (pushChanged && next.push) {
          const err = vapidKey ? await subscribeThisDevice(vapidKey) : "Telefon bildirimleri henüz ayarlanmadı.";
          if (err) { setV({ ...next, push: false }); setMsg({ error: err }); return; }
        }
        if (pushChanged && !next.push) await unsubscribeThisDevice();
        setMsg(await setNotifyPrefs(next.slotAlerts, next.push));
      } catch {
        setV(v);
        setMsg({ error: "Bir sorun oldu, tekrar deneyin." });
      }
    });
  };
  const test = () => start(async () => setMsg(await sendTestPush()));
  return (
    <div className="divide-y divide-line">
      <p className="pb-2 text-sm text-muted">Randevu onayı, iptali ve hatırlatmaları (1 gün ve 2 saat kala) her zaman <b>Bildirimler</b> sayfanıza düşer.</p>
      <Switch label="Telefonuma da gönder" text="Bildirimler bu cihaza da gelsin; site kapalıyken bile. Başka cihazlarınızda da ayrıca açabilirsiniz."
        checked={v.push} disabled={pending} onChange={(push) => save({ ...v, push })} />
      {v.push && (
        <div className="py-2">
          <button type="button" onClick={test} disabled={pending} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50">
            Deneme bildirimi gönder
          </button>
        </div>
      )}
      <Switch label="Boşalan randevu haberleri" text="Gittiğiniz dükkânda biri randevusunu iptal edince, zamanınız geldiyse haber verelim."
        checked={v.slotAlerts} disabled={pending} onChange={(slotAlerts) => save({ ...v, slotAlerts })} />
      {msg?.error && <p className="pt-2 text-sm text-closed">{msg.error}</p>}
      {msg?.ok && <p className="pt-2 text-sm text-open">{msg.ok}</p>}
    </div>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState<HesapState, FormData>(deleteAccount, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Onaylamak için kutuya <b>SİL</b> yazın</span>
        <input name="confirm" autoComplete="off" className="w-full rounded-xl border border-line px-3 py-2.5" />
      </label>
      <button className="rounded-xl bg-closed px-5 py-2.5 font-semibold text-white hover:opacity-90">Hesabımı kalıcı olarak sil</button>
    </form>
  );
}
