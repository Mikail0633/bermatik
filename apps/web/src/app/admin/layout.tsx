import type { Metadata } from "next";
import Link from "next/link";
import { LocateFixed, BadgeCheck, BarChart3, Briefcase, CalendarClock, ClipboardCheck, Flag, History, Inbox, LayoutDashboard, LogOut, Map, Megaphone, MessageSquare, Settings, Store, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { callOne } from "@/lib/db";
import { logout } from "@/app/giris/actions";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: { default: "Admin paneli", template: "%s | Bermatik Admin" }, robots: { index: false } };

type Counts = { OpenRequests: number; PendingShops: number; OpenClaims: number; OpenSuggestions: number; OpenReports: number; PendingCertificates: number; NeedsReviewShops: number };

// badge: o menüde bekleyen iş sayısı (Özet sayaçlarından)
const MENU: { href: string; label: string; icon: typeof Store; badge?: (c: Counts) => number }[] = [
  { href: "/admin", label: "Özet", icon: LayoutDashboard },
  { href: "/admin/dukkanlar", label: "Dükkânlar", icon: Store, badge: (c) => c.PendingShops },
  { href: "/admin/kontrol", label: "Hızlı kontrol", icon: ClipboardCheck, badge: (c) => c.NeedsReviewShops },
  { href: "/admin/harita", label: "Dükkân haritası", icon: Map },
  { href: "/admin/sahada", label: "Sahada ekle", icon: LocateFixed },
  { href: "/panel", label: "İşletme panelleri", icon: Briefcase },
  { href: "/admin/randevu-talepleri", label: "Randevu talepleri", icon: CalendarClock, badge: (c) => c.OpenRequests },
  { href: "/admin/talepler", label: "Talepler", icon: Inbox, badge: (c) => c.OpenClaims + c.OpenSuggestions },
  { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: Users },
  { href: "/admin/duyurular", label: "Duyurular", icon: Megaphone },
  { href: "/admin/yorumlar", label: "Yorumlar", icon: MessageSquare },
  { href: "/admin/sikayetler", label: "Şikayetler", icon: Flag, badge: (c) => c.OpenReports },
  { href: "/admin/belgeler", label: "Belgeler", icon: BadgeCheck, badge: (c) => c.PendingCertificates },
  { href: "/admin/ayarlar", label: "Ayarlar ve metinler", icon: Settings },
  { href: "/admin/istatistik", label: "İstatistikler", icon: BarChart3 },
  { href: "/admin/kayitlar", label: "İşlem kayıtları", icon: History },
];

// Yalnızca admin girebilir; değilse giriş sayfasına / ana sayfaya yönlendirilir
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [dash, req] = await Promise.all([
    callOne<Omit<Counts, "OpenRequests">>("api.Admin_Dashboard", { ActorId: user.Id }),
    callOne<{ OpenRequests: number }>("api.Admin_Request_Count", { ActorId: user.Id }),
  ]);
  const counts: Counts | undefined = dash && { ...dash, OpenRequests: req?.OpenRequests ?? 0 };
  return (
    <div data-segment="erkek" className="min-h-dvh bg-bg text-ink lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 p-4">
          <Link href="/admin" aria-label="Admin ana sayfa"><Logo /></Link>
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-ink">Admin</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible">
          {MENU.map(({ href, label, icon: Icon, badge }) => {
            const n = badge && counts ? badge(counts) : 0;
            return (
              <Link key={href} href={href} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-2">
                <Icon className="h-4 w-4 text-muted" aria-hidden /> {label}
                {n > 0 && <span className="ml-auto rounded-full bg-closed px-1.5 text-xs font-bold leading-5 text-white" aria-label={`${n} bekleyen`}>{n > 99 ? "99+" : n}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-4 text-sm">
          <p className="font-semibold">{user.FirstName} {user.LastName}</p>
          <p className="truncate text-muted">{user.Email}</p>
          <div className="mt-3 flex gap-2">
            <Link href="/" className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2">Siteye dön</Link>
            <form action={logout}>
              <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2">
                <LogOut className="h-4 w-4" aria-hidden /> Çıkış
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-6">{children}</main>
    </div>
  );
}
