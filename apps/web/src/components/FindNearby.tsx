"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { LocateFixed, Loader2, MapPin, X } from "lucide-react";
import { SEGMENTS, type Province, type Segment } from "@/lib/types";
import { AreaPicker } from "./AreaPicker";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="grid h-[340px] place-items-center rounded-2xl border border-line text-sm text-muted">Harita yükleniyor…</div>,
});

const LAST = "bm_son_konum";
const readLast = (): { lat: number; lng: number } | null => {
  try { const v = JSON.parse(localStorage.getItem(LAST) ?? "null"); return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? v : null; } catch { return null; }
};
const saveLast = (lat: number, lng: number) => { try { localStorage.setItem(LAST, JSON.stringify({ lat, lng })); } catch { /* gizli sekme vb. */ } };

// Konum izni ister ve "yakınımdakiler" sayfasına gider.
// Konum alınamazsa (masaüstü bilgisayarlarda sık olur: GPS yok) haritadan yer seçme penceresi açılır.
// Konum yalnızca bu arama için kullanılır, hiçbir yere kaydedilmez.
export function useLocateAndGo(segment: Segment) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerReason, setPickerReason] = useState<string | null>(null);
  const go = (lat: number, lng: number) => { saveLast(lat, lng); router.push(`/${segment}/yakinimda?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`); };

  function locate() {
    setError(null);
    if (!navigator.geolocation) {
      setPickerReason("Tarayıcınız konum özelliğini desteklemiyor.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => go(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setBusy(false);
        setPickerReason(
          err.code === err.PERMISSION_DENIED
            ? "Konum izni verilmedi."
            : "Cihazınız konumunuzu bulamadı (bilgisayarlarda sık olur).",
        );
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  }

  const picker = pickerReason ? (
    <PickOnMap segment={segment} reason={pickerReason} onClose={() => setPickerReason(null)} onPick={go} onRetry={() => { setPickerReason(null); locate(); }} />
  ) : null;
  return { locate, busy, error, picker };
}

function PickOnMap({ segment, reason, onClose, onPick, onRetry }: {
  segment: Segment; reason: string; onClose: () => void; onPick: (lat: number, lng: number) => void; onRetry: () => void;
}) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [going, setGoing] = useState(false);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [start] = useState(() => { const l = typeof window === "undefined" ? null : readLast(); return l ? { ...l, zoom: 14 } : { lat: 39.0, lng: 35.2, zoom: 6 }; });
  useEffect(() => { fetch("/api/iller").then((r) => (r.ok ? r.json() : [])).then(setProvinces).catch(() => {}); }, []);
  // İl/ilçe seçilince harita oraya gider
  // Her yeni seçim öncekini geçersiz kılar: geç gelen eski cevap (ör. il) haritayı geri götürmesin
  const req = useRef(0);
  async function flyToPlace(a: { province: string; districtId?: number; hoodId?: number }) {
    const my = ++req.current;
    const apply = (c: { lat: number; lng: number; zoom: number } | null) => { if (c && my === req.current) setFocus(c); };
    try {
      if (a.districtId) {
        const r = await fetch(`/api/merkez?ilce=${a.districtId}${a.hoodId ? `&mahalle=${a.hoodId}` : ""}`);
        apply(r.ok ? await r.json() : null);
        return;
      }
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=tr&limit=1&accept-language=tr&q=${encodeURIComponent(`${a.province}, Türkiye`)}`);
      const j = r.ok ? await r.json() : [];
      if (j[0]) apply({ lat: Number(j[0].lat), lng: Number(j[0].lon), zoom: 9 });
    } catch { /* harita yerinde kalır */ }
  }
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Haritadan yerinizi seçin">
      <div className="max-h-full w-full max-w-xl overflow-y-auto rounded-2xl bg-surface p-4 text-ink shadow-2xl">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold"><MapPin className="h-5 w-5 text-accent" aria-hidden /> Yerinizi seçin</h2>
            <p className="text-sm text-muted">{reason} İlinizi, ilçenizi ve mahallenizi seçin ya da haritada bulunduğunuz yere dokunun.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-surface-2" aria-label="Kapat"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-3 rounded-xl bg-surface-2 p-3">
          <p className="mb-2 text-sm font-semibold">1) Bölgenizi seçin</p>
          {provinces.length > 0
            ? <AreaPicker segment={segment} provinces={provinces} onAreaChange={flyToPlace} buttonLabel="Bu bölgede ara" />
            : <p className="text-sm text-muted">İller yükleniyor…</p>}
        </div>
        <p className="mb-2 text-sm font-semibold">2) ya da haritada yerinize dokunun</p>
        <LocationPicker start={start} focus={focus} value={pos} onChange={(lat, lng) => setPos({ lat, lng })} placeholder="Adres, mahalle veya sokak yazın" emptyText="Bulunduğunuz yere haritada dokunun." />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={!pos || going} onClick={() => { if (pos) { setGoing(true); onPick(pos.lat, pos.lng); } }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-ink disabled:opacity-50">
            {going ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LocateFixed className="h-5 w-5" aria-hidden />}
            {pos ? `Bu konumun yakınındaki ${SEGMENTS[segment].shops.toLocaleLowerCase("tr-TR")}` : "Önce haritada yerinizi seçin"}
          </button>
          <button type="button" onClick={onRetry} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold hover:bg-surface-2">Konumu tekrar dene</button>
        </div>
      </div>
    </div>
  );
}

// "📍 En yakın berberi bul" butonu
export function FindNearby({ segment }: { segment: Segment }) {
  const { locate, busy, error, picker } = useLocateAndGo(segment);
  return (
    <div>
      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cta px-6 py-4 text-lg font-bold text-cta-ink shadow-lg transition hover:brightness-105 disabled:opacity-70 sm:w-auto"
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <LocateFixed className="h-6 w-6" aria-hidden />}
        {busy ? "Konum alınıyor…" : `En yakın ${SEGMENTS[segment].shopAcc} bul`}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-hero-ink/90">
          {error}
        </p>
      )}
      {picker}
    </div>
  );
}
