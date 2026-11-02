"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type FormState } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { BotFields } from "@/components/BotFields";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <BotFields />
      <input type="hidden" name="sonra" value={next} />
      <FormError message={state?.error} />
      <Field label="E-posta" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      <Field label="Şifre" name="password" type="password" autoComplete="current-password" required />
      <div className="text-right">
        <Link href="/sifremi-unuttum" className="text-sm font-medium text-muted underline hover:text-ink">
          Şifremi unuttum
        </Link>
      </div>
      <SubmitButton>Giriş yap</SubmitButton>
    </form>
  );
}
