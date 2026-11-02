import "server-only";
import { call } from "./db";
import type { District, Province } from "./types";

// Haritada seçilen noktanın il/ilçe/mahallesini bulur (OpenStreetMap Nominatim + bizim listeler)
const UA = "Bermatik/0.1 (berber randevu platformu)";
const norm = (s?: string | null) =>
  (s ?? "").toLocaleLowerCase("tr-TR").replace(/\s+mahallesi$|\s+mah\.?$/u, "").replace(/[^a-zçğıöşü0-9]/gu, "");

export type ResolvedAddress = {
  provinceId: number | null; districtId: number | null; neighborhoodId: number | null; street: string | null; houseNumber: string | null;
};

export async function reverseGeocode(lat: number, lng: number): Promise<ResolvedAddress> {
  const empty: ResolvedAddress = { provinceId: null, districtId: null, neighborhoodId: null, street: null, houseNumber: null };
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=tr`,
    { headers: { "User-Agent": UA }, next: { revalidate: 86400 } },
  );
  if (!res.ok) return empty;
  const a = ((await res.json()).address ?? {}) as Record<string, string>;
  const provinces = await call<Province>("api.Lookup_Provinces");
  const p = provinces.find((x) => norm(x.Name) === norm(a.province ?? a.state));
  if (!p) return empty;
  const districts = await call<District>("api.Lookup_Districts", { ProvinceId: p.Id });
  const d = districts.find((x) => norm(x.Name) === norm(a.town ?? a.city_district ?? a.county ?? a.municipality ?? a.city));
  if (!d) return { ...empty, provinceId: p.Id, street: a.road ?? null, houseNumber: a.house_number ?? null };
  const hoods = await call<{ Id: number; Name: string }>("api.Lookup_Neighborhoods", { DistrictId: d.Id });
  const hn = norm(a.suburb ?? a.quarter ?? a.neighbourhood ?? a.village);
  const h = hoods.find((x) => norm(x.Name) === hn) ?? hoods.find((x) => hn && (norm(x.Name).includes(hn) || hn.includes(norm(x.Name))));
  return { provinceId: p.Id, districtId: d.Id, neighborhoodId: h?.Id ?? null, street: a.road ?? null, houseNumber: a.house_number ?? null };
}

// ---------------------------------------------------------------------
// İlçe / mahalle merkezi: önce veritabanı; yoksa Nominatim'den bulunup kaydedilir
// ---------------------------------------------------------------------
type CenterRow = {
  Province: string; District: string; Neighborhood: string | null; NeighborhoodId: number | null;
  DistrictLat: number | null; DistrictLng: number | null; NeighborhoodLat: number | null; NeighborhoodLng: number | null;
};

async function searchPlace(q: string): Promise<[number, number] | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=tr&limit=1&accept-language=tr&q=${encodeURIComponent(q)}`,
    { headers: { "User-Agent": UA }, next: { revalidate: 86400 } },
  ).catch(() => null);
  if (!res?.ok) return null;
  const hit = ((await res.json()) as { lat: string; lon: string }[])[0];
  return hit ? [Number(hit.lat), Number(hit.lon)] : null;
}

export async function areaCenter(districtId: number, neighborhoodId?: number | null) {
  const row = (await call<CenterRow>("api.Area_GetCenter", { DistrictId: districtId, NeighborhoodId: neighborhoodId ?? null }))[0];
  if (!row) return null;
  let district: [number, number] | null = row.DistrictLat != null ? [Number(row.DistrictLat), Number(row.DistrictLng)] : null;
  if (!district) {
    district = await searchPlace(`${row.District}, ${row.Province}`);
    if (district) await call("api.Area_SetCenter", { DistrictId: districtId, Latitude: district[0], Longitude: district[1] }).catch(() => {});
  }
  let hood: [number, number] | null = null;
  if (row.NeighborhoodId) {
    hood = row.NeighborhoodLat != null ? [Number(row.NeighborhoodLat), Number(row.NeighborhoodLng)] : null;
    if (!hood) {
      const plain = row.Neighborhood!.replace(/\s+Mahallesi$/u, "");
      hood = (await searchPlace(`${row.Neighborhood}, ${row.District}, ${row.Province}`)) ?? (await searchPlace(`${plain}, ${row.District}, ${row.Province}`));
      if (hood) await call("api.Area_SetCenter", { DistrictId: districtId, NeighborhoodId: row.NeighborhoodId, Latitude: hood[0], Longitude: hood[1] }).catch(() => {});
    }
  }
  return { district, neighborhood: hood, neighborhoodName: row.Neighborhood };
}
