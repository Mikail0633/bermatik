import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { callOne } from "@/lib/db";
import { loadPanelShop } from "../data";

export const metadata = { title: "Rapor" };
export const dynamic = "force-dynamic";

type Report = {
  Period: "gun" | "hafta" | "ay"; FromDate: Date; ToDate: Date; FullView: boolean;
  Appointments: number; Completed: number; Accepted: number; Pending: number; Cancelled: number; NoShows: number;
  Revenue: number; ExpectedRevenue: number; Customers: number; NewCustomers: number; PhoneBookings: number;
  ProductRevenue: number | null; PrevAppointments: number; PrevRevenue: number; PrevCustomers: number;
  SeriesJson: string | null; StaffJson: string | null; ServicesJson: string | null;
};
type Bucket = { i: number; n: number; revenue: number };
type Row = { name: string; n: number; completed?: number; revenue: number };

const PERIODS = [["gun", "Günlük"], ["hafta", "Haftalık"], ["ay", "Aylık"]] as const;
const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(n) || 0);
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", ...o }).format(new Date(d));
const addDays = (d: Date, n: number) => new Date(new Date(d).getTime() + n * 86_400_000);
const parse = <T,>(j: string | null): T[] => { try { return j ? (JSON.parse(j) as T[]) : []; } catch { return []; } };
const todayTR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

function change(cur: number, prev: number) {
  if (!prev) return cur ? "önceki dönemde yoktu" : null;
  const p = Math.round(((cur - prev) / prev) * 100);
  return `${p > 0 ? "▲" : p < 0 ? "▼" : "="} %${Math.abs(p)} önceki döneme göre`;
}

export default async function Page({ params, searchParams }: {
  params: Promise<{ shopId: string }>; searchParams: Promise<{ donem?: string; tarih?: string }>;
}) {
  const { shopId } = await params;
  const sp = await searchParams;
  const { user } = await loadPanelShop(shopId);
  const period = (["gun", "hafta", "ay"] as const).find((p) => p === sp.donem) ?? "hafta";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.tarih ?? "") ? sp.tarih! : todayTR();
  const r = (await callOne<Report>("api.Panel_Report", { ActorId: user.Id, ShopId: shopId, Period: period, Date: date }))!;

  const series = parse<Bucket>(r.SeriesJson);
  const staff = parse<Row>(r.StaffJson);
  const services = parse<Row>(r.ServicesJson);
  const from = new Date(r.FromDate), to = new Date(r.ToDate);
  const prevDate = iso(addDays(from, -1));
  const nextDate = iso(addDays(to, 1));
  const isCurrent = todayTR() >= iso(from) && todayTR() <= iso(to);
  const title = period === "gun" ? fmt(from, { day: "numeric", month: "long", year: "numeric", weekday: "long" })
    : period === "hafta" ? `${fmt(from, { day: "numeric", month: "long" })} – ${fmt(to, { day: "numeric", month: "long", year: "numeric" })}`
    : fmt(from, { month: "long", year: "numeric" });
  const href = (p: string, d: string) => `/panel/${shopId}/rapor?donem=${p}&tarih=${d}`;

  // Grafik: günlükte yalnızca 07:00–23:00 (randevu varsa dışını da göster)
  const shown = period === "gun" ? series.filter((b) => (b.i >= 7 && b.i <= 23) || b.n > 0) : series;
  const max = Math.max(1, ...shown.map((b) => b.n));
  const label = (i: number) => period === "gun" ? `${String(i).padStart(2, "0")}:00`
    : period === "hafta" ? fmt(addDays(from, i), { weekday: "short" }) : String(i + 1);

  const tiles: { label: string; value: string; sub?: string | null }[] = [
    { label: "Gelir (tamamlanan)", value: tl(r.Revenue), sub: change(Number(r.Revenue), Number(r.PrevRevenue)) },
    { label: "Beklenen gelir", value: tl(r.ExpectedRevenue), sub: `${r.Accepted} onaylı randevu henüz "Tamamlandı" işaretlenmedi` },
    { label: "Randevu", value: String(r.Appointments), sub: change(r.Appointments, r.PrevAppointments) },
    { label: "Müşteri", value: String(r.Customers), sub: `${r.NewCustomers} yeni müşteri` },
    { label: "İptal / gelmedi", value: `${r.Cancelled} / ${r.NoShows}`, sub: r.Pending ? `${r.Pending} randevu onay bekliyor` : null },
    { label: "Telefonla gelen", value: String(r.PhoneBookings), sub: `${r.Appointments - r.PhoneBookings} randevu Bermatik'ten` },
  ];
  if (r.FullView && r.ProductRevenue != null) tiles.push({ label: "Ürün satışı", value: tl(r.ProductRevenue), sub: "teslim edilen siparişler" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border border-line bg-surface-2 p-1 text-sm font-semibold" role="group" aria-label="Dönem">
          {PERIODS.map(([p, l]) => (
            <Link key={p} href={href(p, date)} aria-current={p === period ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 ${p === period ? "bg-primary text-primary-ink" : "text-muted hover:text-ink"}`}>{l}</Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Link href={href(period, prevDate)} aria-label="Önceki dönem" className="rounded-lg border border-line p-2 hover:bg-surface-2"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="min-w-0 px-2 text-center text-sm font-semibold">{title}</span>
          <Link href={href(period, nextDate)} aria-label="Sonraki dönem" className="rounded-lg border border-line p-2 hover:bg-surface-2"><ChevronRight className="h-4 w-4" /></Link>
          {!isCurrent && <Link href={href(period, todayTR())} className="ml-1 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">Bugün</Link>}
        </div>
      </div>

      {!r.FullView && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">Bu rapor yalnızca <b>sizin</b> randevularınızı gösterir.</p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0 rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm text-muted">{t.label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{t.value}</p>
            {t.sub && <p className="mt-1 text-xs text-muted">{t.sub}</p>}
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-bold">Randevular ({period === "gun" ? "saat saat" : "gün gün"})</h2>
        <p className="mb-3 text-xs text-muted">Onaylı ve tamamlanan randevular. Çubuğun üzerine gelince sayı ve gelir görünür.</p>
        {r.Appointments === 0 ? <p className="text-sm text-muted">Bu dönemde randevu yok.</p> : (
          <>
            <div className="flex h-44 items-end gap-[2px] border-b border-line" role="img" aria-label="Randevu grafiği">
              {shown.map((b) => (
                <div key={b.i} className="group relative flex h-full min-w-0 flex-1 items-end">
                  <div className="w-full rounded-t bg-primary" style={{ height: `${(b.n / max) * 100}%`, minHeight: b.n ? 3 : 0 }} />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2 py-1 text-xs shadow group-hover:block">
                    <b>{label(b.i)}</b> · {b.n} randevu · {tl(b.revenue)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-[2px] text-[10px] text-muted">
              {shown.map((b, k) => (
                <span key={b.i} className="min-w-0 flex-1 truncate text-center">
                  {period === "ay" ? ((k % 5 === 0 || k === shown.length - 1) ? label(b.i) : "") : period === "gun" ? (b.i % 3 === 0 ? label(b.i) : "") : label(b.i)}
                </span>
              ))}
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted">Tablo olarak göster</summary>
              <table className="mt-2 w-full text-left">
                <thead><tr className="text-muted"><th className="py-1 font-medium">{period === "gun" ? "Saat" : "Gün"}</th><th className="font-medium">Randevu</th><th className="font-medium">Gelir</th></tr></thead>
                <tbody>{shown.filter((b) => b.n > 0).map((b) => (
                  <tr key={b.i} className="border-t border-line"><td className="py-1">{period === "ay" ? fmt(addDays(from, b.i), { day: "numeric", month: "short" }) : label(b.i)}</td><td>{b.n}</td><td className="tabular-nums">{tl(b.revenue)}</td></tr>
                ))}</tbody>
              </table>
            </details>
          </>
        )}
      </section>

      <div className={`grid grid-cols-1 gap-5 ${r.FullView ? "lg:grid-cols-2" : ""}`}>
        {r.FullView && (
          <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-bold">Personel</h2>
            {staff.length === 0 ? <p className="text-sm text-muted">Bu dönemde randevu yok.</p> : (
              <table className="w-full text-left text-sm">
                <thead><tr className="text-muted"><th className="py-1 font-medium">Personel</th><th className="font-medium">Randevu</th><th className="font-medium">Tamamlanan</th><th className="font-medium">Gelir</th></tr></thead>
                <tbody>{staff.map((s) => (
                  <tr key={s.name} className="border-t border-line"><td className="py-1.5">{s.name}</td><td>{s.n}</td><td>{s.completed}</td><td className="tabular-nums">{tl(s.revenue)}</td></tr>
                ))}</tbody>
              </table>
            )}
          </section>
        )}
        <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="mb-3 text-lg font-bold">En çok yapılan hizmetler</h2>
          {services.length === 0 ? <p className="text-sm text-muted">Bu dönemde randevu yok.</p> : (
            <table className="w-full text-left text-sm">
              <thead><tr className="text-muted"><th className="py-1 font-medium">Hizmet</th><th className="font-medium">Adet</th><th className="font-medium">Tutar</th></tr></thead>
              <tbody>{services.map((s) => (
                <tr key={s.name} className="border-t border-line"><td className="py-1.5">{s.name}</td><td>{s.n}</td><td className="tabular-nums">{tl(s.revenue)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </section>
      </div>
      <p className="text-xs text-muted">Gelir, &quot;Tamamlandı&quot; işaretlenen randevulardan hesaplanır. Müşteri gelince randevuyu Bugün veya Randevular sekmesinden &quot;Tamamlandı&quot; yapın.</p>
    </div>
  );
}
