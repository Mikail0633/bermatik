"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { sendCode, verifyCode, type DogrulaState } from "./actions";
import { FormError, SubmitButton } from "@/components/forms";

export function VerifyForm({ next }: { next: string }) {
  const [sent, setSent] = useState<DogrulaState>();
  const [state, action] = useActionState<DogrulaState, FormData>(verifyCode, undefined);
  const [pending, start] = useTransition();
  const first = useRef(false);
  const send = (auto = false) => start(async () => setSent(await sendCode(auto)));
  // Sayfa açılınca ilk kod kendiliğinden gönderilir
  useEffect(() => { if (!first.current) { first.current = true; send(true); } }, []);

  return (
    <div className="space-y-4">
      {sent?.ok && <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{sent.ok}</p>}
      {sent?.devCode && (
        <p className="rounded-xl border border-dashed border-accent px-3 py-2 text-sm">
          Geliştirme modu (e-posta servisi henüz bağlı değil): kodunuz <b className="font-mono text-base tracking-widest">{sent.devCode}</b>
        </p>
      )}
      <FormError message={sent?.error ?? state?.error} />
      <form action={action} className="space-y-3">
        <input type="hidden" name="sonra" value={next} />
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">6 haneli kod</span>
          <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456"
            className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-center font-mono text-2xl tracking-[0.5em]" />
        </label>
        <SubmitButton>Doğrula</SubmitButton>
      </form>
      <p className="text-center text-sm text-muted">
        Kod gelmedi mi? Gereksiz (spam) klasörüne bakın ya da{" "}
        <button type="button" onClick={() => send()} disabled={pending} className="font-semibold text-ink underline disabled:opacity-50">yeni kod isteyin</button>.
      </p>
    </div>
  );
}
