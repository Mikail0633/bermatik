import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Home, Plus, Store } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { call } from "@/lib/db";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: { default: "İşletme paneli", template: "%s | Bermatik İşletme" }, robots: { index: false } };

export type MyShop = { Id: string; Code: string; Segment: "erkek" | "kadin"; Name: string; Status: string; StatusReason: string | null; IsOwner: boolean };

// Berber / kuaför / personel paneli
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/panel");
  if (user.Role === "customer") redirect("/isletme");
  if (!user.EmailVerified && user.Role !== "admin") redirect("/dogrula?sonra=/panel");
  const shops = await call<MyShop>("api.Shop_ListMine", { ActorId: user.Id });
  return (
    <div data-segment="erkek" className="min-h-dvh bg-bg text-ink lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 p-4">
          <Link href="/panel" aria-label="İşletme paneli"><Logo /></Link>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold">İşletme</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible">
          {shops.map((s) => (
            <Link key={s.Id} href={`/panel/${s.Id}`} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-2">
              <Store className="h-4 w-4 text-muted" aria-hidden />
              <span className="truncate">{s.Name}</span>
              {s.Status === "pending" && <span className="rounded bg-accent/30 px-1 text-[10px] font-bold">ONAY</span>}
            </Link>
          ))}
          <Link href="/panel/yeni" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-accent hover:bg-surface-2">
            <Plus className="h-4 w-4" aria-hidden /> Dükkân ekle (ilan ver)
          </Link>
          <Link href="/panel/belgelerim" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
            <BadgeCheck className="h-4 w-4 text-muted" aria-hidden /> Ustalık belgem
          </Link>
          {user.Role === "admin" && (
            <Link href="/admin/dukkanlar" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-surface-2">
              <Store className="h-4 w-4 text-accent" aria-hidden /> Admin paneline dön
            </Link>
          )}
          <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
            <Home className="h-4 w-4 text-muted" aria-hidden /> Siteye dön
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 p-4 sm:p-6">{children}</main>
    </div>
  );
}
