"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sendAdminDocumentAlert } from "@/lib/welcome-mail";
import { rateLimit, requireUser } from "@/lib/auth";
import { AppError, call } from "@/lib/db";
import { deletePrivateFile, savePrivateFile } from "@/lib/uploads";
import { verifyDocumentForm } from "@/lib/doc-verify";

export type BelgeState = { error?: string; ok?: string } | undefined;

// Dükkân sahipliği belgesi: bekleyen dükkân başvurusuna (shopId), sahiplenme talebine (claimId)
// ya da ikisi de yoksa doğrudan işletme hesabına. Numara türüne göre kontrol edilir; kimlik nüfustan sorgulanır.
export async function uploadOwnerDocument(target: { shopId?: string; claimId?: string }, form: FormData): Promise<BelgeState> {
  const user = await requireUser("/panel");
  if (!(await rateLimit("belge", 10, 3_600_000))) return { error: "Çok fazla belge denemesi yaptınız. Bir saat sonra tekrar deneyin." };
  const by = String(form.get("birthYear") ?? "").trim();
  const birthYear = user.BirthYear ?? (/^(19|20)\d{2}$/.test(by) ? Number(by) : null);
  const v = await verifyDocumentForm(form, { firstName: user.FirstName, lastName: user.LastName, birthYear });
  if (!v.doc) return { error: v.error };
  try {
    await call("api.OwnerDocument_Add", { ActorId: user.Id, ShopId: target.shopId ?? null, ClaimId: target.claimId ?? null, ...v.doc });
  } catch (e) {
    await v.discard();
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/panel", "layout");
  revalidatePath("/dogrula");
  const isAccount = !target.shopId && !target.claimId;
  if (isAccount) {
    const doc = v.doc;
    after(() => sendAdminDocumentAlert(`${user.FirstName} ${user.LastName}`, doc.Kind, doc.NviResult === "dogru")
      .catch((e) => console.error("Admin belge e-postası:", e)));
  }
  if (isAccount && v.doc.NviResult === "dogru") return { ok: "Kimliğiniz nüfus kayıtlarıyla doğrulandı. İşletme paneliniz açıldı." };
  return { ok: isAccount ? "Belgeniz alındı. Bermatik ekibi inceleyip onaylayınca işletme paneliniz açılacak." : "Belgeniz yüklendi. Bermatik ekibi inceleyip onaylayacak." };
}

export async function uploadAccountDocument(_: BelgeState, form: FormData): Promise<BelgeState> {
  return uploadOwnerDocument({}, form);
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
