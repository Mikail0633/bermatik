"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { quickAddShop, type QuickState } from "./actions";
import { FormError } from "@/components/forms";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-2xl bg-surface-2" />,
});

export function QuickAdd() {
  const [state, action, pending] = useActionState<QuickState, FormData>(quickAddShop, undefined);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [acc, setAcc] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string>();
  const [segment, setSegment] = useState<"erkek" | "kadin">("erkek");
  const [added, setAdded] = useState<{ id: string; name: string }[]>([]);
  const [force, setForce] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  function locate() {
    if (!navigator.geolocation) { setGeoError("Bu cihaz konum vermiyor."); return; }
    setLocating(true); setGeoError(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setAcc(Math.round(p.coords.accuracy)); setLocating(false); nameRef.current?.focus(); },
      () => { setGeoError("Konum alınamadı. Telefonda konum iznini açın ya da haritada işaretleyin."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  // Kaydedilince: listeye ekle, formu temizle, bir sonraki dükkân için konumu sıfırla
  useEffect(() => {
    if (state?.ok && state.shopId) {
      setAdded((a) => [{ id: state.shopId!, name: state.name! }, ...a]);
      formRef.current?.reset(); setPos(null); setAcc(null); setForce(false);
    }
  }, [state]);
  useEffect(() => { if (state?.warn) setForce(true); }, [state]);

  const input = "w-full rounded-xl border border-line bg-surface px-3 py-3 text-lg";
  return (
    <div className="space-y-4">
      {state?.ok && <p className="rounded-xl bg-open/10 px-3 py-2 font-medium text-open">✓ {state.ok} Sıradaki dükkâna geçebilirsiniz.</p>}
      <button type="button" onClick={locate} disabled={locating}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cta px-6 py-4 text-lg font-bold text-cta-ink disabled:opacity-60">
        <LocateFixed className="h-6 w-6" aria-hidden /> {locating ? "Konum alınıyor…" : pos ? "Konumu yenile" : "Buradayım (konumu al)"}
      </button>
      {geoError && <p className="text-sm text-closed">{geoError}</p>}
      {acc != null && <p className="text-xs text-muted">Konum doğruluğu: yaklaşık {acc} m{acc > 50 ? " — gerekirse haritada işareti dükkânın üstüne sürükleyin" : ""}</p>}
      <LocationPicker value={pos} onChange={(lat, lng) => setPos({ lat, lng })} />

      <form ref={formRef} action={action} className="space-y-3">
        <input type="hidden" name="lat" value={pos?.lat ?? ""} />
        <input type="hidden" name="lng" value={pos?.lng ?? ""} />
        <input type="hidden" name="segment" value={segment} />
        <input type="hidden" name="force" value={force ? "1" : ""} />
        <FormError message={state?.error} />
        {state?.warn && <p className="rounded-xl bg-accent/15 px-3 py-2 text-sm">{state.warn}</p>}
        <div className="grid grid-cols-2 gap-2">
          {(["erkek", "kadin"] as const).map((s) => (
            <button type="button" key={s} onClick={() => setSegment(s)}
              className={`rounded-xl border px-3 py-3 font-semibold ${segment === s ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface"}`}>
              {s === "erkek" ? "Erkek berberi" : "Kadın kuaförü"}
            </button>
          ))}
        </div>
        <input ref={nameRef} name="name" required placeholder="Dükkânın adı (tabeladaki gibi)" className={input} onChange={() => setForce(false)} />
        <input name="phone" type="tel" inputMode="tel" placeholder="Telefonu (tabelada / camda yazıyorsa)" className={input} />
        <input name="note" placeholder="Not (ör. 2. kat, eczanenin yanı)" className="w-full rounded-xl border border-line bg-surface px-3 py-2.5" />
        <button disabled={pending || !pos} className="w-full rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-ink disabled:opacity-50">
          {pending ? "Kaydediliyor…" : force ? "Yine de ekle" : "Kaydet"}
        </button>
      </form>

      {added.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-bold">Bu oturumda eklenen: {added.length}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {added.map((s) => <li key={s.id}><Link href={`/admin/dukkanlar/${s.id}`} className="underline">{s.name}</Link></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
