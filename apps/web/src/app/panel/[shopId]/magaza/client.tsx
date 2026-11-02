"use client";

import { useActionState, useEffect, useRef } from "react";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { addProductImage, removeProductImage, saveProduct, setProductCover, type MagazaState } from "@/app/magaza-actions";
import { ActionButton } from "@/components/ActionButton";
import { FormError } from "@/components/forms";

const input = "w-full rounded-lg border border-line bg-surface px-3 py-2";
const Ok = ({ s }: { s: MagazaState }) => (s?.ok ? <p className="rounded-lg bg-open/10 px-3 py-1.5 text-sm font-medium text-open">{s.ok}</p> : null);

type Initial = { Id: string; Name: string; Description: string | null; Price: number; Stock: number; IsActive: boolean };

export function ProductForm({ shopId, initial }: { shopId: string; initial?: Initial }) {
  const [state, action, pending] = useActionState<MagazaState, FormData>(saveProduct, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && !initial) ref.current?.reset(); }, [state, initial]);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="shopId" value={shopId} />
      {initial && <input type="hidden" name="productId" value={initial.Id} />}
      <div className="sm:col-span-2"><FormError message={state?.error} /><Ok s={state} /></div>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-semibold">Ürün adı</span>
        <input name="name" required maxLength={100} defaultValue={initial?.Name} placeholder="Örn. Sakal yağı 50 ml" className={input} /></label>
      <label className="text-sm"><span className="mb-1 block font-semibold">Fiyat (₺)</span>
        <input name="price" required inputMode="decimal" defaultValue={initial ? String(initial.Price) : ""} placeholder="250" className={input} /></label>
      <label className="text-sm"><span className="mb-1 block font-semibold">Stok (adet)</span>
        <input name="stock" required inputMode="numeric" defaultValue={initial ? String(initial.Stock) : ""} placeholder="10" className={input} /></label>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-semibold">Açıklama (isteğe bağlı)</span>
        <textarea name="description" maxLength={1000} rows={2} defaultValue={initial?.Description ?? ""} className={input} /></label>
      {initial && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="isActive" value="off" defaultChecked={!initial.IsActive} /> Satıştan kaldır (müşteriler görmez)
        </label>
      )}
      <div className="sm:w-60">
        <button disabled={pending} className="w-full rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-ink disabled:opacity-50">
          {pending ? "Kaydediliyor…" : initial ? "Kaydet" : "Ürünü ekle"}
        </button>
      </div>
    </form>
  );
}

// En fazla 8 fotoğraf; yıldızlı olan vitrin fotoğrafıdır (listede o görünür)
export function ProductPhotos({ productId, images }: { productId: string; images: { Id: string; Path: string; IsCover: boolean }[] }) {
  const [state, action, pending] = useActionState<MagazaState, FormData>(addProductImage, undefined);
  const form = useRef<HTMLFormElement>(null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {images.map((img) => (
          <div key={img.Id} className={`relative h-24 w-24 overflow-hidden rounded-xl border-2 ${img.IsCover ? "border-accent" : "border-line"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- fotoğraflar yüklenirken zaten küçültülüyor */}
            <img src={`/uploads/${img.Path}`} alt="" className="h-full w-full object-cover" />
            {img.IsCover && <span className="absolute left-1 top-1 rounded bg-accent px-1 text-[10px] font-bold text-accent-ink">VİTRİN</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-0.5">
              {!img.IsCover
                ? <ActionButton className="p-1! text-white!" action={setProductCover.bind(null, img.Id)}><Star className="h-4 w-4" aria-label="Vitrin yap" /></ActionButton>
                : <span />}
              <ActionButton className="p-1! text-white!" confirm="Fotoğraf silinsin mi?" action={removeProductImage.bind(null, img.Id)}><Trash2 className="h-4 w-4" aria-label="Sil" /></ActionButton>
            </div>
          </div>
        ))}
        {images.length < 8 && (
          <form ref={form} action={action}>
            <input type="hidden" name="productId" value={productId} />
            <label className={`grid h-24 w-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-center text-xs text-muted hover:bg-surface-2 ${pending ? "pointer-events-none opacity-50" : ""}`}>
              <span><ImagePlus className="mx-auto mb-1 h-6 w-6" aria-hidden />{pending ? "Yükleniyor…" : `Fotoğraf ekle (${images.length}/8)`}</span>
              <input type="file" name="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={() => form.current?.requestSubmit()} />
            </label>
          </form>
        )}
      </div>
      <FormError message={state?.error} />
    </div>
  );
}
