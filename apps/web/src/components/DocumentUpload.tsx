"use client";

import { useActionState } from "react";
import { uploadShopDocument, type BelgeState } from "@/app/belge-actions";
import { FormError, SubmitButton } from "@/components/forms";

export const DOC_KINDS = [
  ["vergi_levhasi", "Vergi levhası"],
  ["esnaf_kaydi", "Esnaf odası kaydı"],
  ["diger", "Diğer (işletme ruhsatı vb.)"],
] as const;

// Dosya seçme alanları (sahiplenme formunda da kullanılır)
export function DocumentFields() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block font-semibold">Belge türü</span>
        <select name="kind" required defaultValue="vergi_levhasi" className="w-full rounded-xl border border-line bg-surface px-3 py-2.5">
          {DOC_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-semibold">Fotoğraf veya PDF (en fazla 8 MB)</span>
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
