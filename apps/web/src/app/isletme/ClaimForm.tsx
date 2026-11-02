"use client";

import { useActionState } from "react";
import { createClaim, type TalepState } from "../talep-actions";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { DocumentFields } from "@/components/DocumentUpload";

export function ClaimForm({ shopId, phone }: { shopId: string; phone: string | null }) {
  const [state, action] = useActionState<TalepState, FormData>(createClaim, undefined);
  if (state?.ok) return <p className="rounded-xl bg-open/10 px-4 py-3 font-medium text-open">{state.ok}</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="shopId" value={shopId} />
      <FormError message={state?.error} />
      <Field label="Size ulaşabileceğimiz telefon" name="phone" type="tel" required defaultValue={phone ?? ""} hint="Gerekirse sizi bu numaradan arayacağız." />
      <div>
        <p className="mb-2 text-sm font-semibold">Sahiplik belgesi</p>
        <DocumentFields />
        <p className="mt-1 text-xs text-muted">Belgedeki işletme adı ve adresi bu dükkânla eşleşmeli. Belgenizi yalnızca Bermatik ekibi görür.</p>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Not <span className="font-normal text-muted">(isteğe bağlı)</span></span>
        <textarea name="note" rows={3} maxLength={500} placeholder="Örn. 10 yıldır bu dükkânı işletiyorum, vergi levham üzerimde." className="w-full rounded-xl border border-line px-3 py-2.5" />
      </label>
      <SubmitButton>Sahiplenme talebi gönder</SubmitButton>
    </form>
  );
}
