"use client";

import { useActionState, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { addReview, cancelAppointment } from "../randevu-actions";
import { FormError, SubmitButton } from "@/components/forms";

export function CancelButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Randevu iptal edilsin mi?")) return;
          start(async () => {
            const r = await cancelAppointment(id);
            setMsg(r.error ?? null);
          });
        }}
        className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-closed hover:bg-surface-2 disabled:opacity-50"
      >
        İptal et
      </button>
      {msg && <p className="w-full text-sm text-closed">{msg}</p>}
    </>
  );
}

// Tamamlanan randevu için puan + yorum
export function ReviewForm({ appointmentId }: { appointmentId: string }) {
  const [state, action] = useActionState(addReview, undefined);
  const [rating, setRating] = useState(5);
  if (state?.ok) return <p className="mt-3 rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{state.ok}</p>;
  return (
    <form action={action} className="mt-3 space-y-2 rounded-xl bg-surface-2 p-3">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="rating" value={rating} />
      <p className="text-sm font-semibold">Hizmeti puanlayın</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Puan">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} yıldız`} aria-checked={rating === n} role="radio">
            <Star className={`h-7 w-7 ${n <= rating ? "fill-accent text-accent" : "text-line"}`} />
          </button>
        ))}
      </div>
      <textarea name="comment" rows={2} maxLength={1000} placeholder="Yorumunuz (isteğe bağlı)" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
      <FormError message={state?.error} />
      <div className="w-40"><SubmitButton>Gönder</SubmitButton></div>
    </form>
  );
}
