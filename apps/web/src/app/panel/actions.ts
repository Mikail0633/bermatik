"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { AppError, call, callOne } from "@/lib/db";

// İşletme paneli işlemleri. Yetki kontrolü veritabanı işlemlerinin içinde
// (dükkân sahibi / personel / admin); burada yalnızca giriş zorunlu.

export type PanelState = { error?: string; ok?: string } | undefined;
const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());
const num = (v: FormDataEntryValue | null) => (v == null || v === "" ? null : Number(v));

async function run(fn: () => Promise<unknown>, ok: string, path = "/panel"): Promise<PanelState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath(path, "layout");
  return { ok };
}

// ---------------------------------------------------------------------
// İlan ver: yeni dükkân başvurusu (admin onayına düşer)
// ---------------------------------------------------------------------
const applySchema = z.object({
  name: z.string().min(2, "Dükkân adını yazın."),
  phone: z.string().min(10, "Dükkânın telefonunu yazın."),
  provinceId: z.number({ error: "İl seçin." }),
  districtId: z.number({ error: "İlçe seçin." }),
  neighborhoodId: z.number({ error: "Mahalle seçin." }),
  street: z.string().min(2, "Cadde/sokak yazın."),
  lat: z.number({ error: "Haritada dükkânınızın yerini işaretleyin." }),
  lng: z.number({ error: "Haritada dükkânınızın yerini işaretleyin." }),
});

export async function applyShop(_: PanelState, form: FormData): Promise<PanelState> {
  const user = await requireUser("/panel/yeni");
  const parsed = applySchema.safeParse({
    name: str(form.get("name")), phone: str(form.get("phone")), provinceId: num(form.get("provinceId")),
    districtId: num(form.get("districtId")), neighborhoodId: num(form.get("neighborhoodId")), street: str(form.get("street")),
    lat: num(form.get("lat")), lng: num(form.get("lng")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  let id: string | undefined;
  const r = await run(async () => {
    id = (await callOne<{ Id: string }>("api.Shop_Apply", {
      ActorId: user.Id, Segment: form.get("segment") === "kadin" ? "kadin" : "erkek", Name: d.name,
      Description: str(form.get("description")) || null, Phone: d.phone, ProvinceId: d.provinceId, DistrictId: d.districtId,
      NeighborhoodId: d.neighborhoodId, Street: d.street, BuildingNo: str(form.get("buildingNo")) || "-",
      AddressDetail: str(form.get("addressDetail")) || null, Latitude: d.lat, Longitude: d.lng,
    }))?.Id;
  }, "");
  if (r?.error || !id) return r;
  redirect(`/panel/${id}?yeni=1`);
}

// Dükkân bilgileri (sahip)
export async function updateShopInfo(_: PanelState, form: FormData): Promise<PanelState> {
  const user = await requireUser("/panel");
  const shopId = str(form.get("shopId"));
  return run(() => call("api.Shop_Update", {
    ActorId: user.Id, ShopId: shopId, Name: str(form.get("name")), Description: str(form.get("description")) || null,
    Phone: str(form.get("phone")), ProvinceId: num(form.get("provinceId")), DistrictId: num(form.get("districtId")),
    NeighborhoodId: num(form.get("neighborhoodId")), Street: str(form.get("street")), BuildingNo: str(form.get("buildingNo")) || "-",
    AddressDetail: str(form.get("addressDetail")) || null, Latitude: num(form.get("lat")), Longitude: num(form.get("lng")),
    IsTemporarilyClosed: form.get("isTemporarilyClosed") === "on", ShowServiceDescriptions: form.get("showServiceDescriptions") === "on",
    StoreEnabled: form.get("storeEnabled") === "on", QueueAvgMinutes: num(form.get("queueAvgMinutes")) ?? 20, // eski sıra sistemi alanı; formda gizli tutulur
    CoverImagePath: null, // kapak fotoğrafı ayrı yüklenir (api.Shop_SetCover)
  }), "Bilgiler kaydedildi.", `/panel/${shopId}`);
}

export async function saveShopHours(_: PanelState, form: FormData): Promise<PanelState> {
  const user = await requireUser("/panel");
  const hours = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    weekday: d, isClosed: form.get(`closed${d}`) === "on", opensAt: str(form.get(`open${d}`)) || null,
    closesAt: ["24:00", "23:59"].includes(str(form.get(`close${d}`))) ? "23:59:59" : str(form.get(`close${d}`)) || null,
  }));
  return run(() => call("api.ShopHours_Set", { ActorId: user.Id, ShopId: str(form.get("shopId")), HoursJson: JSON.stringify(hours) }), "Çalışma saatleri kaydedildi.");
}

// ---------------------------------------------------------------------
// Hizmetler ve fiyatlar
// ---------------------------------------------------------------------
export async function saveService(_: PanelState, form: FormData): Promise<PanelState> {
  const user = await requireUser("/panel");
  const price = Number(str(form.get("price")).replace(",", "."));
  if (!Number.isFinite(price)) return { error: "Fiyatı rakamla yazın." };
  return run(() => call("api.ShopService_Save", {
    ActorId: user.Id, ShopId: str(form.get("shopId")), ServiceId: str(form.get("serviceId")) || null,
    CategoryId: num(form.get("categoryId")), Name: str(form.get("name")), Description: str(form.get("description")) || null,
    Price: price, DurationMinutes: num(form.get("duration")), IsActive: form.get("isActive") !== "off", SortOrder: num(form.get("sortOrder")) ?? 0,
  }), "Hizmet kaydedildi.");
}

export async function deleteService(serviceId: string) {
  const user = await requireUser("/panel");
  return run(() => call("api.ShopService_Delete", { ActorId: user.Id, ServiceId: serviceId }), "Hizmet kaldırıldı.");
}

// ---------------------------------------------------------------------
// Personel
// ---------------------------------------------------------------------
export async function saveStaff(_: PanelState, form: FormData): Promise<PanelState> {
  const user = await requireUser("/panel");
  return run(() => call("api.Staff_Save", {
    ActorId: user.Id, ShopId: str(form.get("shopId")), StaffId: str(form.get("staffId")) || null,
    DisplayName: str(form.get("displayName")), Title: str(form.get("title")) || null, PhotoPath: null,
    IsActive: form.get("isActive") !== "off", Phone: str(form.get("phone")) || null, ShowPhone: form.get("showPhone") === "on",
  }), "Personel kaydedildi.");
}

export async function createInvite(staffId: string): Promise<PanelState & { code?: string }> {
  const user = await requireUser("/panel");
  try {
    const r = await callOne<{ InviteCode: string }>("api.Staff_CreateInvite", { ActorId: user.Id, StaffId: staffId });
    return { ok: "Davet kodu oluşturuldu.", code: r?.InviteCode };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}

export async function claimInvite(_: PanelState, form: FormData): Promise<PanelState> {
  const user = await requireUser("/panel");
  let shopId: string | undefined;
  const r = await run(async () => {
    shopId = (await callOne<{ ShopId: string }>("api.Staff_ClaimInvite", { ActorId: user.Id, Code: str(form.get("code")) }))?.ShopId;
  }, "Dükkâna personel olarak katıldınız.");
  if (r?.error || !shopId) return r;
  redirect(`/panel/${shopId}`);
}

export async function addDayOff(_: PanelState, form: FormData): Promise<PanelState> {
  const user = await requireUser("/panel");
  const wd = num(form.get("weekday"));
  return run(() => call("api.Staff_AddDayOff", {
    ActorId: user.Id, StaffId: str(form.get("staffId")), Weekday: wd,
    StartDate: wd ? null : str(form.get("startDate")) || null, EndDate: wd ? null : str(form.get("endDate")) || null, Note: str(form.get("note")) || null,
  }), "İzin eklendi.");
}

export async function removeDayOff(id: string) {
  const user = await requireUser("/panel");
  return run(() => call("api.Staff_RemoveDayOff", { ActorId: user.Id, DayOffId: id }), "İzin kaldırıldı.");
}

export async function saveBreaks(_: PanelState, form: FormData): Promise<PanelState> {
  const user = await requireUser("/panel");
  const start = str(form.get("breakStart")), end = str(form.get("breakEnd"));
  const json = start && end ? JSON.stringify([{ weekday: null, start, end }]) : "[]";
  return run(() => call("api.Staff_SetBreaks", { ActorId: user.Id, StaffId: str(form.get("staffId")), BreaksJson: json }), "Mola kaydedildi.");
}

// ---------------------------------------------------------------------
// Randevular
// ---------------------------------------------------------------------
export async function setAppointmentStatus(id: string, status: string) {
  const user = await requireUser("/panel");
  return run(() => call("api.Appointment_SetStatus", { ActorId: user.Id, AppointmentId: id, Status: status }), "Randevu güncellendi.");
}

export async function addPhoneBooking(_: PanelState, form: FormData): Promise<PanelState> {
  const user = await requireUser("/panel");
  const services = form.getAll("services").map(String);
  const start = str(form.get("date")) && str(form.get("time")) ? `${str(form.get("date"))}T${str(form.get("time"))}:00` : "";
  if (!services.length || !start) return { error: "Hizmet, gün ve saat seçin." };
  return run(() => call("api.Appointment_Book", {
    ActorId: user.Id, ShopId: str(form.get("shopId")), StaffId: str(form.get("staffId")), ServiceIdsJson: JSON.stringify(services),
    StartsAtLocal: start, Note: str(form.get("note")) || null, CustomerName: str(form.get("customerName")), CustomerPhone: str(form.get("customerPhone")),
  }), "Telefonla gelen randevu eklendi.");
}

// Kapalı günler (bayram, tadilat)
export async function addClosure(_: PanelState, form: FormData): Promise<PanelState> {
  const user = await requireUser("/panel");
  return run(() => call("api.ShopClosure_Add", {
    ActorId: user.Id, ShopId: str(form.get("shopId")), StartDate: str(form.get("startDate")), EndDate: str(form.get("endDate")) || str(form.get("startDate")),
    Reason: str(form.get("reason")) || null,
  }), "Kapalı gün eklendi.");
}

export async function removeClosure(id: string) {
  const user = await requireUser("/panel");
  return run(() => call("api.ShopClosure_Remove", { ActorId: user.Id, ClosureId: id }), "Kapalı gün kaldırıldı.");
}

// ---------------------------------------------------------------------
// Müşterilere hazır mesaj (yalnızca dükkân sahibi / admin; kurallar veritabanında)
// ---------------------------------------------------------------------
export async function previewShopCampaign(shopId: string, onlyDue: boolean): Promise<{ count?: number; error?: string }> {
  const user = await requireUser("/panel");
  try {
    const r = await callOne<{ RecipientCount: number }>("api.Campaign_PreviewCount", { ActorId: user.Id, ShopId: shopId, OnlyDue: onlyDue });
    return { count: r?.RecipientCount ?? 0 };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}

export async function sendShopCampaign(shopId: string, templateId: number, onlyDue: boolean): Promise<PanelState> {
  const user = await requireUser("/panel");
  try {
    const r = await callOne<{ RecipientCount: number }>("api.Campaign_Send", { ActorId: user.Id, ShopId: shopId, TemplateId: templateId, OnlyDue: onlyDue });
    revalidatePath(`/panel/${shopId}/mesajlar`);
    return { ok: `Mesajınız ${r?.RecipientCount ?? 0} müşterinize gönderildi.` };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}
