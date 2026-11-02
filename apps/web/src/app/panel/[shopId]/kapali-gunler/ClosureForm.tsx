"use client";

import { useActionState } from "react";
import { addClosure, type PanelState } from "@/app/panel/actions";
import { FormError, SubmitButton } from "@/components/forms";

export function ClosureForm({ shopId }: { shopId: string }) {
  const [state, action] = useActionState<PanelState, FormData>(addClosure, undefined);
  const input = "w-full rounded-lg border border-line px-3 py-2";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="shopId" value={shopId} />
      <div className="sm:col-span-4"><FormError message={state?.error} />{state?.ok && <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{state.ok}</p>}</div>
      <label className="text-sm"><span className="mb-1 block font-semibold">Başlangıç</span><input type="date" name="startDate" required className={input} /></label>
      <label className="text-sm"><span className="mb-1 block font-semibold">Bitiş</span><input type="date" name="endDate" className={input} /></label>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-semibold">Neden</span><input name="reason" placeholder="Örn. Bayram tatili" className={input} /></label>
      <div className="sm:col-span-2"><SubmitButton>Ekle</SubmitButton></div>
    </form>
  );
}
