"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser, requireUser } from "@/lib/auth";
import { AppError, call, callOne } from "@/lib/db";
import { deletePublicPhoto, savePublicPhoto } from "@/lib/uploads";

// Mağaza: ürünler (sahip, personel, admin), siparişler (müşteri verir, dükkân hazırlar; ödeme salonda).
// Yetki ve stok kuralları veritabanı işlemlerinde.
export type MagazaState = { error?: string; ok?: string } | undefined;
const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());

async function run(fn: () => Promise<unknown>, ok: string): Promise<MagazaState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok };
}

// ---------------- Ürünler ----------------
export async function saveProduct(_: MagazaState, form: FormData): Promise<MagazaState> {
  const user = await requireUser("/panel");
  const price = Number(str(form.get("price")).replace(",", "."));
  const stock = Number(str(form.get("stock")));
  const name = str(form.get("name"));
  if (name.length < 2) return { error: "Ürün adını yazın." };
  if (!Number.isFinite(price) || price <= 0 || price > 100000) return { error: "Geçerli bir fiyat yazın." };
  if (!Number.isInteger(stock) || stock < 0 || stock > 10000) return { error: "Stok 0 ile 10.000 arasında bir sayı olmalı." };
  const productId = str(form.get("productId")) || null;
  return run(() => call("api.Product_Save", {
    ActorId: user.Id, ShopId: str(form.get("shopId")), ProductId: productId, Name: name.slice(0, 100),
    Description: str(form.get("description")).slice(0, 1000) || null, Price: price, Stock: stock, IsActive: form.get("isActive") !== "off",
  }), productId ? "Ürün kaydedildi." : "Ürün eklendi. Şimdi fotoğraflarını ekleyebilirsiniz.");
}

export async function deleteProduct(productId: string): Promise<MagazaState> {
  const user = await requireUser("/panel");
  // Fotoğraflar ürünle birlikte silinir; dosyaları da diskten kaldırılır
  const imgs = await call<{ Path: string }>("api.Product_Images", { ProductId: productId, ActorId: user.Id });
  const r = await run(() => call("api.Product_Delete", { ActorId: user.Id, ProductId: productId }), "Ürün silindi.");
  if (!r?.error) {
    const still = await call<{ Id: string }>("api.Product_Images", { ProductId: productId, ActorId: user.Id });
    if (still.length === 0) await Promise.all(imgs.map((i) => deletePublicPhoto(i.Path)));
  }
  return r;
}

export async function addProductImage(_: MagazaState, form: FormData): Promise<MagazaState> {
  const user = await requireUser("/panel");
  const saved = await savePublicPhoto(form.get("file") as File | null);
  if (saved.error) return { error: saved.error };
  const r = await run(() => call("api.Product_AddImage", { ActorId: user.Id, ProductId: str(form.get("productId")), Path: saved.path }), "Fotoğraf eklendi.");
  if (r?.error) await deletePublicPhoto(saved.path);
  return r;
}

export async function setProductCover(imageId: string): Promise<MagazaState> {
  const user = await requireUser("/panel");
  return run(() => call("api.Product_SetCoverImage", { ActorId: user.Id, ImageId: imageId }), "Vitrin fotoğrafı seçildi.");
}

export async function removeProductImage(imageId: string): Promise<MagazaState> {
  const user = await requireUser("/panel");
  let path: string | undefined;
  const r = await run(async () => { path = (await callOne<{ Path: string }>("api.Product_RemoveImage", { ActorId: user.Id, ImageId: imageId }))?.Path; }, "Fotoğraf silindi.");
  await deletePublicPhoto(path);
  return r;
}

// Ziyaretçi ürün fotoğraflarına bakarken (satış açıksa)
export async function productImages(productId: string): Promise<{ Id: string; Path: string }[]> {
  const user = await getUser();
  return call("api.Product_Images", { ProductId: productId, ActorId: user?.Id ?? null });
}

// ---------------- Siparişler ----------------
export async function placeOrder(shopId: string, items: { productId: string; quantity: number }[], note: string, back: string): Promise<MagazaState> {
  const user = await getUser();
  if (!user) redirect(`/giris?sonra=${encodeURIComponent(back)}`);
  if (!Array.isArray(items) || items.length === 0) return { error: "Sepetiniz boş." };
  try {
    await call("api.Order_Place", {
      ActorId: user.Id, ShopId: shopId, Note: note.trim().slice(0, 500) || null,
      ItemsJson: JSON.stringify(items.map((i) => ({ productId: String(i.productId), quantity: Math.trunc(Number(i.quantity)) }))),
    });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/siparislerim");
  redirect("/siparislerim?yeni=1");
}

export async function setOrderStatus(orderId: string, status: "ready" | "picked_up" | "cancelled"): Promise<MagazaState> {
  const user = await requireUser("/panel");
  const label = { ready: "Sipariş hazır; müşteriye haber verildi.", picked_up: "Teslim edildi olarak işaretlendi.", cancelled: "Sipariş iptal edildi." }[status];
  return run(() => call("api.Order_SetStatus", { ActorId: user.Id, OrderId: orderId, Status: status }), label);
}

export async function cancelMyOrder(orderId: string): Promise<MagazaState> {
  const user = await requireUser("/siparislerim");
  return run(() => call("api.Order_SetStatus", { ActorId: user.Id, OrderId: orderId, Status: "cancelled" }), "Siparişiniz iptal edildi.");
}
