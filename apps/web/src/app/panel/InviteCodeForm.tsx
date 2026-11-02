"use client";

import { useActionState } from "react";
import { claimInvite, type PanelState } from "./actions";
import { FormError, SubmitButton } from "@/components/forms";

export function InviteCodeForm() {
  const [state, action] = useActionState<PanelState, FormData>(claimInvite, undefined);
  return (
    <form action={action} className="space-y-2">
      <FormError message={state?.error} />
      <input name="code" required placeholder="Örn. 3F9A1C7B2D4E" className="w-full rounded-xl border border-line px-3 py-2.5 uppercase tracking-widest" />
      <SubmitButton>Katıl</SubmitButton>
    </form>
  );
}
