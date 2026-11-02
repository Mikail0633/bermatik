"use client";

import { useActionState, useState, useTransition } from "react";
import { assignOwner, deleteShop, markReviewed, saveHours, setSegment, setStatus, type ActionState } from "@/app/admin/dukkanlar/actions";
import { FormError, SubmitButton } from "@/components/forms";

function Result({ r }: { r: ActionState }) {
  if (!r) return null;
  return r.error ? <FormError message={r.error} /> : r.ok ? <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{r.ok}</p> : null;
}

// Durum, bölüm, kontrol, silme düğmeleri
export function ShopQuickActions({ shopId, status, segment, needsReview }: { shopId: string; status: string; segment: "erkek" | "kadin"; needsReview: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState>();
  const act = (fn: () => Promise<ActionState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => setResult(await fn()));
  };
  const btn = "rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50";
  return (
    <div className="space-y-3">
      <Result r={result} />
      <div className="flex flex-wrap gap-2">
        {status !== "approved" && <button disabled={pending} className={`${btn} bg-open/10`} onClick={() => act(() => setStatus(shopId, "approved"))}>Onayla / yayına al</button>}
        {status === "approved" && <button disabled={pending} className={btn} onClick={() => act(() => setStatus(shopId, "suspended", "Admin tarafından askıya alındı"), "Dükkân siteden kaldırılsın mı?")}>Askıya al (gizle)</button>}
        {status === "pending" && <button disabled={pending} className={btn} onClick={() => act(() => setStatus(shopId, "rejected", "Başvuru reddedildi"), "Başvuru reddedilsin mi?")}>Reddet</button>}
        <button disabled={pending} className={btn} onClick={() => act(() => setSegment(shopId, segment === "erkek" ? "kadin" : "erkek"))}>
          {segment === "erkek" ? "Kadın kuaförüne çevir" : "Erkek berberine çevir"}
        </button>
        {needsReview && <button disabled={pending} className={btn} onClick={() => act(() => markReviewed(shopId))}>✓ Bilgiler doğru (kontrol edildi)</button>}
        <button disabled={pending} className={`${btn} text-closed`} onClick={() => act(() => deleteShop(shopId), "Dükkân silinsin mi? Bu işlem geri alınamaz.")}>Sil</button>
      </div>
    </div>
  );
}

// Dükkânı bir kullanıcıya devret
export function AssignOwnerForm({ shopId }: { shopId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(assignOwner, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="shopId" value={shopId} />
      <Result r={state} />
      <div className="flex gap-2">
        <input name="email" type="email" required placeholder="Dükkân sahibinin e-postası" className="flex-1 rounded-xl border border-line px-3 py-2.5" />
        <div className="w-40"><SubmitButton>Devret</SubmitButton></div>
      </div>
      <p className="text-xs text-muted">Kişi önce siteye kayıt olmalı. Devredince dükkân &quot;katıldı&quot; olur, online randevu açılır.</p>
    </form>
  );
}

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
export type HourRow = { Weekday: number; IsClosed: boolean; Open: string; Close: string };

// Haftalık çalışma saatleri
export function HoursForm({ shopId, hours, action: save = saveHours }: { shopId: string; hours: HourRow[]; action?: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const [state, action] = useActionState<ActionState, FormData>(save, undefined);
  const byDay = new Map(hours.map((h) => [h.Weekday, h]));
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="shopId" value={shopId} />
      <Result r={state} />
      <table className="w-full text-sm">
        <tbody>
          {DAYS.map((name, i) => {
            const d = i + 1;
            const h = byDay.get(d);
            return (
              <tr key={d} className="border-b border-line last:border-0">
                <td className="py-2 pr-2 font-medium">{name}</td>
                <td className="py-2"><input type="time" name={`open${d}`} defaultValue={h?.Open || "09:00"} className="rounded-lg border border-line px-2 py-1" /></td>
                <td className="py-2"><input type="time" name={`close${d}`} defaultValue={h?.Close || "21:00"} className="rounded-lg border border-line px-2 py-1" /></td>
                <td className="py-2 pl-2"><label className="flex items-center gap-1"><input type="checkbox" name={`closed${d}`} defaultChecked={h?.IsClosed ?? false} /> Kapalı</label></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="w-48"><SubmitButton>Saatleri kaydet</SubmitButton></div>
    </form>
  );
}
