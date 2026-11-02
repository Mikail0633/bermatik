"use server";

import { AppError, call } from "@/lib/db";
import { verifyUnsubscribe } from "@/lib/ileti";

export type RetState = { error?: string; ok?: string } | undefined;

export async function unsubscribe(_: RetState, form: FormData): Promise<RetState> {
  const ok = verifyUnsubscribe(String(form.get("u") ?? ""), String(form.get("k") ?? ""), String(form.get("i") ?? ""));
  if (!ok) return { error: "Bağlantı geçersiz." };
  try {
    await call("api.Consent_Unsubscribe", { UserId: ok.userId, Channel: ok.channel });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  return { ok: `Tamam, artık Bermatik'ten kampanya ${ok.channel === "MESAJ" ? "SMS" : "e-posta"} iletisi almayacaksınız.` };
}
