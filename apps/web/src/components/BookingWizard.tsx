"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, Loader2, Users } from "lucide-react";
import { bookAppointment, type BookState } from "@/app/randevu-actions";
import { FormError, SubmitButton } from "./forms";
import { initials, tl } from "@/lib/types";

type Service = { Id: string; Name: string; Price: number; DurationMinutes: number; Description: string | null };
type Staff = { Id: string; DisplayName: string; Title: string | null; PhotoPath: string | null; IsCertified?: boolean };
type Slot = { start: string; staffId: string; staffName: string | null; minutes: number };

// Türkiye tarihine göre bugünden itibaren 14 gün
function nextDays(n = 14) {
  const fmt = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", weekday: "short", day: "numeric", month: "short" });
  const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() + i * 86_400_000);
    return { key: keyFmt.format(d), label: i === 0 ? "Bugün" : i === 1 ? "Yarın" : fmt.format(d) };
  });
}

// Randevu: 1) Hizmet  2) Personel (veya fark etmez)  3) Gün ve saat  → Onayla
export function BookingWizard({
  shopId, services, staff, back, initialServices = [], initialStaff,
}: {
  shopId: string; services: Service[]; staff: Staff[]; back: string; initialServices?: string[]; initialStaff?: string;
}) {
  const [state, action] = useActionState<BookState, FormData>(bookAppointment, undefined);
  const [picked, setPicked] = useState<string[]>(initialServices.filter((id) => services.some((s) => s.Id === id)));
  const [who, setWho] = useState<string | null>(initialStaff ?? (staff.length === 1 ? staff[0].Id : null));
  const days = useMemo(() => nextDays(), []);
  const [day, setDay] = useState(days[0].key);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);

  const chosen = services.filter((s) => picked.includes(s.Id));
  const total = chosen.reduce((a, s) => a + Number(s.Price), 0);

  // Hizmet, personel veya gün değişince boş saatleri getir
  useEffect(() => {
    setSlot(null);
    if (!picked.length || !who) { setSlots(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/randevu/saatler?dukkan=${shopId}&personel=${who}&tarih=${day}&hizmetler=${picked.join(",")}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Slot[]) => { if (!cancelled) setSlots(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [shopId, picked, who, day]);

  const step = "rounded-2xl border border-line bg-surface p-4 sm:p-5";
  const num = (n: number, done: boolean) => (
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-open text-white" : "bg-primary text-primary-ink"}`}>
      {done ? <Check className="h-4 w-4" aria-hidden /> : n}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* 1) Hizmet */}
      <section className={step}>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">{num(1, picked.length > 0)} Hizmet seç</h2>
        <div className="grid gap-2">
          {services.map((s) => {
            const on = picked.includes(s.Id);
            return (
              <label key={s.Id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${on ? "border-primary bg-surface-2" : "border-line hover:bg-surface-2"}`}>
                <input type="checkbox" checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== s.Id) : [...picked, s.Id])} className="h-5 w-5 accent-[var(--primary)]" />
                <span className="flex-1">
                  <span className="block font-semibold">{s.Name}</span>
                  <span className="block text-sm text-muted">{s.DurationMinutes} dk{s.Description ? ` · ${s.Description}` : ""}</span>
                </span>
                <span className="font-bold">{tl(Number(s.Price))}</span>
              </label>
            );
          })}
        </div>
      </section>

      {/* 2) Personel */}
      <section className={`${step} ${picked.length ? "" : "pointer-events-none opacity-50"}`}>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">{num(2, !!who)} Personel seç</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {staff.length > 1 && (
            <button type="button" onClick={() => setWho("farketmez")}
              className={`flex items-center gap-2 rounded-xl border p-3 text-left ${who === "farketmez" ? "border-primary bg-surface-2" : "border-line hover:bg-surface-2"}`}>
              <Users className="h-6 w-6 text-accent" aria-hidden />
              <span><span className="block font-semibold">Fark etmez</span><span className="block text-xs text-muted">En erken boş olan</span></span>
            </button>
          )}
          {staff.map((p) => (
            <button key={p.Id} type="button" onClick={() => setWho(p.Id)}
              className={`flex items-center gap-2 rounded-xl border p-3 text-left ${who === p.Id ? "border-primary bg-surface-2" : "border-line hover:bg-surface-2"}`}>
              {p.PhotoPath
                ? <img src={`/uploads/${p.PhotoPath}`} alt="" className="h-9 w-9 rounded-full object-cover" /> // eslint-disable-line @next/next/no-img-element -- fotoğraflar yüklenirken küçültülüyor
                : <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-bold text-primary-ink">{initials(p.DisplayName, 1)}</span>}
              <span><span className="flex items-center gap-1 font-semibold">{p.DisplayName}{p.IsCertified && <BadgeCheck className="h-4 w-4 text-accent" aria-label="Belgeli" />}</span>{p.Title && <span className="block text-xs text-muted">{p.Title}</span>}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 3) Gün ve saat */}
      <section className={`${step} ${picked.length && who ? "" : "pointer-events-none opacity-50"}`}>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">{num(3, !!slot)} Gün ve saat seç</h2>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {days.map((d) => (
            <button key={d.key} type="button" onClick={() => setDay(d.key)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold ${day === d.key ? "border-primary bg-primary text-primary-ink" : "border-line hover:bg-surface-2"}`}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="mt-3 min-h-16">
          {loading ? (
            <p className="flex items-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Boş saatler yükleniyor…</p>
          ) : slots && slots.length === 0 ? (
            <p className="text-muted">Bu gün için boş saat yok. Başka bir gün seçin.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slots?.map((s) => (
                <button key={s.start} type="button" onClick={() => setSlot(s)}
                  className={`rounded-lg border py-2 text-sm font-semibold ${slot?.start === s.start ? "border-primary bg-primary text-primary-ink" : "border-line hover:bg-surface-2"}`}>
                  {s.start.slice(11, 16)}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Onay */}
      {slot && (
        <form action={action} className={`${step} border-primary`}>
          <input type="hidden" name="shopId" value={shopId} />
          <input type="hidden" name="staffId" value={slot.staffId} />
          <input type="hidden" name="services" value={picked.join(",")} />
          <input type="hidden" name="start" value={slot.start} />
          <input type="hidden" name="back" value={back} />
          <h2 className="text-lg font-bold">Randevu özeti</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li><b>Hizmet:</b> {chosen.map((s) => s.Name).join(", ")}</li>
            <li><b>Personel:</b> {slot.staffName ?? staff.find((p) => p.Id === slot.staffId)?.DisplayName}</li>
            <li><b>Zaman:</b> {days.find((d) => d.key === day)?.label}, {slot.start.slice(11, 16)} ({slot.minutes} dk)</li>
            <li><b>Tutar:</b> {tl(total)} <span className="text-muted">(ödeme dükkânda)</span></li>
          </ul>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-semibold">Not <span className="font-normal text-muted">(isteğe bağlı)</span></span>
            <input name="note" maxLength={500} className="w-full rounded-xl border border-line px-3 py-2" placeholder="Örn. kısa olsun, yanları sıfır" />
          </label>
          <div className="mt-3"><FormError message={state?.error} /></div>
          <div className="mt-3"><SubmitButton>Randevuyu onayla</SubmitButton></div>
          <p className="mt-2 text-xs text-muted">Randevunuz dükkânın onayına gönderilir; onaylanınca bildirim alırsınız.</p>
        </form>
      )}
    </div>
  );
}
