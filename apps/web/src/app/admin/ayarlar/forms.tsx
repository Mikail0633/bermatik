"use client";

import { useActionState } from "react";
import { saveCategory, saveTemplate, type AdminState } from "../actions";
import { FormError, SubmitButton } from "@/components/forms";

const input = "w-full rounded-lg border border-line bg-surface px-3 py-2";
const Ok = ({ s }: { s: AdminState }) => (s?.ok ? <p className="rounded-lg bg-open/10 px-3 py-1.5 text-sm font-medium text-open">{s.ok}</p> : null);

type Cat = { Id: number; Slug: string; Name: string; Description: string | null; SortOrder: number; IsActive: boolean; RevisitDays: number | null };

export function CategoryForm({ segment, initial }: { segment: "erkek" | "kadin"; initial?: Cat }) {
  const [state, action] = useActionState<AdminState, FormData>(saveCategory, undefined);
  return (
    <form action={action} className="grid gap-3 text-sm sm:grid-cols-4">
      <input type="hidden" name="segment" value={segment} />
      {initial && <input type="hidden" name="categoryId" value={initial.Id} />}
      <div className="sm:col-span-4"><FormError message={state?.error} /><Ok s={state} /></div>
      <label className="sm:col-span-2"><span className="mb-1 block font-semibold">Adı</span><input name="name" required defaultValue={initial?.Name} className={input} /></label>
      <label className="sm:col-span-2"><span className="mb-1 block font-semibold">Adres adı</span>
        <input name="slug" required pattern="[a-z0-9-]+" defaultValue={initial?.Slug} placeholder="sac-kesimi" className={input} title="Küçük harf, rakam ve tire" /></label>
      <label className="sm:col-span-4"><span className="mb-1 block font-semibold">Açıklama</span>
        <textarea name="description" rows={2} defaultValue={initial?.Description ?? ""} className={input} /></label>
      <label><span className="mb-1 block font-semibold">Tekrar gelme (gün)</span><input name="revisitDays" type="number" min={1} max={365} defaultValue={initial?.RevisitDays ?? ""} className={input} /></label>
      <label><span className="mb-1 block font-semibold">Sıra</span><input name="sortOrder" type="number" defaultValue={initial?.SortOrder ?? 0} className={input} /></label>
      <label className="flex items-end gap-2 pb-2 sm:col-span-2"><input type="checkbox" name="isActive" defaultChecked={initial?.IsActive ?? true} /> Etkin</label>
      <div className="sm:col-span-2"><SubmitButton>Kaydet</SubmitButton></div>
    </form>
  );
}

type Tpl = { Id: number; Title: string; Body: string; IsActive: boolean; Segment?: "erkek" | "kadin" | null };

export function TemplateForm({ initial }: { initial?: Tpl }) {
  const [state, action] = useActionState<AdminState, FormData>(saveTemplate, undefined);
  return (
    <form action={action} className="grid gap-3 text-sm sm:grid-cols-4">
      {initial && <input type="hidden" name="templateId" value={initial.Id} />}
      <div className="sm:col-span-4"><FormError message={state?.error} /><Ok s={state} /></div>
      <label className="sm:col-span-1"><span className="mb-1 block font-semibold">Başlık</span><input name="title" required maxLength={80} defaultValue={initial?.Title} className={input} /></label>
      <label className="sm:col-span-3"><span className="mb-1 block font-semibold">Mesaj</span><input name="body" required maxLength={300} defaultValue={initial?.Body} className={input} /></label>
      <label><span className="mb-1 block font-semibold">Bölüm</span>
        <select name="segment" defaultValue={initial?.Segment ?? ""} className={input}>
          <option value="">İkisi (erkek ve kadın)</option><option value="erkek">Yalnız erkek berberleri</option><option value="kadin">Yalnız kadın kuaförleri</option>
        </select></label>
      <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={initial?.IsActive ?? true} /> Etkin</label>
      <div className="sm:col-span-2"><SubmitButton>Kaydet</SubmitButton></div>
    </form>
  );
}
