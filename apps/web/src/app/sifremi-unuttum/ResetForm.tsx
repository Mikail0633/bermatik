"use client";

import { useActionState } from "react";
import { requestCode, resetPassword, type ResetState } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { BotFields } from "@/components/BotFields";
import { PasswordField } from "@/components/PasswordField";

export function ResetForm() {
  const [req, askCode] = useActionState<ResetState, FormData>(requestCode, { step: "email" });
  const [res, reset] = useActionState<ResetState, FormData>(resetPassword, { step: "code" });

  if (req.step === "email") {
    return (
      <form action={askCode} className="space-y-4">
        <BotFields />
        <FormError message={req.error} />
        <Field label="E-posta" name="email" type="email" autoComplete="email" required defaultValue={req.email} />
        <SubmitButton>Kod gönder</SubmitButton>
      </form>
    );
  }

  const devCode = res.devCode ?? req.devCode;
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{req.ok}</p>
      {devCode && (
        <p className="rounded-xl border border-dashed border-accent px-3 py-2 text-sm">
          Geliştirme modu (e-posta servisi bağlı değil): kodunuz <b className="font-mono text-base tracking-widest">{devCode}</b>
        </p>
      )}
      <FormError message={res.error} />
      <form action={reset} className="space-y-4">
        <input type="hidden" name="email" value={req.email} />
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">6 haneli kod</span>
          <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456"
            className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-center font-mono text-2xl tracking-[0.5em]" />
        </label>
        <PasswordField label="Yeni şifre" />
        <SubmitButton>Şifremi yenile</SubmitButton>
      </form>
      <form action={askCode} className="text-center text-sm text-muted">
        <BotFields />
        <input type="hidden" name="email" value={req.email} />
        Kod gelmedi mi? Gereksiz (spam) klasörüne bakın ya da{" "}
        <button type="submit" className="font-semibold text-ink underline">yeni kod isteyin</button>.
        <span className="mt-1 block text-xs">Güvenlik için saatte en fazla 3 kod gönderilir; yine gelmezse 1 saat sonra tekrar deneyin.</span>
      </form>
    </div>
  );
}
