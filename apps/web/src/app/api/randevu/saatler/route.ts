import { NextResponse } from "next/server";
import { AppError, call } from "@/lib/db";
import { localIso } from "@/lib/types";

type Slot = { StartsAtLocal: Date; EndsAtLocal: Date; StaffId?: string; StaffName?: string; DurationMinutes: number };
const GUID = /^[0-9a-f-]{36}$/i;

// Randevu ekranı: seçilen gün için boş saatler (personel veya "fark etmez")
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const shop = sp.get("dukkan") ?? "", staff = sp.get("personel") ?? "", date = sp.get("tarih") ?? "";
  const services = (sp.get("hizmetler") ?? "").split(",").filter((x) => GUID.test(x));
  if (!GUID.test(shop) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !services.length || (staff !== "farketmez" && !GUID.test(staff)))
    return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
  try {
    const json = JSON.stringify(services);
    const rows = staff === "farketmez"
      ? await call<Slot>("api.Appointment_AvailableSlotsAnyStaff", { ShopId: shop, Date: date, ServiceIdsJson: json })
      : await call<Slot>("api.Appointment_AvailableSlots", { StaffId: staff, Date: date, ServiceIdsJson: json });
    return NextResponse.json(rows.map((r) => ({
      start: localIso(r.StartsAtLocal), end: localIso(r.EndsAtLocal), staffId: r.StaffId ?? staff, staffName: r.StaffName ?? null, minutes: r.DurationMinutes,
    })));
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
