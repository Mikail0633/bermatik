"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Result = { error?: string; ok?: string } | undefined;

// Bir sunucu işlemini çağıran düğme (isteğe bağlı onay sorusu), sonra sayfayı yeniler
export function ActionButton({
  action, children, confirm, className = "", variant = "default",
}: {
  action: () => Promise<Result>;
  children: React.ReactNode;
  confirm?: string;
  className?: string;
  variant?: "default" | "primary" | "danger" | "success";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const styles = {
    default: "border border-line hover:bg-surface-2",
    primary: "bg-primary text-primary-ink hover:opacity-90",
    danger: "border border-line text-closed hover:bg-surface-2",
    success: "bg-open text-white hover:opacity-90",
  };
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await action();
            setError(r?.error ?? null);
            if (!r?.error) router.refresh();
          });
        }}
        className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${styles[variant]} ${className}`}
      >
        {children}
      </button>
      {error && <span className="mt-1 text-xs text-closed">{error}</span>}
    </span>
  );
}
