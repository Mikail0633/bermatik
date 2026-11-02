import Link from "next/link";
import { Bell, CircleUserRound } from "lucide-react";
import { AccountMenu } from "./AccountMenu";
import { Logo } from "./Logo";
import { ShareButton } from "./ShareButton";
import { SEGMENTS, type Segment } from "@/lib/types";
import { getUser, sessionEnded } from "@/lib/auth";
import { callOne } from "@/lib/db";
import { logout } from "@/app/giris/actions";

// Her sayfanın çerçevesi: üst menü (logo + Erkek/Kadın düğmesi + hesap), içerik, alt bilgi.
// data-segment, renk temasını seçer (globals.css).
export async function SiteShell({ segment, children }: { segment: Segment; children: React.ReactNode }) {
  const user = await getUser();
  const ended = !user && (await sessionEnded());
  const unread = user ? (await callOne<{ UnreadCount: number }>("api.Notification_UnreadCount", { ActorId: user.Id }))?.UnreadCount ?? 0 : 0;
  return (
    <div data-segment={segment} className="flex min-h-dvh flex-col bg-bg text-ink">
      {ended && (
        <div className="flex flex-wrap items-center justify-center gap-2 bg-accent px-4 py-2 text-center text-sm font-medium text-accent-ink">
          Hesabınıza başka bir cihazdan giriş yapıldığı için oturumunuz kapandı.
          <Link href="/giris?neden=oturum" className="font-bold underline">Tekrar giriş yap</Link>
          <form action={logout}><button type="submit" className="underline">Kapat</button></form>
        </div>
      )}
      {user && !user.Phone && (
        <div className="bg-accent px-4 py-2 text-center text-sm font-medium text-accent-ink">
          Hesabınızda telefon numarası yok. <Link href="/hesabim" className="font-bold underline">Telefon numaranızı ekleyin</Link>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        {/* Site deneme sürümünde: sağ üst köşede küçük "Beta" etiketi (yer kaplamaz) */}
        <span title="Bermatik deneme sürümünde; bir sorun görürseniz bize bildirin."
          className="pointer-events-none absolute right-1 top-0.5 z-10 rounded-b-md bg-accent px-1.5 py-px text-[9px] font-extrabold uppercase leading-tight tracking-wider text-accent-ink sm:right-2">
          Beta
        </span>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-3">
          <Link href={SEGMENTS[segment].home} aria-label="Bermatik ana sayfa">
            <Logo compact />
          </Link>
          <SegmentToggle segment={segment} />
          <div className="flex items-center gap-1">
          {user ? (
            <nav className="flex items-center gap-1">
              <Link href="/bildirimler" aria-label={unread ? `Bildirimler (${unread} yeni)` : "Bildirimler"} className="relative rounded-lg p-2 hover:bg-surface-2">
                <Bell className="h-5 w-5" aria-hidden />
                {unread > 0 && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-closed px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>}
              </Link>
              <AccountMenu name={`${user.FirstName} ${user.LastName}`} role={user.Role} logout={logout} />
            </nav>
          ) : (
            <>
              <Link href="/giris" aria-label="Giriş yap" className="rounded-lg p-2 hover:bg-surface-2 sm:hidden">
                <CircleUserRound className="h-7 w-7" aria-hidden />
              </Link>
              <nav className="hidden items-center gap-1 sm:flex">
                <Link href="/giris" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-2">
                  Giriş yap
                </Link>
                <Link href="/kayit" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-ink hover:opacity-90">
                  Kayıt ol
                </Link>
              </nav>
            </>
          )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      <ShareButton />

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-24 pt-8 text-sm text-muted sm:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-2">Türkiye&apos;nin berber ve kuaför randevu platformu.</p>
          </div>
          <ul className="space-y-1">
            <li><Link href="/" className="hover:text-ink">Erkek berberleri</Link></li>
            <li><Link href="/kadin" className="hover:text-ink">Kadın kuaförleri</Link></li>
            {user?.Role !== "customer" && <li><Link href="/isletme" className="hover:text-ink">Dükkânını ekle</Link></li>}
            <li><Link href="/oneri" className="hover:text-ink">Eksik dükkân bildir</Link></li>
          </ul>
          <ul className="space-y-1">
            <li><Link href="/kvkk" className="hover:text-ink">KVKK aydınlatma metni</Link></li>
            <li><Link href="/kullanim-kosullari" className="hover:text-ink">Kullanım koşulları</Link></li>
            <li>© {new Date().getFullYear()} Bermatik</li>
            <li className="text-xs">
              Henüz katılmamış dükkân bilgileri ve harita ©{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap katkıcıları</a> (ODbL) ve{" "}
              <a href="https://docs.overturemaps.org/attribution/" target="_blank" rel="noopener noreferrer" className="underline">Overture Maps Foundation</a> (CDLA-Permissive-2.0)
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

// Tek düğmeyle Erkek ↔ Kadın geçişi
function SegmentToggle({ segment }: { segment: Segment }) {
  return (
    <div role="group" aria-label="Bölüm seçimi" className="flex rounded-full border border-line bg-surface-2 p-1 text-sm font-semibold">
      {(["erkek", "kadin"] as const).map((s) => (
        <Link
          key={s}
          href={SEGMENTS[s].home}
          aria-current={s === segment ? "page" : undefined}
          className={`rounded-full px-4 py-1.5 transition ${
            s === segment ? "bg-primary text-primary-ink shadow" : "text-muted hover:text-ink"
          }`}
        >
          {SEGMENTS[s].label}
        </Link>
      ))}
    </div>
  );
}
