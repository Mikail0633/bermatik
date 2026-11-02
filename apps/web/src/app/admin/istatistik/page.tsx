import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";

export const metadata = { title: "İstatistikler" };
export const dynamic = "force-dynamic";

type Day = { Day: Date; NewUsers: number; NewShops: number; NewAppointments: number; CompletedAppointments: number; QueueEntries: number };
type Prov = { Province: string; Shops: number; Appointments: number };
const dayLabel = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(d));

export default async function Page({ searchParams }: { searchParams: Promise<{ gun?: string }> }) {
  const admin = await requireAdmin();
  const days = [7, 30, 90].includes(Number((await searchParams).gun)) ? Number((await searchParams).gun) : 30;
  const [daily, provinces] = await Promise.all([
    call<Day>("api.Admin_StatsDaily", { ActorId: admin.Id, Days: days }),
    call<Prov>("api.Admin_StatsTopProvinces", { ActorId: admin.Id, Days: days }),
  ]);
  const sum = (k: keyof Omit<Day, "Day">) => daily.reduce((a, d) => a + d[k], 0);
  const totals = [
    ["Yeni kullanıcı", sum("NewUsers")], ["Yeni dükkân", sum("NewShops")], ["Alınan randevu", sum("NewAppointments")],
    ["Tamamlanan randevu", sum("CompletedAppointments")],
  ] as const;
  const box = "rounded-2xl border border-line bg-surface";
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">İstatistikler</h1>
        <div className="flex gap-1 text-sm">
          {[7, 30, 90].map((g) => (
            <Link key={g} href={`?gun=${g}`} className={`rounded-lg px-3 py-1.5 font-semibold ${g === days ? "bg-primary text-primary-ink" : "border border-line"}`}>Son {g} gün</Link>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {totals.map(([l, v]) => <div key={l} className={`${box} p-4`}><p className="text-2xl font-extrabold">{v}</p><p className="text-xs text-muted">{l}</p></div>)}
      </div>

      <section className={`${box} overflow-x-auto`}>
        <h2 className="p-4 pb-2 text-lg font-bold">Gün gün</h2>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-surface-2 text-left"><tr>
            <th className="p-2 pl-4">Gün</th><th className="p-2 text-right">Yeni kullanıcı</th><th className="p-2 text-right">Yeni dükkân</th>
            <th className="p-2 text-right">Randevu</th><th className="p-2 pr-4 text-right">Tamamlanan</th>
          </tr></thead>
          <tbody className="divide-y divide-line tabular-nums">
            {[...daily].reverse().map((d) => (
              <tr key={String(d.Day)}>
                <td className="p-2 pl-4">{dayLabel(d.Day)}</td><td className="p-2 text-right">{d.NewUsers || "·"}</td><td className="p-2 text-right">{d.NewShops || "·"}</td>
                <td className="p-2 text-right">{d.NewAppointments || "·"}</td><td className="p-2 pr-4 text-right">{d.CompletedAppointments || "·"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={box}>
        <h2 className="p-4 pb-2 text-lg font-bold">En hareketli iller</h2>
        {provinces.length === 0 ? <p className="p-4 pt-0 text-sm text-muted">Henüz veri yok.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left"><tr><th className="p-2 pl-4">İl</th><th className="p-2 text-right">Yayındaki dükkân</th><th className="p-2 pr-4 text-right">Randevu</th></tr></thead>
            <tbody className="divide-y divide-line tabular-nums">
              {provinces.map((p) => <tr key={p.Province}><td className="p-2 pl-4">{p.Province}</td><td className="p-2 text-right">{p.Shops}</td><td className="p-2 pr-4 text-right">{p.Appointments}</td></tr>)}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
