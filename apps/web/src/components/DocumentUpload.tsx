"use client";

import { useActionState, useState } from "react";
import { uploadAccountDocument, uploadShopDocument, type BelgeState } from "@/app/belge-actions";
import { FormError, SubmitButton } from "@/components/forms";

export const DOC_KINDS = [
  ["vergi_levhasi", "Vergi levhası"],
  ["esnaf_kaydi", "Esnaf odası kaydı"],
  ["ruhsat", "İşyeri açma ruhsatı"],
  ["kimlik", "Kimlik kartı (ön yüz)"],
  ["diger", "Diğer"],
] as const;

// Belge türüne göre numara alanı
const NUMBER_FIELD: Record<string, { label: string; hint: string; numeric: boolean; max: number }> = {
  kimlik: { label: "T.C. kimlik numarası", hint: "Ad, soyad ve doğum yılınızla birlikte nüfus kayıtlarından kontrol edilir.", numeric: true, max: 11 },
  vergi_levhasi: { label: "Vergi numarası", hint: "Şirketlerde 10 hane; şahıs işletmelerinde levhadaki 11 haneli T.C. numarası.", numeric: true, max: 11 },
  esnaf_kaydi: { label: "Esnaf sicil numarası", hint: "Esnaf odası kaydındaki sicil numarası.", numeric: false, max: 30 },
  ruhsat: { label: "Ruhsat numarası", hint: "İşyeri açma ve çalışma ruhsatındaki numara.", numeric: false, max: 30 },
  diger: { label: "Belge numarası", hint: "Belgenin üzerindeki numara.", numeric: false, max: 30 },
};

// Belge türü + numara + dosya (kayıt ekranında, sahiplenmede ve panelde kullanılır).
// askBirthYear: hesapta doğum yılı yoksa kimlik doğrulaması için sorulur.
export function DocumentFields({ defaultKind = "vergi_levhasi", askBirthYear = false }: { defaultKind?: string; askBirthYear?: boolean }) {
  const [kind, setKind] = useState(defaultKind);
  const nf = NUMBER_FIELD[kind] ?? NUMBER_FIELD.diger;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block font-semibold">Belge türü</span>
        <select name="kind" required value={kind} onChange={(e) => setKind(e.target.value)} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5">
          {DOC_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-semibold">{nf.label}</span>
        <input name="docNumber" required maxLength={nf.max + 6} inputMode={nf.numeric ? "numeric" : "text"} autoComplete="off"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5" />
        <span className="mt-1 block text-xs text-muted">{nf.hint}</span>
      </label>
      {askBirthYear && kind === "kimlik" && (
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Doğum yılı</span>
          <input name="birthYear" required inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="1995" className="w-full rounded-xl border border-line bg-surface px-3 py-2.5" />
        </label>
      )}
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-semibold">Belgenin fotoğrafı veya PDF (en fazla 8 MB)</span>
        <input type="file" name="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:font-semibold file:text-ink" />
      </label>
    </div>
  );
}

// Bekleyen dükkân başvurusuna belge ekleme
export function ShopDocumentUpload({ shopId }: { shopId: string }) {
  const [state, action] = useActionState<BelgeState, FormData>(uploadShopDocument, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="shopId" value={shopId} />
      <FormError message={state?.error} />
      {state?.ok && <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{state.ok}</p>}
      <DocumentFields />
      <div className="sm:w-60"><SubmitButton>Belgeyi yükle</SubmitButton></div>
    </form>
  );
}

// İşletme hesabına belge (kayıtta yüklenmediyse ya da reddedildiyse)
export function AccountDocumentUpload({ askBirthYear = false }: { askBirthYear?: boolean }) {
  const [state, action] = useActionState<BelgeState, FormData>(uploadAccountDocument, undefined);
  if (state?.ok) return <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{state.ok}</p>;
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <DocumentFields defaultKind="kimlik" askBirthYear={askBirthYear} />
      <SubmitButton>Belgeyi yükle</SubmitButton>
    </form>
  );
}
