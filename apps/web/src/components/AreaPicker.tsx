"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { District, Province, Segment } from "@/lib/types";

type Hood = { Id: number; Name: string };

// İl → İlçe → (isteğe bağlı) Mahalle seçip o bölgedeki dükkânları listeler (konum vermek istemeyenler için)
export function AreaPicker({ segment, provinces, onAreaChange, buttonLabel = "Ara" }: { segment: Segment; provinces: Province[]; onAreaChange?: (a: { province: string; districtId?: number; hoodId?: number }) => void; buttonLabel?: string }) {
  const router = useRouter();
  const [province, setProvince] = useState<Province | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [district, setDistrict] = useState<District | null>(null);
  const [hoods, setHoods] = useState<Hood[]>([]);
  const [hood, setHood] = useState<number | null>(null);
  const [loading, setLoading] = useState<"ilce" | "mahalle" | null>(null);

  async function chooseProvince(id: string) {
    const p = provinces.find((x) => String(x.Id) === id) ?? null;
    setProvince(p);
    setDistrict(null);
    setDistricts([]);
    setHoods([]);
    setHood(null);
    if (!p) return;
    onAreaChange?.({ province: p.Name });
    setLoading("ilce");
    try {
      const res = await fetch(`/api/ilceler?il=${p.Id}`);
      setDistricts(res.ok ? await res.json() : []);
    } finally {
      setLoading(null);
    }
  }

  async function chooseDistrict(id: string) {
    const d = districts.find((x) => String(x.Id) === id) ?? null;
    setDistrict(d);
    setHoods([]);
    setHood(null);
    if (!d) return;
    onAreaChange?.({ province: province?.Name ?? "", districtId: d.Id });
    setLoading("mahalle");
    try {
      const res = await fetch(`/api/mahalleler?ilce=${d.Id}`);
      setHoods(res.ok ? await res.json() : []);
    } finally {
      setLoading(null);
    }
  }

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (!province) return;
    router.push(`/${segment}/${province.Slug}${district ? `/${district.Slug}${hood ? `?mahalle=${hood}` : ""}` : ""}`);
  }

  const select = "w-full rounded-xl border border-line bg-surface px-3 py-3 text-ink disabled:opacity-60";
  return (
    <form onSubmit={go} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <label className="sr-only" htmlFor="il">İl</label>
      <select id="il" className={select} value={province?.Id ?? ""} onChange={(e) => chooseProvince(e.target.value)}>
        <option value="">İl seçin</option>
        {provinces.map((p) => (
          <option key={p.Id} value={p.Id}>{p.Name}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="ilce">İlçe</label>
      <select id="ilce" className={select} disabled={!province || loading === "ilce"} value={district?.Id ?? ""} onChange={(e) => chooseDistrict(e.target.value)}>
        <option value="">{loading === "ilce" ? "Yükleniyor…" : "Tüm ilçeler"}</option>
        {districts.map((d) => (
          <option key={d.Id} value={d.Id}>{d.Name}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="mahalle">Mahalle</label>
      <select id="mahalle" className={select} disabled={!district || loading === "mahalle"} value={hood ?? ""} onChange={(e) => { const h = Number(e.target.value) || null; setHood(h); if (h && district) onAreaChange?.({ province: province?.Name ?? "", districtId: district.Id, hoodId: h }); }}>
        <option value="">{loading === "mahalle" ? "Yükleniyor…" : "Tüm mahalleler"}</option>
        {hoods.map((h) => (
          <option key={h.Id} value={h.Id}>{h.Name}</option>
        ))}
      </select>
      <button type="submit" disabled={!province} className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-ink disabled:opacity-50">
        {buttonLabel}
      </button>
    </form>
  );
}
