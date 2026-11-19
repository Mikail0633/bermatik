"use client";

import { useActionState, useState } from "react";
import { replyReview, type PanelState } from "@/app/panel/actions";
import { FormError } from "@/components/forms";

// Yoruma cevap yaz / düzelt / kaldır
export function ReplyForm({ reviewId, shopId, current }: { reviewId: string; shopId: string; current: string | null }) {
  const [state, action, pending] = useActionState<PanelState, FormData>(replyReview.bind(null, reviewId, shopId), undefined);
  const [open, setOpen] = useState(!current);
  if (!open) {
    return (
      <div className="flex gap-3 text-sm">
        <button type="button" onClick={() => setOpen(true)} className="font-semibold underline">Cevabı düzelt</button>
        <form action={action}><input type="hidden" name="text" value="" />
          <button type="submit" disabled={pending} className="text-closed underline">Cevabı kaldır</button>
        </form>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <FormError message={state?.error} />
      {state?.ok && <p className="text-sm font-medium text-open">{state.ok}</p>}
      <textarea name="text" required minLength={2} maxLength={1000} rows={2} defaultValue={current ?? ""}
        placeholder="Müşterinize teşekkür edin ya da yorumuna kibarca cevap verin. Cevabınız dükkân sayfanızda herkese görünür."
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink disabled:opacity-50">
          {pending ? "Gönderiliyor…" : current ? "Cevabı kaydet" : "Cevap yaz"}
        </button>
        {current && <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm">Vazgeç</button>}
      </div>
    </form>
  );
}
