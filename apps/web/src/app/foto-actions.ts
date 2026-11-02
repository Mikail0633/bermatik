"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { AppError, call, callOne } from "@/lib/db";
import { deletePublicPhoto, savePublicPhoto } from "@/lib/uploads";

// Kapak, personel ve galeri fotoğrafları. Yetki kontrolü veritabanı işlemlerinde.
export type FotoState = { error?: string; ok?: string } | undefined;
const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());

// Yeni dosyayı kaydet → veritabanına yaz → eski dosyayı sil. Veritabanı reddederse yeni dosya silinir.
async function replacePhoto(form: FormData, write: (path: string | null) => Promise<{ OldPath: string | null } | undefined>, remove: boolean, ok: string): Promise<FotoState> {
  await requireUser("/panel");
  let path: string | null = null;
  if (!remove) {
    const saved = await savePublicPhoto(form.get("file") as File | null);
    if (saved.error) return { error: saved.error };
    path = saved.path!;
  }
  try {
    const row = await write(path);
    await deletePublicPhoto(row?.OldPath);
  } catch (e) {
    await deletePublicPhoto(path);
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok };
}

export async function setShopCover(_: FotoState, form: FormData): Promise<FotoState> {
  const user = await requireUser("/panel");
  const remove = form.get("remove") === "1";
  return replacePhoto(form, (Path) => callOne("api.Shop_SetCover", { ActorId: user.Id, ShopId: str(form.get("shopId")), Path }),
    remove, remove ? "Kapak fotoğrafı kaldırıldı." : "Kapak fotoğrafı güncellendi.");
}

export async function setStaffPhoto(_: FotoState, form: FormData): Promise<FotoState> {
  const user = await requireUser("/panel");
  const remove = form.get("remove") === "1";
  return replacePhoto(form, (Path) => callOne("api.Staff_SetPhoto", { ActorId: user.Id, StaffId: str(form.get("staffId")), Path }),
    remove, remove ? "Fotoğraf kaldırıldı." : "Fotoğraf güncellendi.");
}

export async function addGalleryPhoto(_: FotoState, form: FormData): Promise<FotoState> {
  const user = await requireUser("/panel");
  const saved = await savePublicPhoto(form.get("file") as File | null);
  if (saved.error) return { error: saved.error };
  try {
    await call("api.Gallery_Add", {
      ActorId: user.Id, ShopId: str(form.get("shopId")), Path: saved.path,
      Caption: str(form.get("caption")).slice(0, 150) || null, StaffId: str(form.get("staffId")) || null,
    });
  } catch (e) {
    await deletePublicPhoto(saved.path);
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: "Fotoğraf galeriye eklendi." };
}

export async function removeGalleryPhoto(form: FormData) {
  const user = await requireUser("/panel");
  const row = await callOne<{ Path: string }>("api.Gallery_Remove", { ActorId: user.Id, PhotoId: str(form.get("photoId")) });
  await deletePublicPhoto(row?.Path);
  revalidatePath("/", "layout");
}
