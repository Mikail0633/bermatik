"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadCertificate, type BelgeState } from "@/app/belge-actions";
import { FormError, SubmitButton } from "@/components/forms";

const input = "w-full rounded-xl border border-line bg-surface px-3 py-2.5";

export function CertificateForm({ types }: { types: [string, string][] }) {
  const [state, action] = useActionState<BelgeState, FormData>(uploadCertificate, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormError message={state?.error} />
        {state?.ok && <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{state.ok}</p>}
      </div>
      <label className="text-sm">
        <span className="mb-1 block font-semibold">Belge türü</span>
        <select name="type" required defaultValue="ustalik" className={input}>
          {types.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-semibold">Seri numarası</span>
        <input name="serialNo" required minLength={3} maxLength={50} placeholder="Belgenin üzerindeki numara" className={input} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-semibold">Veren kurum (isteğe bağlı)</span>
        <input name="issuedBy" maxLength={120} placeholder="Örn. MEB, Esnaf Odası" className={input} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-semibold">Belgenin fotoğrafı veya PDF (en fazla 8 MB)</span>
        <input type="file" name="file" required accept="image/jpeg,image/png,image/webp,application/pdf"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:font-semibold file:text-ink" />
      </label>
      <div className="sm:w-60"><SubmitButton>Belgeyi gönder</SubmitButton></div>
    </form>
  );
}
