"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

// Admin, işletme panelini dükkân sahibinin ya da personelin gözüyle görebilir
export async function setPanelView(view: "sahip" | "personel") {
  await requireAdmin();
  (await cookies()).set("bm_gorunum", view, { path: "/panel", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/panel", "layout");
}

// Hesabım menüsünden: görünümü seç ve işletme paneline geç
export async function openPanel(view: "sahip" | "personel") {
  await setPanelView(view);
  redirect("/panel");
}
