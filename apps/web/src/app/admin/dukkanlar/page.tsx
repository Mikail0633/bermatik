import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";

export const metadata = { title: "Dükkânlar" };

type Row = {
  Id: string; Code: string; Segment: "erkek" | "kadin"; Name: string; Slug: string; Status: string; Phone: string | null;
  Source: string; IsClaimed: boolean; NeedsReview: boolean; Province: string; ProvinceSlug: string; District: string;
  DistrictSlug: string; Neighborhood: string; OwnerName: string | null; OwnerEmail: string | null; IsCertified: boolean;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  approved: { label: "Yayında", cls: "bg-open/10 text-open" },
  pending: { label: "Onay bekliyor", cls: "bg-accent/20 text-ink" },
  suspended: { label: "Askıda", cls: "bg-closed/10 text-closed" },
  rejected: { label: "Reddedildi", cls: "bg-closed/10 text-closed" },
};
const SOURCE: Record<string, string> = { osm: "OpenStreetMap", overture: "Overture Maps", admin: "Admin ekledi", owner: "Berber başvurdu" };

type SP = { ara?: string; bolum?: string; durum?: string; katilim?: string; kontrol?: string; ilce?: string };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const rows = await call<Row>("api.Admin_Shop_List", {
    ActorId: admin.Id,
    Search: sp.ara?.trim() || null,
    Segment: sp.bolum === "erkek" || sp.bolum === "kadin" ? sp.bolum : null,
    Status: sp.durum && STATUS[sp.durum] ? sp.durum : null,
    Claimed: sp.katilim === "1" ? true : sp.katilim === "0" ? false : null,
    NeedsReview: sp.kontrol === "1" ? true : null,
    Top: 500,
  });
  const filtered = sp.ilce ? rows.filter((r) => r.DistrictSlug === sp.ilce) : rows;
  const districts = [...new Map(rows.map((r) => [r.DistrictSlug, `${r.District} (${r.Province})`])).entries()].sort((a, b) => a[1].localeCompare(b[1], "tr"));
  const select = "rounded-lg border border-line bg-surface px-2 py-2 text-sm";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Dükkânlar</h1>
          <p className="text-sm text-muted">{filtered.length} kayıt</p>
        </div>
        <Link href="/admin/dukkanlar/yeni" className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-ink hover:opacity-90">
          <Plus className="h-5 w-5" aria-hidden /> Yeni dükkân ekle
        </Link>
      </div>

      {/* Filtreler (sayfa adresinde tutulur, paylaşılabilir) */}
      <form className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-3">
        <input name="ara" defaultValue={sp.ara} placeholder="Ad, kod, telefon veya e-posta…" className="min-w-48 flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
        <select name="bolum" defaultValue={sp.bolum ?? ""} className={select}>
          <option value="">Erkek + kadın</option><option value="erkek">Erkek</option><option value="kadin">Kadın</option>
        </select>
        <select name="durum" defaultValue={sp.durum ?? ""} className={select}>
          <option value="">Tüm durumlar</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select name="katilim" defaultValue={sp.katilim ?? ""} className={select}>
          <option value="">Katılmış + katılmamış</option><option value="1">Bermatik&apos;e katılmış</option><option value="0">Henüz katılmamış</option>
        </select>
        <select name="ilce" defaultValue={sp.ilce ?? ""} className={select}>
          <option value="">Tüm ilçeler</option>
          {districts.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
        </select>
        <label className="flex items-center gap-1 px-1 text-sm">
          <input type="checkbox" name="kontrol" value="1" defaultChecked={sp.kontrol === "1"} /> Kontrol bekleyenler
        </label>
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink">Filtrele</button>
        <Link href="/admin/dukkanlar" className="rounded-lg px-3 py-2 text-sm underline">Temizle</Link>
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="p-3">Dükkân</th><th className="p-3">Bölge</th><th className="p-3">Durum</th><th className="p-3">Kaynak</th><th className="p-3">Sahibi</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((r) => (
              <tr key={r.Id} className="hover:bg-surface-2">
                <td className="p-3">
                  <Link href={`/admin/dukkanlar/${r.Id}`} className="font-semibold underline-offset-2 hover:underline">{r.Name}</Link>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>{r.Code}</span>
                    <span className={`rounded px-1.5 ${r.Segment === "erkek" ? "bg-[#1b2a41] text-white" : "bg-[#8e2c48] text-white"}`}>{r.Segment === "erkek" ? "Erkek" : "Kadın"}</span>
                    {r.NeedsReview && <span className="inline-flex items-center gap-0.5 font-semibold text-closed"><AlertTriangle className="h-3 w-3" aria-hidden /> kontrol et</span>}
                  </div>
                </td>
                <td className="p-3">{r.Neighborhood.replace(/ Mahallesi$/, "")}, {r.District}<div className="text-xs text-muted">{r.Province}</div></td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[r.Status]?.cls}`}>{STATUS[r.Status]?.label ?? r.Status}</span></td>
                <td className="p-3 text-xs">{SOURCE[r.Source] ?? r.Source}{!r.IsClaimed && <div className="text-muted">katılmadı</div>}</td>
                <td className="p-3 text-xs">{r.OwnerName ? <>{r.OwnerName}<div className="text-muted">{r.OwnerEmail}</div></> : <span className="text-muted">—</span>}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted">Bu filtrelere uyan dükkân yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
