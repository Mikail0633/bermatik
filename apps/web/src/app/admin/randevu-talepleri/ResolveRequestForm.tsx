"use client";

import { useActionState } from "react";
import { resolveRequest, type RequestState } from "@/app/talep-randevu-actions";
import { FormError } from "@/components/forms";

// Dükkânla görüştükten sonra: kesin saatle onayla ya da nedeniyle reddet
export function ResolveRequestForm({ id, preferred }: { id: string; preferred: string }) {
  const [state, action, pending] = useActionState<RequestState, FormData>(resolveRequest, undefined);
  if (state?.ok) return <p className="mt-3 rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{state.ok}</p>;
  const input = "rounded-lg border border-line bg-surface px-3 py-2 text-sm";
  return (
    <form action={action} className="mt-3 space-y-2 border-t border-line pt-3">
      <input type="hidden" name="requestId" value={id} />
      <FormError message={state?.error} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm"><span className="mb-1 block font-semibold">Kesin saat</span>
          <input type="datetime-local" name="at" defaultValue={preferred} step={300} className={input} /></label>
        <label className="min-w-48 flex-1 text-sm"><span className="mb-1 block font-semibold">Müşteriye not (isteğe bağlı)</span>
          <input name="note" maxLength={300} placeholder="Örn. Mehmet Usta sizi bekliyor" className={`${input} w-full`} /></label>
      </div>
      <div className="flex gap-2">
        <button name="status" value="confirmed" disabled={pending} className="rounded-lg bg-open px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Onayla</button>
        <button name="status" value="rejected" disabled={pending} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-closed disabled:opacity-50">Reddet</button>
      </div>
    </form>
  );
}
