"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Images, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { placeOrder, productImages } from "@/app/magaza-actions";
import { tl } from "@/lib/types";

type Product = { Id: string; Name: string; Description: string | null; Price: number; Stock: number; CoverImagePath: string | null; ImageCount: number };

// Dükkân sayfasındaki ürünler: sepete ekle → sipariş ver → dükkân hazırlar → müşteri gelip öder ve alır
export function ShopStore({ shopId, products }: { shopId: string; products: Product[] }) {
  const path = usePathname();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [gallery, setGallery] = useState<{ name: string; paths: string[] } | null>(null);

  const set = (p: Product, n: number) => setCart((c) => {
    const next = { ...c };
    const q = Math.max(0, Math.min(n, p.Stock, 20));
    if (q === 0) delete next[p.Id]; else next[p.Id] = q;
    return next;
  });
  const lines = products.filter((p) => cart[p.Id]);
  const total = lines.reduce((s, p) => s + Number(p.Price) * cart[p.Id], 0);
  const order = () => start(async () => {
    setError(undefined);
    const r = await placeOrder(shopId, lines.map((p) => ({ productId: p.Id, quantity: cart[p.Id] })), note, path);
    if (r?.error) setError(r.error);
  });
  const openGallery = async (p: Product) => {
    const imgs = await productImages(p.Id);
    setGallery({ name: p.Name, paths: imgs.map((i) => i.Path) });
  };

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {products.map((p) => {
          const q = cart[p.Id] ?? 0;
          const out = p.Stock === 0;
          return (
            <li key={p.Id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              <button type="button" onClick={() => p.ImageCount > 0 && openGallery(p)} className="relative block aspect-square bg-surface-2" aria-label={`${p.Name} fotoğrafları`}>
                {p.CoverImagePath
                  // eslint-disable-next-line @next/next/no-img-element -- fotoğraflar yüklenirken zaten küçültülüyor
                  ? <img src={`/uploads/${p.CoverImagePath}`} alt={p.Name} loading="lazy" className="h-full w-full object-cover" />
                  : <ShoppingBag className="absolute inset-0 m-auto h-10 w-10 text-muted" aria-hidden />}
                {p.ImageCount > 1 && <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"><Images className="h-3 w-3" aria-hidden />{p.ImageCount}</span>}
              </button>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="font-semibold leading-tight">{p.Name}</p>
                {p.Description && <p className="line-clamp-2 text-xs text-muted">{p.Description}</p>}
                <p className="mt-auto font-bold">{tl(Number(p.Price))}</p>
                {out ? <p className="text-sm font-semibold text-closed">Tükendi</p> : q === 0 ? (
                  <button type="button" onClick={() => set(p, 1)} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-ink">Sepete ekle</button>
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-line">
                    <button type="button" onClick={() => set(p, q - 1)} className="p-2" aria-label="Azalt"><Minus className="h-4 w-4" /></button>
                    <span className="font-bold">{q}</span>
                    <button type="button" onClick={() => set(p, q + 1)} disabled={q >= p.Stock} className="p-2 disabled:opacity-30" aria-label="Artır"><Plus className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {lines.length > 0 && (
        <div className="space-y-3 rounded-2xl border-2 border-primary bg-surface p-4">
          <h3 className="flex items-center gap-2 font-bold"><ShoppingBag className="h-5 w-5" aria-hidden /> Sepetim</h3>
          <ul className="space-y-1 text-sm">
            {lines.map((p) => <li key={p.Id} className="flex justify-between gap-2"><span>{cart[p.Id]} x {p.Name}</span><span>{tl(Number(p.Price) * cart[p.Id])}</span></li>)}
          </ul>
          <p className="flex justify-between border-t border-line pt-2 font-bold"><span>Toplam</span><span>{tl(total)}</span></p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Dükkâna notunuz (isteğe bağlı)"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
          {error && <p className="text-sm font-medium text-closed">{error}</p>}
          <button type="button" onClick={order} disabled={pending} className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-ink disabled:opacity-50">
            {pending ? "Gönderiliyor…" : "Sipariş ver"}
          </button>
          <p className="text-center text-xs text-muted">Ödeme dükkânda yapılır. Dükkân siparişinizi hazırlayınca size haber verilir; gelip ödeyip alırsınız.</p>
        </div>
      )}

      {gallery && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-4" onClick={() => setGallery(null)}>
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-bold">{gallery.name}</p>
              <button type="button" onClick={() => setGallery(null)} className="rounded-lg p-1 hover:bg-surface-2" aria-label="Kapat"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- fotoğraflar yüklenirken zaten küçültülüyor */}
              {gallery.paths.map((p) => <img key={p} src={`/uploads/${p}`} alt={gallery.name} className="w-full rounded-xl" />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
