"use client";

import { useActionState } from "react";
import { unsubscribe, type RetState } from "./actions";
import { FormError, SubmitButton } from "@/components/forms";

export function UnsubscribeButton({ u, k, i, kanal }: { u: string; k: string; i: string; kanal: string }) {
  const [state, action] = useActionState<RetState, FormData>(unsubscribe, undefined);
  if (state?.ok) return <p className="rounded-xl bg-open/10 px-3 py-2 font-medium text-open">{state.ok}</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="u" value={u} />
      <input type="hidden" name="k" value={k} />
      <input type="hidden" name="i" value={i} />
      <FormError message={state?.error} />
      <p className="text-sm text-muted">Randevu onayı, hatırlatma ve şifre gibi bilgilendirme {kanal}ları gelmeye devam eder.</p>
      <SubmitButton>İletiden çık</SubmitButton>
    </form>
  );
}
