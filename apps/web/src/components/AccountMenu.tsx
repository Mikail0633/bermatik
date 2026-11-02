"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { openPanel } from "@/app/panel/gorunum-actions";
import { CalendarDays, ChevronDown, CircleUserRound, Heart, LayoutDashboard, LogOut, ShoppingBag, Store, UserRound } from "lucide-react";

// Üst menüdeki tek "Hesabım" menüsü; işletme paneli yalnızca burada ("İşletmem").
// Yönetim paneline dönüş ("Panele dön") ve dükkân/personel paneline geçiş yalnızca admin hesabına görünür; başkası bunları hiç görmez.
export function AccountMenu({ name, role, logout }: { name: string; role: string; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const item = "flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2";
  const business = role === "shop_owner" || role === "staff";
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
        className="inline-flex items-center gap-1 rounded-lg p-2 text-sm font-medium hover:bg-surface-2">
        <CircleUserRound className="h-5 w-5" aria-hidden /> <span className="hidden sm:inline">Hesabım</span> <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-60 rounded-2xl border border-line bg-surface p-2 shadow-xl">
          <p className="truncate px-3 pb-2 pt-1 text-xs text-muted">{name}</p>
          <Link role="menuitem" href="/hesabim" className={item}><CircleUserRound className="h-4 w-4" aria-hidden /> Hesabım</Link>
          <Link role="menuitem" href="/randevularim" className={item}><CalendarDays className="h-4 w-4" aria-hidden /> Randevularım</Link>
          <Link role="menuitem" href="/favorilerim" className={item}><Heart className="h-4 w-4" aria-hidden /> Favorilerim</Link>
          <Link role="menuitem" href="/siparislerim" className={item}><ShoppingBag className="h-4 w-4" aria-hidden /> Siparişlerim</Link>
          {role === "admin" && (
            <>
              <Link role="menuitem" href="/admin" className={item}><LayoutDashboard className="h-4 w-4" aria-hidden /> Panele dön</Link>
              <form action={openPanel.bind(null, "sahip")}>
                <button type="submit" role="menuitem" className={`${item} w-full text-left`}><Store className="h-4 w-4" aria-hidden /> Dükkân paneli</button>
              </form>
              <form action={openPanel.bind(null, "personel")}>
                <button type="submit" role="menuitem" className={`${item} w-full text-left`}><UserRound className="h-4 w-4" aria-hidden /> Personel paneli</button>
              </form>
            </>
          )}
          {business && <Link role="menuitem" href="/panel" className={item}><Store className="h-4 w-4" aria-hidden /> İşletmem</Link>}
          <form action={logout} className="mt-2 border-t border-line pt-2">
            <button type="submit" role="menuitem" className={`${item} w-full text-left`}><LogOut className="h-4 w-4" aria-hidden /> Çıkış yap</button>
          </form>
        </div>
      )}
    </div>
  );
}
