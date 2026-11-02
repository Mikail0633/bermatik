"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { previewAnnouncement, sendAnnouncement, type AdminState } from "../actions";
import { FormError } from "@/components/forms";
import type { Province } from "@/lib/types";

const input = "w-full rounded-xl border border-line bg-surface px-3 py-2.5";

export function AnnouncementForm({ provinces }: { provinces: Province[] }) {
  const [state, action, sending] = useActionState<AdminState, FormData>(sendAnnouncement, undefined);
  const [segment, setSegment] = useState("");
  const [province, setProvince] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  // Hedef değişince kaç kişiye gideceğini yeniden hesapla
  useEffect(() => { start(async () => setCount(await previewAnnouncement(segment, province))); }, [segment, province, state]);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);

  return (
    <form
      ref={ref}
      action={action}
      onSubmit={(e) => { if (!window.confirm(`Duyuru ${count ?? "?"} kişiye gönderilecek. Emin misiniz?`)) e.preventDefault(); }}
      className="space-y-3"
    >
      <FormError message={state?.error} />
      {state?.ok && <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{state.ok}</p>}
      <label className="block text-sm"><span className="mb-1 block font-semibold">Başlık</span>
        <input name="title" required maxLength={80} placeholder="Örn. Bermatik Pursaklar'da!" className={input} /></label>
      <label className="block text-sm"><span className="mb-1 block font-semibold">Mesaj</span>
        <textarea name="body" required maxLength={300} rows={3} placeholder="Merhaba {ad}, Pursaklar'daki berberler artık Bermatik'te. Hemen randevunu al!" className={input} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block font-semibold">Kime</span>
          <select name="segment" value={segment} onChange={(e) => setSegment(e.target.value)} className={input}>
            <option value="">Tüm müşteriler</option>
            <option value="erkek">Erkek berberinden randevu alanlar</option>
            <option value="kadin">Kadın kuaföründen randevu alanlar</option>
          </select></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">İl</span>
          <select name="provinceId" value={province} onChange={(e) => setProvince(e.target.value)} className={input}>
            <option value="">Tüm iller</option>
            {provinces.map((p) => <option key={p.Id} value={p.Id}>{p.Name}</option>)}
          </select></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={sending || count === 0} className="rounded-xl bg-primary px-6 py-3 font-bold text-primary-ink disabled:opacity-50">Gönder</button>
        <span className="text-sm text-muted">{count == null ? "Hesaplanıyor…" : `${count} kişiye gidecek`}</span>
      </div>
    </form>
  );
}
