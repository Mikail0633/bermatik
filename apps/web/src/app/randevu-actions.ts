"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AppError, call, callOne } from "@/lib/db";

export type BookState = { error?: string } | undefined;

// Randevu al (giriş yoksa giriş sayfasına, sonra randevu ekranına geri döner)
export async function bookAppointment(_: BookState, form: FormData): Promise<BookState> {
  const back = String(form.get("back") ?? "/");
  const user = await getUser();
  if (!user) redirect(`/giris?sonra=${encodeURIComponent(back)}`);
  const services = String(form.get("services") ?? "").split(",").filter(Boolean);
  const start = String(form.get("start") ?? "");
  if (!services.length || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) return { error: "Hizmet ve saat seçin." };
  try {
    await callOne("api.Appointment_Book", {
      ActorId: user.Id,
      ShopId: String(form.get("shopId")),
      StaffId: String(form.get("staffId")),
      ServiceIdsJson: JSON.stringify(services),
      StartsAtLocal: `${start}:00`,
      Note: String(form.get("note") ?? "").trim() || null,
    });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/randevularim");
  redirect("/randevularim?yeni=1");
}

export async function cancelAppointment(id: string) {
  const user = await getUser();
  if (!user) return { error: "Giriş yapın." };
  try {
    await call("api.Appointment_SetStatus", { ActorId: user.Id, AppointmentId: id, Status: "cancelled" });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/randevularim");
  return { ok: "Randevu iptal edildi." };
}

export async function addReview(_: BookState, form: FormData): Promise<BookState & { ok?: string }> {
  const user = await getUser();
  if (!user) return { error: "Giriş yapın." };
  try {
    await call("api.Review_Add", {
      ActorId: user.Id, AppointmentId: String(form.get("appointmentId")),
      Rating: Number(form.get("rating")), Comment: String(form.get("comment") ?? "").trim() || null,
    });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/randevularim");
  return { ok: "Yorumunuz için teşekkürler!" };
}
