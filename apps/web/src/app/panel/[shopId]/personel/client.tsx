"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addDayOff, createInvite, saveBreaks, saveStaff, type PanelState } from "@/app/panel/actions";
import { FormError, SubmitButton } from "@/components/forms";

const input = "w-full rounded-lg border border-line bg-surface px-3 py-2";
const Ok = ({ state }: { state: PanelState }) => (state?.ok ? <p className="rounded-lg bg-open/10 px-3 py-1.5 text-sm font-medium text-open">{state.ok}</p> : null);

type StaffInitial = { Id: string; DisplayName: string; Title: string | null; Phone: string | null; ShowPhone: boolean; IsActive: boolean };

export function StaffForm({ shopId, initial }: { shopId: string; initial?: StaffInitial }) {
  const [state, action] = useActionState<PanelState, FormData>(saveStaff, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && !initial) ref.current?.reset(); }, [state, initial]);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="shopId" value={shopId} />
      {initial && <input type="hidden" name="staffId" value={initial.Id} />}
      <div className="sm:col-span-2"><FormError message={state?.error} /><Ok state={state} /></div>
      <label className="text-sm"><span className="mb-1 block font-semibold">Adı</span><input name="displayName" required defaultValue={initial?.DisplayName} placeholder="Örn. Mehmet Usta" className={input} /></label>
      <label className="text-sm"><span className="mb-1 block font-semibold">Unvanı</span><input name="title" defaultValue={initial?.Title ?? ""} placeholder="Usta, kalfa, stilist…" className={input} /></label>
      <label className="text-sm"><span className="mb-1 block font-semibold">Telefonu</span><input name="phone" type="tel" defaultValue={initial?.Phone ?? ""} className={input} /></label>
      <div className="flex flex-col justify-end gap-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="showPhone" defaultChecked={initial?.ShowPhone} /> Telefonu müşterilere göster</label>
        {initial && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isActive" value="off" defaultChecked={!initial.IsActive} /> Pasif (artık çalışmıyor)
          </label>
        )}
      </div>
      <div className="sm:w-60"><SubmitButton>{initial ? "Kaydet" : "Personeli ekle"}</SubmitButton></div>
    </form>
  );
}

// Personelin kendi hesabıyla panele girebilmesi için davet kodu
export function InviteButton({ staffId }: { staffId: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ error?: string; code?: string }>();
  if (res?.code) {
    return (
      <div className="rounded-xl border border-accent bg-accent/10 p-3 text-sm">
        <p>Davet kodu: <b className="font-mono text-lg tracking-widest">{res.code}</b></p>
        <p className="text-muted">Personeliniz Bermatik&apos;e kayıt olup <b>İşletme paneli</b>nde bu kodu girsin.</p>
      </div>
    );
  }
  return (
    <span className="flex flex-col items-end">
      <button disabled={pending} onClick={() => start(async () => setRes(await createInvite(staffId)))} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50">
        Davet kodu oluştur
      </button>
      {res?.error && <span className="text-xs text-closed">{res.error}</span>}
    </span>
  );
}

export function BreakForm({ staffId, initial }: { staffId: string; initial?: { start: string; end: string } }) {
  const [state, action] = useActionState<PanelState, FormData>(saveBreaks, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="staffId" value={staffId} />
      <FormError message={state?.error} /><Ok state={state} />
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label><span className="mb-1 block">Başlangıç</span><input type="time" name="breakStart" defaultValue={initial?.start} className={input} /></label>
        <label><span className="mb-1 block">Bitiş</span><input type="time" name="breakEnd" defaultValue={initial?.end} className={input} /></label>
        <button className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-ink">Kaydet</button>
      </div>
      <p className="text-xs text-muted">Bu saatlerde randevu verilmez. Molayı kaldırmak için iki kutuyu boşaltıp kaydedin.</p>
    </form>
  );
}

export function DayOffForm({ staffId }: { staffId: string }) {
  const [state, action] = useActionState<PanelState, FormData>(addDayOff, undefined);
  const [kind, setKind] = useState<"weekly" | "dates">("weekly");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2 text-sm">
      <input type="hidden" name="staffId" value={staffId} />
      <FormError message={state?.error} /><Ok state={state} />
      <div className="flex gap-3">
        <label className="flex items-center gap-1"><input type="radio" checked={kind === "weekly"} onChange={() => setKind("weekly")} /> Haftalık izin günü</label>
        <label className="flex items-center gap-1"><input type="radio" checked={kind === "dates"} onChange={() => setKind("dates")} /> Tarih aralığı</label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {kind === "weekly" ? (
          <select name="weekday" className={`${input} w-auto`}>
            {["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"].map((w, i) => <option key={w} value={i + 1}>{w}</option>)}
          </select>
        ) : (
          <>
            <input type="date" name="startDate" required className={`${input} w-auto`} />
            <input type="date" name="endDate" required className={`${input} w-auto`} />
          </>
        )}
        <input name="note" placeholder="Not (ör. yıllık izin)" className={`${input} w-40`} />
        <button className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-ink">Ekle</button>
      </div>
    </form>
  );
}
