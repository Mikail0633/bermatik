"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveService, type PanelState } from "@/app/panel/actions";
import { FormError, SubmitButton } from "@/components/forms";

type Category = { Id: number; Name: string; Description: string | null };
type Initial = { Id: string; CategoryId: number; Name: string; OwnDescription: string | null; Price: number; DurationMinutes: number; IsActive: boolean; SortOrder: number };

export function ServiceForm({ shopId, categories, initial }: { shopId: string; categories: Category[]; initial?: Initial }) {
  const [state, action] = useActionState<PanelState, FormData>(saveService, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const [cat, setCat] = useState(initial?.CategoryId ?? categories[0]?.Id);
  const [name, setName] = useState(initial?.Name ?? categories[0]?.Name ?? "");
  useEffect(() => { if (state?.ok && !initial) { ref.current?.reset(); setName(categories[0]?.Name ?? ""); setCat(categories[0]?.Id); } }, [state, initial, categories]);
  const hint = categories.find((c) => c.Id === cat)?.Description;
  const input = "w-full rounded-lg border border-line bg-surface px-3 py-2";
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="shopId" value={shopId} />
      {initial && <input type="hidden" name="serviceId" value={initial.Id} />}
      <div className="sm:col-span-4">
        <FormError message={state?.error} />
        {state?.ok && <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{state.ok}</p>}
      </div>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-semibold">Kategori</span>
        <select name="categoryId" value={cat} onChange={(e) => {
          const c = categories.find((x) => x.Id === Number(e.target.value));
          setCat(Number(e.target.value));
          if (c && (!initial || name === categories.find((x) => x.Id === cat)?.Name)) setName(c.Name);
        }} className={input}>
          {categories.map((c) => <option key={c.Id} value={c.Id}>{c.Name}</option>)}
        </select></label>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-semibold">Hizmet adı</span>
        <input name="name" required value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
      <label className="text-sm"><span className="mb-1 block font-semibold">Fiyat (TL)</span>
        <input name="price" required inputMode="decimal" defaultValue={initial ? Number(initial.Price) : ""} className={input} /></label>
      <label className="text-sm"><span className="mb-1 block font-semibold">Süre (dk)</span>
        <input name="duration" type="number" min={5} max={600} step={5} required defaultValue={initial?.DurationMinutes ?? 30} className={input} /></label>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-semibold">Durum</span>
        <select name="isActive" defaultValue={initial?.IsActive === false ? "off" : "on"} className={input}>
          <option value="on">Sitede göster</option><option value="off">Gizle (pasif)</option>
        </select></label>
      <label className="text-sm sm:col-span-4"><span className="mb-1 block font-semibold">Açıklama <span className="font-normal text-muted">(isteğe bağlı)</span></span>
        <input name="description" defaultValue={initial?.OwnDescription ?? ""} placeholder={hint ?? ""} className={input} /></label>
      <div className="sm:col-span-2"><SubmitButton>{initial ? "Kaydet" : "Hizmeti ekle"}</SubmitButton></div>
    </form>
  );
}
