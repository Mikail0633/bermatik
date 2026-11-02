"use client";

import { useActionState, useEffect, useRef } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { addGalleryPhoto, removeGalleryPhoto, setShopCover, setStaffPhoto, type FotoState } from "@/app/foto-actions";
import { FormError } from "@/components/forms";

const ACCEPT = "image/jpeg,image/png,image/webp";
const Ok = ({ state }: { state: FotoState }) => (state?.ok ? <p className="text-sm font-medium text-open">{state.ok}</p> : null);

// Tek fotoğraf (kapak veya personel): seçince kendiliğinden yüklenir
function SinglePhoto({
  action, hidden, current, round, label,
}: {
  action: (s: FotoState, f: FormData) => Promise<FotoState>;
  hidden: Record<string, string>;
  current: string | null;
  round?: boolean;
  label: string;
}) {
  const [state, run, pending] = useActionState<FotoState, FormData>(action, undefined);
  const form = useRef<HTMLFormElement>(null);
  const size = round ? "h-24 w-24 rounded-full" : "aspect-[16/9] w-full max-w-md rounded-2xl";
  return (
    <div className="space-y-2">
      <div className={`${size} relative overflow-hidden border border-line bg-surface-2`}>
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element -- fotoğraflar yüklenirken zaten küçültülüyor
          <img src={`/uploads/${current}`} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-muted"><Camera className="h-8 w-8" aria-hidden /></span>
        )}
        {pending && <span className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-semibold text-white">Yükleniyor…</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <form ref={form} action={run}>
          {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2 ${pending ? "pointer-events-none opacity-50" : ""}`}>
            <ImagePlus className="h-4 w-4" aria-hidden /> {current ? "Değiştir" : label}
            <input type="file" name="file" accept={ACCEPT} className="sr-only" onChange={() => form.current?.requestSubmit()} />
          </label>
        </form>
        {current && (
          <form action={run}>
            {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input type="hidden" name="remove" value="1" />
            <button disabled={pending} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-closed hover:bg-closed/10 disabled:opacity-50">
              <Trash2 className="h-4 w-4" aria-hidden /> Kaldır
            </button>
          </form>
        )}
      </div>
      <FormError message={state?.error} />
      <Ok state={state} />
    </div>
  );
}

export function CoverPhotoUpload({ shopId, current }: { shopId: string; current: string | null }) {
  return <SinglePhoto action={setShopCover} hidden={{ shopId }} current={current} label="Kapak fotoğrafı yükle" />;
}

export function StaffPhotoUpload({ staffId, current }: { staffId: string; current: string | null }) {
  return <SinglePhoto action={setStaffPhoto} hidden={{ staffId }} current={current} round label="Fotoğraf yükle" />;
}

export type GalleryPhoto = { Id: string; Path: string; Caption: string | null; StaffId: string | null; StaffName: string | null; IsHidden: boolean };

// Galeri: fotoğraf + açıklama ekle; sahip/admin hangi personelin işi olduğunu seçebilir
export function GalleryUpload({ shopId, staff }: { shopId: string; staff?: { Id: string; DisplayName: string }[] }) {
  const [state, run, pending] = useActionState<FotoState, FormData>(addGalleryPhoto, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={run} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="shopId" value={shopId} />
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-semibold">Fotoğraf (JPG, PNG veya WEBP, en fazla 8 MB)</span>
        <input type="file" name="file" required accept={ACCEPT} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:font-semibold file:text-ink" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-semibold">Açıklama (isteğe bağlı)</span>
        <input name="caption" maxLength={150} placeholder="Örn. Skin fade, gelin başı…" className="w-full rounded-lg border border-line bg-surface px-3 py-2" />
      </label>
      {staff && staff.length > 0 && (
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Kimin işi?</span>
          <select name="staffId" defaultValue="" className="w-full rounded-lg border border-line bg-surface px-3 py-2">
            <option value="">Dükkân (genel)</option>
            {staff.map((s) => <option key={s.Id} value={s.Id}>{s.DisplayName}</option>)}
          </select>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-ink disabled:opacity-50">
          <ImagePlus className="h-4 w-4" aria-hidden /> {pending ? "Yükleniyor…" : "Galeriye ekle"}
        </button>
        <FormError message={state?.error} />
        <Ok state={state} />
      </div>
    </form>
  );
}

export function GalleryGrid({ photos }: { photos: (GalleryPhoto & { CanRemove: boolean })[] }) {
  if (photos.length === 0) return <p className="text-sm text-muted">Henüz fotoğraf yok.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((p) => (
        <li key={p.Id} className="overflow-hidden rounded-xl border border-line bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element -- fotoğraflar yüklenirken zaten küçültülüyor */}
          <img src={`/uploads/${p.Path}`} alt={p.Caption ?? ""} loading="lazy" className="aspect-square w-full object-cover" />
          <div className="space-y-1 p-2 text-xs">
            {p.Caption && <p className="font-medium">{p.Caption}</p>}
            <p className="text-muted">{p.StaffName ?? "Dükkân"}{p.IsHidden && " · Bermatik tarafından gizlendi"}</p>
            {p.CanRemove && (
              <form action={removeGalleryPhoto}>
                <input type="hidden" name="photoId" value={p.Id} />
                <button className="inline-flex items-center gap-1 text-closed hover:underline"><Trash2 className="h-3.5 w-3.5" aria-hidden /> Sil</button>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
