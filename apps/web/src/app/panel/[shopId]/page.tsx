import { call, callOne } from "@/lib/db";
import { localLabel, tl } from "@/lib/types";
import { ActionButton } from "@/components/ActionButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { setAppointmentStatus } from "@/app/panel/actions";
import { getPanelView, loadPanelShop } from "./data";
import { ShopDocumentUpload } from "@/components/DocumentUpload";

export const metadata = { title: "Bugün" };
export const dynamic = "force-dynamic";

export type PanelAppt = {
  Id: string; Status: string; Source: string; StartsAtLocal: Date; EndsAtLocal: Date; CustomerName: string; CustomerPhone: string | null;
  TotalPrice: number; Note: string | null; StaffId: string; StaffName: string; Services: string;
};
type Stats = { CompletedAppointments: number; AppointmentRevenue: number; NoShows: number; UniqueCustomers: number };

const hm = (d: Date) => new Date(d).toISOString().slice(11, 16);
const todayTR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

export default async function Page({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: Promise<{ yeni?: string }> }) {
  const { shopId } = await params;
  const { user, shop } = await loadPanelShop(shopId);
  const canManage = (shop.IsOwner || user.Role === "admin") && (user.Role !== "admin" || (await getPanelView()) !== "personel");
  const [pending, today, stats] = await Promise.all([
    call<PanelAppt>("api.Appointment_ListForShop", { ActorId: user.Id, ShopId: shopId, Status: "pending" }),
    call<PanelAppt>("api.Appointment_ListForShop", { ActorId: user.Id, ShopId: shopId, Date: todayTR() }),
    canManage ? callOne<Stats>("api.Shop_Stats", { ActorId: user.Id, ShopId: shopId, Days: 7 }) : Promise.resolve(undefined),
  ]);
  const activeToday = today.filter((a) => a.Status === "accepted");
  const box = "rounded-2xl border border-line bg-surface p-4";
  const isNew = (await searchParams).yeni === "1";
  const docs = shop.Status === "pending" && shop.IsOwner
    ? await call<{ Id: string; Kind: string; Status: string; ReviewNote: string | null }>("api.OwnerDocument_List", { ActorId: user.Id, ShopId: shopId })
    : [];

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={20} />
      {shop.Status === "pending" && shop.IsOwner && user.Role !== "admin" && (
        <section className={`${box} border-accent`}>
          <h2 className="text-lg font-bold">Dükkân sahipliği belgesi</h2>
          <p className="mb-3 text-sm text-muted">Dükkânınızın yayına girmesi için <b>vergi levhası</b> veya <b>esnaf odası kaydınızın</b> fotoğrafını yükleyin. Belgenizi yalnızca Bermatik ekibi görür.</p>
          {docs.length > 0 && (
            <ul className="mb-3 space-y-1 text-sm">
              {docs.map((d) => (
                <li key={d.Id}>📄 <a href={`/api/belge/${d.Id}`} target="_blank" className="underline">{d.Kind === "vergi_levhasi" ? "Vergi levhası" : d.Kind === "esnaf_kaydi" ? "Esnaf odası kaydı" : "Belge"}</a>
                  {" · "}{d.Status === "pending" ? "inceleniyor" : d.Status === "approved" ? "✓ onaylandı" : `✗ uygun bulunmadı${d.ReviewNote ? `: ${d.ReviewNote}` : ""}`}</li>
              ))}
            </ul>
          )}
          <ShopDocumentUpload shopId={shopId} />
        </section>
      )}
      {isNew && <p className="rounded-xl bg-open/10 px-3 py-2 font-medium text-open">Dükkânınız eklendi! Şimdi &quot;Hizmetler ve fiyatlar&quot;, &quot;Personel&quot; ve &quot;Bilgiler ve saatler&quot; sekmelerini doldurun.</p>}

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Son 7 gün randevu", stats.CompletedAppointments],
            ["Son 7 gün kazanç", tl(Number(stats.AppointmentRevenue))],
            ["Farklı müşteri", stats.UniqueCustomers],
            ["Gelmeyen", stats.NoShows],
          ].map(([l, v]) => (
            <div key={String(l)} className={box}><p className="text-2xl font-extrabold">{v}</p><p className="text-xs text-muted">{l}</p></div>
          ))}
        </div>
      )}

      {/* Bekleyen randevu talepleri */}
      <section className={box}>
        <h2 className="mb-3 text-lg font-bold">Onay bekleyen randevular {pending.length > 0 && <span className="ml-1 rounded-full bg-accent px-2 text-sm text-accent-ink">{pending.length}</span>}</h2>
        {pending.length === 0 ? <p className="text-sm text-muted">Bekleyen talep yok.</p> : (
          <ul className="divide-y divide-line">
            {pending.map((a) => (
              <li key={a.Id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold">{localLabel(a.StartsAtLocal)} · {a.StaffName}</p>
                  <p className="text-sm text-muted">{a.CustomerName} · {a.Services} · {tl(Number(a.TotalPrice))}{a.Note ? ` · “${a.Note}”` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <ActionButton variant="success" action={setAppointmentStatus.bind(null, a.Id, "accepted")}>Onayla</ActionButton>
                  <ActionButton variant="danger" confirm="Randevu reddedilsin mi?" action={setAppointmentStatus.bind(null, a.Id, "rejected")}>Reddet</ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bugünün randevuları */}
      <section className={box}>
        <h2 className="mb-3 text-lg font-bold">Bugünün randevuları</h2>
        {activeToday.length === 0 ? <p className="text-sm text-muted">Bugün onaylı randevu yok.</p> : (
          <ul className="divide-y divide-line">
            {activeToday.map((a) => (
              <li key={a.Id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold">{hm(a.StartsAtLocal)}–{hm(a.EndsAtLocal)} · {a.CustomerName} {a.Source === "phone" && <span className="text-xs text-muted">(telefon)</span>}</p>
                  <p className="text-sm text-muted">{a.Services} · {a.StaffName} · {tl(Number(a.TotalPrice))}</p>
                </div>
                <div className="flex gap-2">
                  {a.CustomerPhone && <a href={`tel:${a.CustomerPhone}`} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold">Ara</a>}
                  <ActionButton variant="success" action={setAppointmentStatus.bind(null, a.Id, "completed")}>Tamamlandı</ActionButton>
                  <ActionButton variant="danger" action={setAppointmentStatus.bind(null, a.Id, "no_show")}>Gelmedi</ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
