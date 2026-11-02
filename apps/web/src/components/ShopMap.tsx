"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

export type MapPoint = { id: string; name: string; lat: number; lng: number; href?: string };

// OpenStreetMap haritası (ücretsiz). İşaretler bölüm rengindedir.
const pin = L.divIcon({
  className: "",
  html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--primary);border:3px solid var(--accent);box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
  popupAnchor: [0, -22],
});

export default function ShopMap({ points, center, zoom = 14, height = 320 }: { points: MapPoint[]; center?: [number, number]; zoom?: number; height?: number }) {
  const c = center ?? (points[0] ? [points[0].lat, points[0].lng] : [39.0, 35.0]);
  return (
    <div className="overflow-hidden rounded-2xl border border-line" style={{ height }}>
      <MapContainer center={c} zoom={points.length ? zoom : 6} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pin}>
            <Popup>{p.href ? <a href={p.href}>{p.name}</a> : p.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
