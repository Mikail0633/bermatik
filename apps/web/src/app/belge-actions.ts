"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { AppError, call } from "@/lib/db";
import { deletePrivateFile, savePrivateFile } from "@/lib/uploads";

export type BelgeState = { error?: string; ok?: string } | undefined;
const KINDS = ["vergi_levhasi", "esnaf_kaydi", "diger"];

// Dükkân sahipliği belgesi: bekleyen dükkân başvurusuna (shopId) veya sahiplenme talebine (claimId)
export async function uploadOwnerDocument(target: { shopId?: string; claimId?: string }, form: FormData): Promise<BelgeState> {
  const user = await requireUser("/panel");
  const kind = String(form.get("kind") ?? "");
  if (!KINDS.includes(kind)) return { error: "Belge türünü seçin." };
  const saved = await savePrivateFile(form.get("file") as File, "dogrulama");
  if (saved.error) return { error: saved.error };
  try {
    await call("api.OwnerDocument_Add", { ActorId: user.Id, ShopId: target.shopId ?? null, ClaimId: target.claimId ?? null, Kind: kind, FilePath: saved.path });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/panel", "layout");
  return { ok: "Belgeniz yüklendi. Bermatik ekibi inceleyip onaylayacak." };
}

export async function uploadShopDocument(_: BelgeState, form: FormData): Promise<BelgeState> {
  return uploadOwnerDocument({ shopId: String(form.get("shopId") ?? "") }, form);
}

// Ustalık / kalfalık belgesi (isteğe bağlı): admin onaylayınca dükkân sayfasında "Belgeli usta" rozeti
const CERT_TYPES = ["ciraklik", "kalfalik", "ustalik", "usta_ogreticilik", "diger"];

export async function uploadCertificate(_: BelgeState, form: FormData): Promise<BelgeState> {
  const user = await requireUser("/panel/belgelerim");
  const type = String(form.get("type") ?? "");
  const serial = String(form.get("serialNo") ?? "").trim();
  const issuedBy = String(form.get("issuedBy") ?? "").trim().slice(0, 120);
  if (!CERT_TYPES.includes(type)) return { error: "Belge türünü seçin." };
  if (serial.length < 3 || serial.length > 50) return { error: "Belgedeki seri numarasını yazın." };
  const saved = await savePrivateFile(form.get("file") as File, "ustalik");
  if (saved.error) return { error: saved.error };
  try {
    await call("api.Certificate_Add", { ActorId: user.Id, Type: type, SerialNo: serial, IssuedBy: issuedBy || null, FilePath: saved.path });
  } catch (e) {
    await deletePrivateFile(saved.path);
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/panel/belgelerim");
  return { ok: "Belgeniz yüklendi. Bermatik ekibi kontrol edip onaylayınca dükkân sayfanızda “Belgeli usta” rozeti çıkar." };
}
