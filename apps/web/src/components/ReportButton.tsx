"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { Flag } from "lucide-react";
import { reportContent, type HesapState } from "@/app/hesap-actions";
import { FormError } from "@/components/forms";
import { BotFields } from "@/components/BotFields";

const REASONS = [
  ["uygunsuz", "Hakaret / uygunsuz içerik"],
  ["sahte", "Sahte veya yanlış bilgi"],
  ["dolandiricilik", "Dolandırıcılık"],
  ["spam", "Reklam / spam"],
  ["diger", "Diğer"],
] as const;

// "Bildir" bağlantısı: tıklayınca küçük bir şikayet formu açılır
export function ReportButton({ targetType, targetId, loggedIn, label = "Bildir" }: {
  targetType: "shop" | "review" | "photo"; targetId: string; loggedIn: boolean; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<HesapState, FormData>(reportContent, undefined);
  const path = usePathname();
  const trigger = "inline-flex items-center gap-1 text-xs text-muted underline-offset-2 hover:text-ink hover:underline";
  if (!loggedIn) {
    return <Link href={`/giris?sonra=${encodeURIComponent(path)}`} className={trigger}><Flag className="h-3.5 w-3.5" aria-hidden /> {label}</Link>;
  }
  if (state?.ok) return <span className="text-xs font-medium text-open">{state.ok}</span>;
  return (
    <span className="inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className={trigger} aria-expanded={open}>
        <Flag className="h-3.5 w-3.5" aria-hidden /> {label}
      </button>
      {open && (
        <form action={action} className="mt-2 w-72 max-w-full space-y-2 rounded-xl border border-line bg-surface p-3 text-sm shadow-lg">
      <BotFields />
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <FormError message={state?.error} />
          <select name="reason" required defaultValue="" className="w-full rounded-lg border border-line bg-surface px-2 py-2">
            <option value="" disabled>Neden bildiriyorsunuz?</option>
            {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <textarea name="note" rows={2} maxLength={500} placeholder="Açıklama (isteğe bağlı)" className="w-full rounded-lg border border-line px-2 py-1.5" />
          <div className="flex gap-2">
            <button disabled={pending} className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-ink disabled:opacity-50">Gönder</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-3 py-1.5">Vazgeç</button>
          </div>
        </form>
      )}
    </span>
  );
}
