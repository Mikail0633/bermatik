"use client";

import { useActionState, useState } from "react";
import { createRequest, type RequestState } from "@/app/talep-randevu-actions";
import { FormError, SubmitButton } from "@/components/forms";
import { BotFields } from "@/components/BotFields";

type Category = { Id: number; Name: string };

const TIMES = Array.from({ length: 25 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

// Önümüzdeki 14 gün (İstanbul saatine göre)
function nextDays() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
  const label = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", weekday: "short", day: "numeric", month: "short" });
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() + i * 86_400_000);
    return { key: fmt.format(d), label: i === 0 ? "Bugün" : i === 1 ? "Yarın" : label.format(d) };
  });
}

// Katılmamış dükkân için randevu talebi
export function RequestForm({ shopId, categories }: { shopId: string; categories: Category[] }) {
  const [state, action] = useActionState<RequestState, FormData>(createRequest, undefined);
  const days = nextDays();
  const [day, setDay] = useState(days[0].key);
  if (state?.ok) return <p className="rounded-2xl bg-open/10 p-5 font-medium text-open">{state.ok}</p>;
  const chip = (on: boolean) => `shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold ${on ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface hover:bg-surface-2"}`;
  const input = "w-full rounded-xl border border-line bg-surface px-3 py-2.5";
  return (
    <form action={action} className="space-y-5">
      <BotFields />
      <input type="hidden" name="shopId" value={shopId} />
      <FormError message={state?.error} />
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Hizmet</span>
        <select name="categoryId" className={input} defaultValue="">
          <option value="">Seçmeden devam et</option>
          {categories.map((c) => <option key={c.Id} value={c.Id}>{c.Name}</option>)}
        </select>
      </label>
      <div>
        <span className="mb-1 block text-sm font-semibold">Gün</span>
        <input type="hidden" name="day" value={day} />
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {days.map((d) => <button type="button" key={d.key} onClick={() => setDay(d.key)} className={chip(d.key === day)}>{d.label}</button>)}
        </div>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">İstediğiniz saat</span>
        <select name="time" required className={input} defaultValue="">
          <option value="" disabled>Saat seçin</option>
          {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Not <span className="font-normal text-muted">(isteğe bağlı)</span></span>
        <input name="note" maxLength={300} placeholder="Örn. saat 14:00 olmazsa 16:00 da uyar" className={input} />
      </label>
      <SubmitButton>Randevu talebi gönder</SubmitButton>
    </form>
  );
}
