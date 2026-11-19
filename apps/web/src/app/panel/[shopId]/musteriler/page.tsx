import { Phone } from "lucide-react";
import { call } from "@/lib/db";
import { loadPanelShop } from "../data";

export const metadata = { title: "Müşteriler" };
export const dynamic = "force-dynamic";

type Customer = {
  CustKey: string; Name: string; Phone: string | null; HasAccount: boolean; Visits: number; TotalSpent: number; NoShows: number;
  LastVisitLocal: Date | null; FirstVisitLocal: Date | null; NextAppointmentLocal: Date | null; LastStaffName: string | null;
};

const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(n) || 0);
const day = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
const dayTime = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
function ago(d: Date) {
  const now = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date()));
  const days = Math.floor((now.getTime() - new Date(new Date(d).toISOString().slice(0, 10)).getTime()) / 86_400_000);
  if (days <= 0) return "bugün";
  if (days === 1) return "dün";
  if (days < 30) return `${days} gün önce`;
  if (days < 365) return `${Math.floor(days / 30)} ay önce`;
  return `${Math.floor(days / 365)} yıl önce`;
}

export default async function Page({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: Promise<{ ara?: string }> }) {
  const { shopId } = await params;
  const q = ((await searchParams).ara ?? "").trim().slice(0, 60);
  const { user, shop } = await loadPanelShop(shopId);
  const full = shop.IsOwner || user.Role === "admin";
  const rows = await call<Customer>("api.Panel_Customers", { ActorId: user.Id, ShopId: shopId, Search: q || null });
  const regular = rows.filter((c) => c.Visits >= 3).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Müşteriler</h2>
          <p className="text-sm text-muted">
            {full ? "Dükkânınıza gelen müşteriler" : "Size gelen müşteriler"} · {rows.length} kişi{regular ? ` · ${regular} düzenli (3+ geliş)` : ""}
          </p>
        </div>
        <form className="flex w-full gap-2 sm:w-auto">
          <input name="ara" defaultValue={q} placeholder="Ad veya telefon ara" aria-label="Müşteri ara"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm sm:w-64" />
          <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-ink">Ara</button>
        </form>
      </div>
      {!full && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">Bu listede yalnızca <b>sizin</b> randevu verdiğiniz müşteriler görünür.</p>}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">{q ? "Aramanıza uyan müşteri yok." : "Henüz müşteri yok. Randevular geldikçe burada listelenir."}</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {rows.map((c) => (
            <li key={c.CustKey} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 p-4">
              <div className="min-w-0">
                <p className="font-semibold">
                  {c.Name}
                  {!c.HasAccount && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">telefonla</span>}
                  {c.Visits >= 3 && <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold">düzenli</span>}
                </p>
                <p className="text-sm text-muted">
                  {c.LastVisitLocal ? <>Son geliş: <b className="text-ink">{day(c.LastVisitLocal)}</b> ({ago(c.LastVisitLocal)})</> : "Henüz gelmedi"}
                  {c.FirstVisitLocal && c.Visits > 1 ? ` · ilk: ${day(c.FirstVisitLocal)}` : ""}
                  {full && c.LastStaffName ? ` · ${c.LastStaffName}` : ""}
                </p>
                {c.NextAppointmentLocal && <p className="text-sm text-open">Sıradaki randevu: {dayTime(c.NextAppointmentLocal)}</p>}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <p className="text-lg font-extrabold tabular-nums">{c.Visits} <span className="text-sm font-normal text-muted">kez</span></p>
                  <p className="text-xs text-muted tabular-nums">{tl(c.TotalSpent)}{c.NoShows ? ` · ${c.NoShows} kez gelmedi` : ""}</p>
                </div>
                {c.Phone && (
                  <a href={`tel:${c.Phone}`} aria-label={`${c.Name} ara`} className="rounded-lg border border-line p-2 hover:bg-surface-2"><Phone className="h-4 w-4" /></a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">Geliş sayısı: &quot;Tamamlandı&quot; işaretlenen ve saati geçmiş onaylı randevular. Harcama yalnızca tamamlanan randevulardan hesaplanır.</p>
    </div>
  );
}
