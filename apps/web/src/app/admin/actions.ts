"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { AppError, call, callOne } from "@/lib/db";

// Kullanıcılar, yorumlar, şikayetler, belgeler ve ayarlar için admin işlemleri
export type AdminState = { error?: string; ok?: string } | undefined;
const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());

async function run(proc: `api.${string}`, params: Record<string, unknown>, ok: string): Promise<AdminState> {
  const admin = await requireAdmin();
  try {
    await call(proc, { ActorId: admin.Id, ...params });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin", "layout");
  return { ok };
}

export async function setUserRole(userId: string, role: string) {
  if (!["customer", "shop_owner", "staff", "admin"].includes(role)) return { error: "Rol geçersiz." };
  return run("api.Admin_User_SetRole", { UserId: userId, Role: role }, "Rol değişti; kullanıcı tekrar giriş yapacak.");
}

export async function setUserActive(userId: string, active: boolean) {
  return run("api.Admin_User_SetActive", { UserId: userId, IsActive: active }, active ? "Engel kaldırıldı." : "Kullanıcı engellendi.");
}

export async function setReviewHidden(reviewId: string, hidden: boolean) {
  return run("api.Admin_Review_SetHidden", { ReviewId: reviewId, Hidden: hidden }, hidden ? "Yorum gizlendi." : "Yorum tekrar görünür.");
}

export async function resolveReport(reportId: string, status: "resolved" | "dismissed", note?: string) {
  return run("api.Admin_Report_Resolve", { ReportId: reportId, Status: status, Note: note ?? null }, "Şikayet kapatıldı.");
}

export async function reviewCertificate(id: string, status: "verified" | "rejected", note?: string) {
  return run("api.Admin_Certificate_Review", { CertificateId: id, Status: status, Note: note ?? null }, status === "verified" ? "Belge onaylandı." : "Belge reddedildi.");
}

export async function setPlatformSetting(key: "ReviewsEnabled" | "StoreEnabled" | "ServiceDescriptionsEnabled" | "CommercialConsentEnabled", value: boolean) {
  return run("api.Admin_Settings_Update", { [key]: value }, "Ayar kaydedildi.");
}

export async function saveCategory(_: AdminState, form: FormData): Promise<AdminState> {
  const revisit = str(form.get("revisitDays"));
  return run("api.Admin_ServiceCategory_Save", {
    CategoryId: str(form.get("categoryId")) ? Number(form.get("categoryId")) : null,
    Segment: form.get("segment") === "kadin" ? "kadin" : "erkek",
    Slug: str(form.get("slug")), Name: str(form.get("name")), Description: str(form.get("description")) || null,
    SortOrder: Number(str(form.get("sortOrder")) || 0), IsActive: form.get("isActive") === "on",
    RevisitDays: revisit ? Number(revisit) : null,
  }, "Kategori kaydedildi.");
}

export async function saveTemplate(_: AdminState, form: FormData): Promise<AdminState> {
  return run("api.Admin_Template_Save", {
    TemplateId: str(form.get("templateId")) ? Number(form.get("templateId")) : null,
    Title: str(form.get("title")), Body: str(form.get("body")),
    IsActive: form.get("isActive") === "on", SortOrder: Number(str(form.get("sortOrder")) || 0),
    Segment: ["erkek", "kadin"].includes(str(form.get("segment"))) ? str(form.get("segment")) : null,
  }, "Mesaj kaydedildi.");
}

// Hızlı kontrol: dükkânı sil (geçmişi varsa askıya alınır); sayfa yönlendirmeden sıradakine geçer
export async function removeShopQuick(shopId: string): Promise<AdminState> {
  const admin = await requireAdmin();
  try {
    const r = await callOne<{ Result: string }>("api.Admin_Shop_Delete", { ActorId: admin.Id, ShopId: shopId });
    revalidatePath("/", "layout");
    return { ok: r?.Result === "deleted" ? "Dükkân silindi." : "Geçmiş kayıtları olduğu için askıya alındı." };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}

// Bermatik duyurusu: tüm müşterilere veya bir bölüm / ile
export async function sendAnnouncement(_: AdminState, form: FormData): Promise<AdminState & { sent?: number }> {
  const admin = await requireAdmin();
  const seg = str(form.get("segment"));
  const prov = str(form.get("provinceId"));
  try {
    const r = await callOne<{ RecipientCount: number }>("api.Campaign_Send", {
      ActorId: admin.Id, ShopId: null, TemplateId: null, Title: str(form.get("title")), Body: str(form.get("body")), OnlyDue: false,
      Segment: seg === "erkek" || seg === "kadin" ? seg : null, ProvinceId: prov ? Number(prov) : null,
    });
    revalidatePath("/admin/duyurular");
    return { ok: `Duyuru ${r?.RecipientCount ?? 0} kişiye gönderildi.`, sent: r?.RecipientCount ?? 0 };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}

// Duyuru gönderilmeden önce kaç kişiye gideceği
export async function previewAnnouncement(segment: string, provinceId: string): Promise<number> {
  const admin = await requireAdmin();
  const r = await callOne<{ RecipientCount: number }>("api.Campaign_PreviewCount", {
    ActorId: admin.Id, ShopId: null, OnlyDue: false,
    Segment: segment === "erkek" || segment === "kadin" ? segment : null, ProvinceId: provinceId ? Number(provinceId) : null,
  });
  return r?.RecipientCount ?? 0;
}

// Dükkân sahipliği belgesi: uygun / uygun değil
export async function reviewOwnerDocument(id: string, status: "approved" | "rejected", note?: string) {
  return run("api.Admin_OwnerDocument_Review", { DocumentId: id, Status: status, Note: note ?? null }, status === "approved" ? "Belge uygun bulundu." : "Belge reddedildi.");
}

// Admin yönetimi: katılmamış dükkânı aktif yap (online randevu açılır) / pasif yap / işletme paneline al
export async function setShopActive(shopId: string, active: boolean) {
  return run("api.Admin_Shop_SetActive", { ShopId: shopId, Active: active }, active ? "Dükkân aktif: online randevu açıldı." : "Dükkân pasif: online randevu kapandı.");
}

export async function takeOverShop(shopId: string) {
  return run("api.Admin_Shop_TakeOver", { ShopId: shopId }, "Dükkân işletme panelinize eklendi.");
}
