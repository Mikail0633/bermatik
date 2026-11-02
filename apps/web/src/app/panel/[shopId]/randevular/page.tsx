import Link from "next/link";
import { call } from "@/lib/db";
import { tl, type Service, type Staff } from "@/lib/types";
import { ActionButton } from "@/components/ActionButton";
import { setAppointmentStatus } from "@/app/panel/actions";
import { loadPanelShop } from "../data";
import type { PanelAppt } from "../page";
import { PhoneBookingForm } from "./PhoneBookingForm";

export const metadata = { title: "Randevular" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  pending: "Onay bekliyor", accepted: "Onaylı", completed: "Tamamlandı", cancelled: "İptal", rejected: "Reddedildi", no_show: "Gelmedi",
};
const hm = (d: Date) => new Date(d).toISOString().slice(11, 16);
const dayKey = (offset: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(Date.now() + offset * 86_400_000));
const dayLabel = (key: string) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(key));

export default async function Page({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: Promise<{ gun?: string }> }) {
  const { shopId } = await params;
  const { user } = await loadPanelShop(shopId);
  const sp = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.gun ?? "") ? sp.gun! : dayKey(0);
  const [rows, services, staff] = await Promise.all([
    call<PanelAppt>("api.Appointment_ListForShop", { ActorId: user.Id, ShopId: shopId, Date: day }),
    call<Service>("api.ShopService_List", { ShopId: shopId, ActorId: user.Id }),
    call<Staff>("api.Staff_List", { ShopId: shopId, ActorId: user.Id }),
  ]);
  const days = Array.from({ length: 10 }, (_, i) => dayKey(i - 1));
  return (
    <div className="space-y-6">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d, i) => (
          <Link key={d} href={`?gun=${d}`} className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold ${d === day ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface hover:bg-surface-2"}`}>
            {i === 0 ? "Dün" : i === 1 ? "Bugün" : i === 2 ? "Yarın" : dayLabel(d)}
          </Link>
        ))}
        <form className="flex shrink-0 items-center gap-1"><input type="date" name="gun" defaultValue={day} className="rounded-xl border border-line px-2 py-1.5 text-sm" /><button className="rounded-xl border border-line px-3 py-2 text-sm">Git</button></form>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-lg font-bold">{dayLabel(day)} · {rows.length} randevu</h2>
        {rows.length === 0 ? <p className="text-sm text-muted">Bu gün için randevu yok.</p> : (
          <ul className="divide-y divide-line">
            {rows.map((a) => (
              <li key={a.Id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold">{hm(a.StartsAtLocal)}–{hm(a.EndsAtLocal)} · {a.CustomerName} <span className="text-xs font-normal text-muted">({STATUS[a.Status] ?? a.Status}{a.Source === "phone" ? ", telefon" : ""})</span></p>
                  <p className="text-sm text-muted">{a.Services} · {a.StaffName} · {tl(Number(a.TotalPrice))}{a.CustomerPhone ? ` · ${a.CustomerPhone}` : ""}{a.Note ? ` · “${a.Note}”` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {a.Status === "pending" && <>
                    <ActionButton variant="success" action={setAppointmentStatus.bind(null, a.Id, "accepted")}>Onayla</ActionButton>
                    <ActionButton variant="danger" confirm="Reddedilsin mi?" action={setAppointmentStatus.bind(null, a.Id, "rejected")}>Reddet</ActionButton>
                  </>}
                  {a.Status === "accepted" && <>
                    <ActionButton variant="success" action={setAppointmentStatus.bind(null, a.Id, "completed")}>Tamamlandı</ActionButton>
                    <ActionButton action={setAppointmentStatus.bind(null, a.Id, "no_show")}>Gelmedi</ActionButton>
                    <ActionButton variant="danger" confirm="Randevu iptal edilsin mi? Müşteriye bildirim gider." action={setAppointmentStatus.bind(null, a.Id, "cancelled")}>İptal</ActionButton>
                  </>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-lg font-bold">Telefonla gelen randevuyu ekle</h2>
        <p className="mb-3 text-sm text-muted">Arayan müşterinin randevusunu buradan girin; doğrudan onaylı olarak kaydedilir.</p>
        {services.length && staff.length ? (
          <PhoneBookingForm shopId={shopId} day={day} services={services.map((s) => ({ Id: s.Id, Name: s.Name }))} staff={staff.map((s) => ({ Id: s.Id, DisplayName: s.DisplayName }))} />
        ) : <p className="text-sm text-muted">Önce hizmet ve personel ekleyin.</p>}
      </section>
    </div>
  );
}
