"use server";

import { revalidatePath } from "next/cache";
import { getUser, requireAdmin, requireUser } from "@/lib/auth";
import { AppError, call } from "@/lib/db";
import { isBot } from "@/lib/bot";

// Bermatik'e katılmamış dükkânlar için randevu TALEBİ: Bermatik ekibi dükkânı arayıp ayarlar
export type RequestState = { error?: string; ok?: string } | undefined;
const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());

export async function createRequest(_: RequestState, form: FormData): Promise<RequestState> {
  const user = await getUser();
  if (!user) return { error: "Talep bırakmak için giriş yapın." };
  const bot = await isBot(form, "randevu-talebi");
  if (bot) return { error: bot };
  const day = str(form.get("day")), time = str(form.get("time"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Gün ve saat seçin." };
  const when = `${day}T${time}:00`;
  try {
    await call("api.Request_Create", {
      ActorId: user.Id, ShopId: str(form.get("shopId")), Kind: "randevu", CategoryId: Number(form.get("categoryId")) || null,
      PreferredAtLocal: when, Note: str(form.get("note")) || null,
    });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/randevularim");
  return { ok: "Talebiniz alındı! Dükkânı arayıp sizin için ayarlayacağız; onaylanınca bildirim gelecek ve Randevularım'da görünecek." };
}

export async function cancelRequest(id: string): Promise<RequestState> {
  const user = await requireUser("/randevularim");
  try {
    await call("api.Request_Cancel", { ActorId: user.Id, RequestId: id });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/randevularim");
  return { ok: "Talep iptal edildi." };
}

// Admin: dükkânla görüştükten sonra onayla (kesin saatle) / reddet
export async function resolveRequest(_: RequestState, form: FormData): Promise<RequestState> {
  const admin = await requireAdmin();
  const status = form.get("status") === "rejected" ? "rejected" : "confirmed";
  const at = str(form.get("at"));
  try {
    await call("api.Admin_Request_Resolve", {
      ActorId: admin.Id, RequestId: str(form.get("requestId")), Status: status,
      ConfirmedAtLocal: status === "confirmed" && at ? `${at}:00` : null, Note: str(form.get("note")) || null,
    });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin", "layout");
  return { ok: status === "confirmed" ? "Onaylandı; müşteriye bildirim gitti." : "Reddedildi; müşteriye bildirim gitti." };
}
