"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Copy, Mail, MoreHorizontal, Send, Share2, X } from "lucide-react";

// Kişisel sayfalar paylaşılmaz
const HIDDEN = ["/hesabim", "/randevularim", "/siparislerim", "/favorilerim", "/bildirimler", "/giris", "/kayit", "/sifremi-unuttum", "/dogrula", "/oneri", "/nereye"];

// Marka simgeleri (lucide'de yok)
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm8.4-18.2A11.8 11.8 0 0 0 1.7 17.8L0 24l6.3-1.7A11.8 11.8 0 0 0 24 12c0-3.2-1.2-6.2-3.6-8.4z" />
  </svg>
);
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
    <path d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.8 2.3h7l4.8 6.4 5.6-6.4zm-1.2 17.9h1.9L7.1 4.2H5.1L17 20.2z" />
  </svg>
);

// Sağ altta duran Paylaş düğmesi: WhatsApp en üstte, sonra diğer uygulamalar
export function ShareButton() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setCanNative(typeof navigator !== "undefined" && "share" in navigator), []);
  useEffect(() => { setOpen(false); setCopied(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (HIDDEN.some((p) => path === p || path.startsWith(`${p}/`))) return null;

  // Sayfa adresi ve başlığı tıklama anında okunur (dükkân sayfasında dükkân adı gelir)
  const page = () => {
    const url = window.location.origin + window.location.pathname;
    const title = document.title.replace(/\s*\|\s*Bermatik$/, "");
    return { url, title, text: `${title} – Bermatik'te gör:` };
  };
  const go = (href: string) => { window.open(href, "_blank", "noopener,noreferrer"); setOpen(false); };
  const e = encodeURIComponent;

  const items: { label: string; icon: React.ReactNode; color: string; onClick: () => void }[] = [
    { label: "WhatsApp", icon: <WhatsAppIcon />, color: "bg-[#25D366] text-white", onClick: () => { const p = page(); go(`https://wa.me/?text=${e(`${p.text} ${p.url}`)}`); } },
    { label: "Telegram", icon: <Send className="h-5 w-5" aria-hidden />, color: "bg-[#229ED9] text-white", onClick: () => { const p = page(); go(`https://t.me/share/url?url=${e(p.url)}&text=${e(p.text)}`); } },
    { label: "Facebook", icon: <FacebookIcon />, color: "bg-[#1877F2] text-white", onClick: () => go(`https://www.facebook.com/sharer/sharer.php?u=${e(page().url)}`) },
    { label: "X (Twitter)", icon: <XIcon />, color: "bg-black text-white", onClick: () => { const p = page(); go(`https://x.com/intent/post?url=${e(p.url)}&text=${e(p.text)}`); } },
    { label: "E-posta", icon: <Mail className="h-5 w-5" aria-hidden />, color: "bg-surface-2 text-ink", onClick: () => { const p = page(); window.location.href = `mailto:?subject=${e(p.title)}&body=${e(`${p.text} ${p.url}`)}`; setOpen(false); } },
  ];

  const copy = async () => {
    try { await navigator.clipboard.writeText(page().url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* izin yoksa sessiz */ }
  };
  // Telefonun kendi paylaşım listesi: Instagram, Messenger, SMS ve yüklü diğer uygulamalar
  const native = async () => {
    const p = page();
    try { await navigator.share({ title: p.title, text: p.text, url: p.url }); setOpen(false); } catch { /* vazgeçildi */ }
  };

  const row = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-2";
  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-[1100] sm:bottom-6 sm:right-6">
      {open && (
        <div role="menu" aria-label="Paylaş" className="absolute bottom-16 right-0 w-64 rounded-2xl border border-line bg-surface p-2 text-ink shadow-2xl">
          <p className="px-3 pb-1 pt-1 text-xs font-semibold text-muted">Bu sayfayı paylaş</p>
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" onClick={it.onClick} className={row}>
              <span className={`grid h-9 w-9 place-items-center rounded-full ${it.color}`}>{it.icon}</span> {it.label}
            </button>
          ))}
          {canNative && (
            <button type="button" role="menuitem" onClick={native} className={row}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2"><MoreHorizontal className="h-5 w-5" aria-hidden /></span> Diğer uygulamalar
            </button>
          )}
          <button type="button" role="menuitem" onClick={copy} className={row}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2">
              {copied ? <Check className="h-5 w-5 text-open" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />}
            </span>
            {copied ? "Kopyalandı!" : "Bağlantıyı kopyala"}
          </button>
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
        className="flex h-14 items-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-ink shadow-xl ring-1 ring-black/10 hover:opacity-95">
        {open ? <X className="h-5 w-5" aria-hidden /> : <Share2 className="h-5 w-5" aria-hidden />}
        <span>Paylaş</span>
      </button>
    </div>
  );
}
