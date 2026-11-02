"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Store, X } from "lucide-react";

const KEY = "bm_hosgeldin";

// Siteye ilk kez gelen (giriş yapmamış) ziyaretçiye bir kez sorulur: müşteri mi, dükkân sahibi mi?
export function WelcomeChoice() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const firstBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setOpen(true); } catch { /* tarayıcı depolaması kapalıysa sorma */ }
  }, []);
  useEffect(() => {
    if (!open) return;
    firstBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close(choice = "musteri") {
    try { localStorage.setItem(KEY, choice); } catch { /* yok say */ }
    setOpen(false);
  }

  if (!open) return null;
  const card = "flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left hover:border-primary hover:bg-surface-2";
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => close()}>
      <div role="dialog" aria-modal="true" aria-labelledby="hosgeldin-baslik" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-line bg-bg p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="hosgeldin-baslik" className="text-2xl font-extrabold">Bermatik&apos;e hoş geldiniz!</h2>
          <button onClick={() => close()} aria-label="Kapat" className="rounded-lg p-1 text-muted hover:bg-surface-2"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-1 text-muted">Size nasıl yardımcı olalım?</p>
        <div className="mt-5 space-y-3">
          <button ref={firstBtn} onClick={() => close("musteri")} className={card}>
            <CalendarCheck className="h-8 w-8 shrink-0 text-accent" aria-hidden />
            <span><span className="block text-lg font-bold">Randevu almak istiyorum</span><span className="block text-sm text-muted">Yakınımdaki berber ve kuaförleri bul</span></span>
          </button>
          <button onClick={() => { close("isletme"); router.push("/kayit?tur=isletme&sonra=/panel"); }} className={card}>
            <Store className="h-8 w-8 shrink-0 text-accent" aria-hidden />
            <span><span className="block text-lg font-bold">Dükkân sahibiyim</span><span className="block text-sm text-muted">Dükkânımı ekle, online randevu al</span></span>
          </button>
        </div>
      </div>
    </div>
  );
}
