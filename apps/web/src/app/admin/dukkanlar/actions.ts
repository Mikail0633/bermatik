"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { AppError, call, callOne } from "@/lib/db";

export type ActionState = { error?: string; ok?: string } | undefined;

const num = (v: FormDataEntryValue | null) => (v == null || v === "" ? null : Number(v));
const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());

const shopSchema = z.object({
  name: z.string().min(2, "Dükkân adını yazın."),
  provinceId: z.number({ error: "İl seçin." }).int(),
  districtId: z.number({ error: "İlçe seçin." }).int(),
  neighborhoodId: z.number({ error: "Mahalle seçin." }).int(),
  street: z.string().min(2, "Cadde/sokak yazın."),
  lat: z.number({ error: "Haritada dükkânın yerini işaretleyin." }),
  lng: z.number({ error: "Haritada dükkânın yerini işaretleyin." }),
});

function readShop(form: FormData) {
  const raw = {
    name: str(form.get("name")),
    provinceId: num(form.get("provinceId")),
    districtId: num(form.get("districtId")),
    neighborhoodId: num(form.get("neighborhoodId")),
    street: str(form.get("street")),
    lat: num(form.get("lat")),
    lng: num(form.get("lng")),
  };
  const parsed = shopSchema.safeParse(raw);
  return {
    parsed,
    extra: {
      Description: str(form.get("description")) || null,
      Phone: str(form.get("phone")) || null,
      BuildingNo: str(form.get("buildingNo")) || null,
      AddressDetail: str(form.get("addressDetail")) || null,
    },
  };
}

async function run(fn: () => Promise<unknown>, ok: string): Promise<ActionState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok };
}

export async function createShop(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { parsed, extra } = readShop(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const segment = form.get("segment") === "kadin" ? "kadin" : "erkek";
  let id: string | undefined;
  const res = await run(async () => {
    const row = await callOne<{ Id: string }>("api.Admin_Shop_Create", {
      ActorId: admin.Id, Segment: segment, Name: d.name, ProvinceId: d.provinceId, DistrictId: d.districtId,
      NeighborhoodId: d.neighborhoodId, Street: d.street, Latitude: d.lat, Longitude: d.lng, ...extra,
    });
    id = row?.Id;
    // Eksik dükkân bildiriminden geldiyse bildirimi "eklendi" yap
    const sid = str(form.get("suggestionId"));
    if (id && sid) await call("api.Admin_Suggestion_Resolve", { ActorId: admin.Id, SuggestionId: sid, Status: "added", CreatedShopId: id });
  }, "Dükkân eklendi.");
  if (res?.error || !id) return res;
  redirect(`/admin/dukkanlar/${id}?kaydedildi=1`);
}

export async function updateShop(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const shopId = str(form.get("shopId"));
  const { parsed, extra } = readShop(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  return run(
    () => call("api.Shop_Update", {
      ActorId: admin.Id, ShopId: shopId, Name: d.name, Description: extra.Description, Phone: extra.Phone ?? "",
      ProvinceId: d.provinceId, DistrictId: d.districtId, NeighborhoodId: d.neighborhoodId, Street: d.street,
      BuildingNo: extra.BuildingNo ?? "-", AddressDetail: extra.AddressDetail, Latitude: d.lat, Longitude: d.lng,
      IsTemporarilyClosed: form.get("isTemporarilyClosed") === "on",
      ShowServiceDescriptions: form.get("showServiceDescriptions") === "on",
      StoreEnabled: form.get("storeEnabled") === "on",
      QueueAvgMinutes: num(form.get("queueAvgMinutes")) ?? 20,
      CoverImagePath: null, // kapak fotoğrafı ayrı yüklenir (api.Shop_SetCover)
    }),
    "Değişiklikler kaydedildi.",
  );
}

export async function setStatus(shopId: string, status: string, reason?: string) {
  const admin = await requireAdmin();
  return run(() => call("api.Admin_Shop_SetStatus", { ActorId: admin.Id, ShopId: shopId, Status: status, Reason: reason ?? null }), "Durum güncellendi.");
}

export async function setSegment(shopId: string, segment: "erkek" | "kadin") {
  const admin = await requireAdmin();
  return run(() => call("api.Admin_Shop_SetSegment", { ActorId: admin.Id, ShopId: shopId, Segment: segment }), "Bölüm değiştirildi.");
}

export async function markReviewed(shopId: string) {
  const admin = await requireAdmin();
  return run(() => call("api.Admin_Shop_MarkReviewed", { ActorId: admin.Id, ShopId: shopId }), "Kontrol edildi olarak işaretlendi.");
}

export async function assignOwner(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  return run(
    () => call("api.Admin_Shop_AssignOwner", { ActorId: admin.Id, ShopId: str(form.get("shopId")), OwnerEmail: str(form.get("email")) }),
    "Dükkân bu kullanıcıya devredildi.",
  );
}

export async function saveHours(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const hours = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    weekday: d,
    isClosed: form.get(`closed${d}`) === "on",
    opensAt: str(form.get(`open${d}`)) || null,
    closesAt: ["24:00", "23:59"].includes(str(form.get(`close${d}`))) ? "23:59:59" : str(form.get(`close${d}`)) || null,
  }));
  return run(
    () => call("api.ShopHours_Set", { ActorId: admin.Id, ShopId: str(form.get("shopId")), HoursJson: JSON.stringify(hours) }),
    "Çalışma saatleri kaydedildi.",
  );
}

export async function deleteShop(shopId: string) {
  const admin = await requireAdmin();
  let result: string | undefined;
  const res = await run(async () => {
    result = (await callOne<{ Result: string }>("api.Admin_Shop_Delete", { ActorId: admin.Id, ShopId: shopId }))?.Result;
  }, "");
  if (res?.error) return res;
  if (result === "deleted") redirect("/admin/dukkanlar?silindi=1");
  return { ok: "Dükkânın geçmiş kayıtları olduğu için silinmedi, askıya alındı." };
}

// ---------------------------------------------------------------------
// Sahiplenme talepleri ve eksik dükkân bildirimleri
// ---------------------------------------------------------------------
export async function resolveClaim(claimId: string, approve: boolean, note?: string) {
  const admin = await requireAdmin();
  return run(() => call("api.Admin_Claim_Resolve", { ActorId: admin.Id, ClaimId: claimId, Approve: approve, Note: note ?? null }),
    approve ? "Onaylandı; dükkân talep edene devredildi." : "Talep reddedildi.");
}

export async function dismissSuggestion(id: string) {
  const admin = await requireAdmin();
  return run(() => call("api.Admin_Suggestion_Resolve", { ActorId: admin.Id, SuggestionId: id, Status: "dismissed" }), "Bildirim kapatıldı.");
}
