"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

// Formlarda ortak parçalar: etiketli alan, hata kutusu, gönder butonu

export function Field({
  label, name, type = "text", defaultValue, autoComplete, required, hint, inputMode, placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        required={required}
        inputMode={inputMode}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-ink placeholder:text-muted/70"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-closed/10 px-3 py-2 text-sm font-medium text-closed">
      {message}
    </p>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-ink hover:opacity-90 disabled:opacity-70"
    >
      {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
