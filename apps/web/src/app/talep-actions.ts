"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AppError, call, callOne } from "@/lib/db";
import { uploadOwnerDocument } from "./belge-actions";
import { isBot } from "@/lib/bot";

export type TalepState = { error?: string; ok?: string } | undefined;

async function run(fn: () => Promise<unknown>, ok: string): Promise<TalepState> {
  try {
    await fn();
    return { ok };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}

// "Bu dükkân sizin mi?"
export async function createClaim(_: TalepState, form: FormData): Promise<TalepState> {
  const shopId = String(form.get("shopId") ?? "");
  const user = await getUser();
  if (!user) redirect(`/giris?sonra=${encodeURIComponent(`/isletme?sahiplen=${shopId}`)}`);
  const file = form.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Vergi levhası veya esnaf odası kaydınızın fotoğrafını ekleyin." };
  let claimId: string | undefined;
  const r = await run(async () => {
    claimId = (await callOne<{ Id: string }>("api.Claim_Create", {
      ActorId: user.Id, ShopId: shopId, Phone: String(form.get("phone") ?? ""), Note: String(form.get("note") ?? "") || null,
    }))?.Id;
  }, "");
  if (r?.error || !claimId) return r;
  const doc = await uploadOwnerDocument({ claimId }, form);
  if (doc?.error) return { error: `Talebiniz alındı ama belge yüklenemedi: ${doc.error}` };
  return { ok: "Talebiniz ve belgeniz alındı! Belgenizi inceleyip gerekirse sizi arayacağız; onaylanınca bildirim alacaksınız." };
}

// "Eksik dükkân bildir"
export async function createSuggestion(_: TalepState, form: FormData): Promise<TalepState> {
  const user = await getUser();
  if (!user) redirect(`/giris?sonra=${encodeURIComponent("/oneri")}`);
  const bot = await isBot(form, "oneri");
  if (bot) return { error: bot };
  const lat = Number(form.get("lat")), lng = Number(form.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !form.get("lat")) return { error: "Dükkânın yerini haritada işaretleyin." };
  return run(
    () => call("api.Suggestion_Create", {
      ActorId: user.Id, Segment: form.get("segment") === "kadin" ? "kadin" : "erkek", Name: String(form.get("name") ?? ""),
      Phone: String(form.get("phone") ?? "") || null, Latitude: lat, Longitude: lng, Note: String(form.get("note") ?? "") || null,
    }),
    "Teşekkürler! Bildiriminiz incelenip kısa sürede siteye eklenecek.",
  );
}
