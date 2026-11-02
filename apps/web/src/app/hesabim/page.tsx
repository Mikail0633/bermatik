import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarDays, Heart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { callOne } from "@/lib/db";
import { vapidPublicKey } from "@/lib/push";
import { SiteShell } from "@/components/SiteShell";
import { ConsentPrefs, DeleteAccountForm, NotifyPrefs, PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Hesabım", robots: { index: false } };
export const dynamic = "force-dynamic";

type Prefs = { PushOptIn: boolean; SlotAlertsOptIn: boolean; HasDevice: boolean };

export default async function Page() {
  const user = await requireUser("/hesabim");
  const [prefs, consent] = await Promise.all([
    callOne<Prefs>("api.Notify_GetPreferences", { ActorId: user.Id }),
    callOne<{ Enabled: boolean; Email: boolean; Sms: boolean }>("api.Consent_Get", { ActorId: user.Id }),
  ]);
  // İzin bölümü: Bermatik onay alıyorsa ya da kişinin geri alabileceği bir onayı varsa görünür
  const showConsent = Boolean(consent && (consent.Enabled || consent.Email || consent.Sms));
  const box = "rounded-2xl border border-line bg-surface p-5";
  return (
    <SiteShell segment="erkek">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-3xl font-extrabold">Hesabım</h1>
          <p className="text-muted">{user.Email}</p>
        </div>

        <nav className="grid grid-cols-3 gap-2 text-center text-sm font-semibold">
          {[
            { href: "/randevularim", icon: CalendarDays, label: "Randevularım" },
            { href: "/favorilerim", icon: Heart, label: "Favorilerim" },
            { href: "/bildirimler", icon: Bell, label: "Bildirimler" },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface p-3 hover:bg-surface-2">
              <Icon className="h-6 w-6 text-accent" aria-hidden /> {label}
            </Link>
          ))}
        </nav>

        <section className={box}>
          <h2 className="mb-3 text-lg font-bold">Bilgilerim</h2>
          <ProfileForm firstName={user.FirstName} lastName={user.LastName} phone={user.Phone ?? ""} birthYear={user.BirthYear ?? null} />
        </section>

        <section className={box}>
          <h2 className="mb-3 text-lg font-bold">Bildirimler</h2>
          <NotifyPrefs slotAlerts={Boolean(prefs?.SlotAlertsOptIn)} push={Boolean(prefs?.PushOptIn)} vapidKey={vapidPublicKey()} />
        </section>

        {showConsent && (
          <section className={box}>
            <h2 className="mb-3 text-lg font-bold">Kampanya izinleri</h2>
            <ConsentPrefs email={Boolean(consent?.Email)} sms={Boolean(consent?.Sms)} canEnable={Boolean(consent?.Enabled)} />
          </section>
        )}

        <section className={box}>
          <h2 className="mb-3 text-lg font-bold">Şifre değiştir</h2>
          <PasswordForm />
        </section>

        <section className={`${box} border-closed/30`}>
          <h2 className="text-lg font-bold text-closed">Hesabı sil</h2>
          <p className="mb-3 mt-1 text-sm text-muted">
            Hesabınız ve kişisel bilgileriniz (ad, telefon, e-posta, yorumlar, favoriler) kalıcı olarak silinir. İleri tarihli
            randevularınız iptal edilir. Bu işlem geri alınamaz.
          </p>
          {user.Role === "admin"
            ? <p className="text-sm text-muted">Admin hesabı buradan silinemez.</p>
            : <DeleteAccountForm />}
        </section>
      </div>
    </SiteShell>
  );
}
