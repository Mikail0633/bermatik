"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { createSuggestion, type TalepState } from "../talep-actions";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { BotFields } from "@/components/BotFields";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-[340px] animate-pulse rounded-2xl bg-surface-2" />,
});

export function SuggestionForm() {
  const [state, action] = useActionState<TalepState, FormData>(createSuggestion, undefined);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  if (state?.ok) return <p className="rounded-xl bg-open/10 px-4 py-3 font-medium text-open">{state.ok}</p>;
  return (
    <form action={action} className="space-y-4">
      <BotFields />
      <input type="hidden" name="lat" value={pos?.lat ?? ""} />
      <input type="hidden" name="lng" value={pos?.lng ?? ""} />
      <FormError message={state?.error} />
      <fieldset className="flex gap-2">
        <legend className="mb-1 text-sm font-semibold">Ne tür dükkân?</legend>
        {(["erkek", "kadin"] as const).map((s) => (
          <label key={s} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-4 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-surface-2">
            <input type="radio" name="segment" value={s} defaultChecked={s === "erkek"} /> {s === "erkek" ? "Erkek berberi" : "Kadın kuaförü"}
          </label>
        ))}
      </fieldset>
      <Field label="Dükkânın adı" name="name" required />
      <Field label="Telefonu (biliyorsanız)" name="phone" type="tel" />
      <div>
        <span className="mb-1 block text-sm font-semibold">Yeri</span>
        <LocationPicker value={pos} onChange={(lat, lng) => setPos({ lat, lng })} />
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Not <span className="font-normal text-muted">(isteğe bağlı)</span></span>
        <textarea name="note" rows={2} maxLength={500} placeholder="Örn. caminin karşısında, 2. kat" className="w-full rounded-xl border border-line px-3 py-2.5" />
      </label>
      <SubmitButton>Bildir</SubmitButton>
    </form>
  );
}
