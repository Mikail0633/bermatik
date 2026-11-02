"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { AppError, call, callOne } from "@/lib/db";
import { reverseGeocode } from "@/lib/geo";

export type QuickState = { error?: string; ok?: string; warn?: string; shopId?: string; name?: string } | undefined;
const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());

// Sahada hızlı ekleme: konum telefondan, adres konumdan bulunur; yalnızca ad (+ telefon) yazılır
export async function quickAddShop(_: QuickState, form: FormData): Promise<QuickState> {
  const admin = await requireAdmin();
  const lat = Number(form.get("lat")), lng = Number(form.get("lng"));
  const name = str(form.get("name"));
  const segment = form.get("segment") === "kadin" ? "kadin" : "erkek";
  if (!form.get("lat") || !Number.isFinite(lat) || !Number.isFinite(lng)) return { error: "Önce konumu alın (\"Buradayım\")." };
  if (name.length < 2) return { error: "Dükkânın adını yazın." };

  // Aynı yerde zaten kayıtlı dükkân var mı? (yaklaşık 40 m)
  if (form.get("force") !== "1") {
    const near = [
      ...(await call<{ Name: string; DistanceKm: number }>("api.Shop_Search", { Segment: "erkek", Latitude: lat, Longitude: lng, RadiusKm: 1, Limit: 3 })),
      ...(await call<{ Name: string; DistanceKm: number }>("api.Shop_Search", { Segment: "kadin", Latitude: lat, Longitude: lng, RadiusKm: 1, Limit: 3 })),
    ].filter((s) => Number(s.DistanceKm) <= 0.04);
    if (near.length) return { warn: `Hemen yakında zaten "${near.map((n) => n.Name).join('", "')}" kayıtlı. Aynı dükkânsa eklemeyin; farklıysa "Yine de ekle"ye basın.` };
  }

  const a = await reverseGeocode(lat, lng);
  if (!a.provinceId || !a.districtId) return { error: "Bu konumun ilçesi bulunamadı. Haritada işareti biraz kaydırıp tekrar deneyin." };
  let hoodId = a.neighborhoodId;
  if (!hoodId) hoodId = (await callOne<{ Id: number }>("api.Area_NearestNeighborhood", { DistrictId: a.districtId, Latitude: lat, Longitude: lng }))?.Id ?? null;
  if (!hoodId) {
    const hoods = await call<{ Id: number }>("api.Lookup_Neighborhoods", { DistrictId: a.districtId });
    hoodId = hoods[0]?.Id ?? null;
  }
  if (!hoodId) return { error: "Mahalle bulunamadı; tam formdan ekleyin." };

  try {
    const row = await callOne<{ Id: string }>("api.Admin_Shop_Create", {
      ActorId: admin.Id, Segment: segment, Name: name, Phone: str(form.get("phone")) || null,
      ProvinceId: a.provinceId, DistrictId: a.districtId, NeighborhoodId: hoodId,
      Street: a.street ?? "—", BuildingNo: a.houseNumber ?? null, AddressDetail: str(form.get("note")) || null,
      Latitude: lat, Longitude: lng,
    });
    revalidatePath("/", "layout");
    return { ok: `"${name}" eklendi.`, shopId: row?.Id, name };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}
