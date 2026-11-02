"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import type { District, Province } from "@/lib/types";
import { FormError, SubmitButton } from "@/components/forms";
import type { ActionState } from "@/app/admin/dukkanlar/actions";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-[340px] animate-pulse rounded-2xl bg-surface-2" />,
});

type Hood = { Id: number; Name: string };
export type ShopFormValues = {
  shopId?: string;
  segment?: "erkek" | "kadin";
  name?: string; description?: string | null; phone?: string | null;
  provinceId?: number; districtId?: number; neighborhoodId?: number;
  street?: string; buildingNo?: string; addressDetail?: string | null;
  lat?: number; lng?: number;
  isTemporarilyClosed?: boolean; showServiceDescriptions?: boolean; storeEnabled?: boolean; queueAvgMinutes?: number; coverImagePath?: string | null;
};

// Dükkân ekleme/düzenleme formu (admin ve işletme paneli ortak)
export function ShopForm({
  action, provinces, initial, initialDistricts = [], initialHoods = [], mode, hidden = {},
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  provinces: Province[];
  initial: ShopFormValues;
  initialDistricts?: District[];
  initialHoods?: Hood[];
  mode: "create" | "edit";
  hidden?: Record<string, string>;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, undefined);
  const [pos, setPos] = useState(initial.lat != null && initial.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  const [provinceId, setProvinceId] = useState<number | "">(initial.provinceId ?? "");
  const [districtId, setDistrictId] = useState<number | "">(initial.districtId ?? "");
  const [hoodId, setHoodId] = useState<number | "">(initial.neighborhoodId ?? "");
  const [districts, setDistricts] = useState<District[]>(initialDistricts);
  const [hoods, setHoods] = useState<Hood[]>(initialHoods);
  const [street, setStreet] = useState(initial.street ?? "");
  const [buildingNo, setBuildingNo] = useState(initial.buildingNo && initial.buildingNo !== "-" ? initial.buildingNo : "");
  const [lookup, setLookup] = useState<string | null>(null);

  async function loadDistricts(pid: number) {
    setDistricts(await (await fetch(`/api/ilceler?il=${pid}`)).json());
  }
  async function loadHoods(did: number) {
    setHoods(await (await fetch(`/api/mahalleler?ilce=${did}`)).json());
  }

  // Haritada nokta seçilince adres bilgilerini doldur
  async function onPick(lat: number, lng: number) {
    setPos({ lat, lng });
    setLookup("Adres bulunuyor…");
    try {
      const r = await (await fetch(`/api/admin/adres?lat=${lat}&lng=${lng}`)).json();
      if (r.provinceId) { setProvinceId(r.provinceId); setDistricts(r.districts ?? []); }
      if (r.districtId) { setDistrictId(r.districtId); setHoods(r.neighborhoods ?? []); }
      setHoodId(r.neighborhoodId ?? "");
      if (r.street && !street) setStreet(r.street);
      if (r.houseNumber && !buildingNo) setBuildingNo(r.houseNumber);
      setLookup(r.neighborhoodId ? null : "Mahalle otomatik bulunamadı, lütfen listeden seçin.");
    } catch {
      setLookup("Adres otomatik bulunamadı, lütfen elle seçin.");
    }
  }

  const input = "w-full rounded-xl border border-line bg-surface px-3 py-2.5";
  const label = "mb-1 block text-sm font-semibold";
  return (
    <form action={formAction} className="space-y-5">
      {initial.shopId && <input type="hidden" name="shopId" value={initial.shopId} />}
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="lat" value={pos?.lat ?? ""} />
      <input type="hidden" name="lng" value={pos?.lng ?? ""} />
      <input type="hidden" name="queueAvgMinutes" value={initial.queueAvgMinutes ?? 20} />
      <FormError message={state?.error} />
      {state?.ok && <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{state.ok}</p>}

      {mode === "create" && (
        <fieldset>
          <legend className={label}>Bölüm</legend>
          <div className="flex gap-2">
            {(["erkek", "kadin"] as const).map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-4 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-surface-2">
                <input type="radio" name="segment" value={s} defaultChecked={(initial.segment ?? "erkek") === s} />
                {s === "erkek" ? "Erkek berberi" : "Kadın kuaförü"}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className={label}>Dükkân adı</span>
          <input name="name" required defaultValue={initial.name} className={input} /></label>
        <label className="block"><span className={label}>Telefon {mode === "create" && <span className="font-normal text-muted">(biliniyorsa)</span>}</span>
          <input name="phone" type="tel" defaultValue={initial.phone ?? ""} placeholder="0312 xxx xx xx" className={input} /></label>
        <label className="block sm:col-span-2"><span className={label}>Açıklama <span className="font-normal text-muted">(isteğe bağlı)</span></span>
          <textarea name="description" rows={2} defaultValue={initial.description ?? ""} className={input} /></label>
      </div>

      <div>
        <span className={label}>Konum</span>
        <LocationPicker value={pos} onChange={onPick} />
        {lookup && <p className="mt-1 text-sm text-muted">{lookup}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block"><span className={label}>İl</span>
          <select name="provinceId" required value={provinceId} className={input}
            onChange={(e) => { const v = Number(e.target.value); setProvinceId(v || ""); setDistrictId(""); setHoodId(""); setHoods([]); if (v) loadDistricts(v); }}>
            <option value="">Seçin</option>
            {provinces.map((p) => <option key={p.Id} value={p.Id}>{p.Name}</option>)}
          </select></label>
        <label className="block"><span className={label}>İlçe</span>
          <select name="districtId" required value={districtId} className={input} disabled={!districts.length}
            onChange={(e) => { const v = Number(e.target.value); setDistrictId(v || ""); setHoodId(""); if (v) loadHoods(v); }}>
            <option value="">Seçin</option>
            {districts.map((d) => <option key={d.Id} value={d.Id}>{d.Name}</option>)}
          </select></label>
        <label className="block"><span className={label}>Mahalle</span>
          <select name="neighborhoodId" required value={hoodId} className={input} disabled={!hoods.length}
            onChange={(e) => setHoodId(Number(e.target.value) || "")}>
            <option value="">Seçin</option>
            {hoods.map((h) => <option key={h.Id} value={h.Id}>{h.Name}</option>)}
          </select></label>
        <label className="block sm:col-span-2"><span className={label}>Cadde / sokak</span>
          <input name="street" required value={street} onChange={(e) => setStreet(e.target.value)} className={input} /></label>
        <label className="block"><span className={label}>Bina no</span>
          <input name="buildingNo" value={buildingNo} onChange={(e) => setBuildingNo(e.target.value)} className={input} /></label>
        <label className="block sm:col-span-3"><span className={label}>Adres tarifi <span className="font-normal text-muted">(kat, yakınındaki yer…)</span></span>
          <input name="addressDetail" defaultValue={initial.addressDetail ?? ""} className={input} /></label>
      </div>

      {mode === "edit" && (
        <div className="flex flex-wrap gap-4 rounded-2xl border border-line p-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="isTemporarilyClosed" defaultChecked={initial.isTemporarilyClosed} /> Geçici olarak kapalı</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="showServiceDescriptions" defaultChecked={initial.showServiceDescriptions ?? true} /> Hizmet açıklamalarını göster</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="storeEnabled" defaultChecked={initial.storeEnabled} /> Ürün satışı açık</label>
        </div>
      )}

      <div className="max-w-xs">
        <SubmitButton>{mode === "create" ? "Dükkânı ekle" : "Kaydet"}</SubmitButton>
      </div>
    </form>
  );
}
