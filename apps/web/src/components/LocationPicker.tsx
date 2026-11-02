"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Search } from "lucide-react";

// Haritada konum seçme: adres ara, haritaya tıkla veya işareti sürükle
const pin = L.divIcon({
  className: "",
  html: '<span style="display:block;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#1b2a41;border:3px solid #c9a227;box-shadow:0 2px 6px rgba(0,0,0,.4)"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

function ClickToSet({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
// Yalnızca hedef gerçekten değişince uçar (her çizimde değil)
function FlyTo({ lat, lng, zoom = 17 }: { lat?: number; lng?: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) map.flyTo([lat, lng], zoom, { duration: 0.6 });
  }, [lat, lng, zoom, map]);
  return null;
}

export default function LocationPicker({
  value, onChange, start, focus, emptyText = "Dükkânın yerini haritaya tıklayarak işaretleyin.", placeholder = "Adres veya yer ara (örn. Pursaklar Saray Cumhuriyet Caddesi)",
}: {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
  emptyText?: string;
  placeholder?: string;
  /** Seçim yokken haritanın başlayacağı yer (varsayılan: Pursaklar) */
  start?: { lat: number; lng: number; zoom: number };
  /** Dışarıdan "haritayı şuraya götür" (il/ilçe seçilince) */
  focus?: { lat: number; lng: number; zoom: number } | null;
}) {
  const [q, setQ] = useState("");
  const [fly, setFly] = useState<[number, number] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function search(e: React.FormEvent | React.MouseEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setMsg("Aranıyor…");
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=tr&limit=1&accept-language=tr&q=${encodeURIComponent(q)}`,
    );
    const r = res.ok ? await res.json() : [];
    if (!r.length) return setMsg("Bulunamadı. Haritaya tıklayarak da seçebilirsiniz.");
    const lat = Number(r[0].lat), lng = Number(r[0].lon);
    setMsg(null);
    setFly([lat, lng]);
    onChange(lat, lng);
  }

  const center: [number, number] = value ? [value.lat, value.lng] : start ? [start.lat, start.lng] : [40.0392, 32.8994]; // varsayılan: Pursaklar
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search(e as unknown as React.FormEvent)}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
        />
        <button type="button" onClick={search} className="inline-flex items-center gap-1 rounded-xl border border-line px-3 text-sm font-semibold hover:bg-surface-2">
          <Search className="h-4 w-4" aria-hidden /> Ara
        </button>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <div className="overflow-hidden rounded-2xl border border-line" style={{ height: 340 }}>
        <MapContainer center={center} zoom={value ? 17 : start?.zoom ?? 14} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickToSet onPick={onChange} />
          <FlyTo lat={fly?.[0]} lng={fly?.[1]} />
          <FlyTo lat={focus?.lat} lng={focus?.lng} zoom={focus?.zoom} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={pin}
              draggable
              eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange(p.lat, p.lng); } }}
            />
          )}
        </MapContainer>
      </div>
      <p className="text-xs text-muted">
        {value ? `Seçilen konum: ${value.lat.toFixed(6)}, ${value.lng.toFixed(6)} — işareti sürükleyerek düzeltebilirsiniz.` : emptyText}
      </p>
    </div>
  );
}
