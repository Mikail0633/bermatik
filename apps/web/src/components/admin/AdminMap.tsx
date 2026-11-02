"use client";

import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from "react-leaflet";
import { COLORS, type AdminPoint } from "./mapColors";

function ClickToAdd({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function AdminMap({ points, center }: { points: AdminPoint[]; center: [number, number] }) {
  const [pick, setPick] = useState<[number, number] | null>(null);
  return (
    <div className="overflow-hidden rounded-2xl border border-line" style={{ height: "70vh", minHeight: 420 }}>
      <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToAdd onPick={(lat, lng) => setPick([lat, lng])} />
        {points.map((p) => (
          <CircleMarker
            key={p.Id}
            center={[Number(p.Latitude), Number(p.Longitude)]}
            radius={7}
            pathOptions={{
              color: p.Status === "pending" ? COLORS.pending : p.NeedsReview ? COLORS.review : "#111",
              weight: p.Status === "pending" || p.NeedsReview ? 3 : 1,
              fillColor: COLORS[p.Segment], fillOpacity: p.Status === "approved" ? 0.9 : 0.4,
            }}
            eventHandlers={{ click: () => setPick(null) }}
          >
            <Popup>
              <b>{p.Name}</b><br />
              {p.Code} · {p.District}<br />
              {p.Status !== "approved" ? `Durum: ${p.Status}` : p.IsClaimed ? "Bermatik'te" : "Katılmamış"}{p.NeedsReview ? " · kontrol bekliyor" : ""}<br />
              <a href={`/admin/dukkanlar/${p.Id}`}>Düzenle →</a>
            </Popup>
          </CircleMarker>
        ))}
        {pick && (
          <Popup position={pick} eventHandlers={{ remove: () => setPick(null) }}>
            <a href={`/admin/dukkanlar/yeni?lat=${pick[0].toFixed(6)}&lng=${pick[1].toFixed(6)}`}><b>+ Buraya dükkân ekle</b></a>
          </Popup>
        )}
      </MapContainer>
    </div>
  );
}
