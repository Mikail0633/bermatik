import Link from "next/link";
import { Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";
import { localLabel } from "@/lib/types";
import { ResolveRequestForm } from "./ResolveRequestForm";

export const metadata = { title: "Randevu talepleri" };
export const dynamic = "force-dynamic";

type Req = {
  Id: string; Kind: "randevu" | "sira"; Status: string; PreferredAtLocal: Date; ConfirmedAtLocal: Date | null; Note: string | null; AdminNote: string | null;
  CreatedAtLocal: Date; CategoryName: string | null; CustomerName: string; CustomerPhone: string | null; CustomerEmail: string;
  ShopId: string; Code: string; ShopName: string; ShopPhone: string | null; District: string;
};
// "2026-10-30T14:00" — saat kutusunun beklediği biçim (tarih zaten İstanbul saatinde)
const inputValue = (d: Date) => new Date(d).toISOString().slice(0, 16);

// Bermatik'e katılmamış dükkânlar için müşterilerin bıraktığı randevu talepleri (eski "sıra" talepleri de görünür)
export default async function Page({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  const admin = await requireAdmin();
  const all = (await searchParams).durum === "hepsi";
  const rows = await call<Req>("api.Admin_Request_List", { ActorId: admin.Id, Status: all ? null : "open" });
  const phone = (tel: string | null, label: string) => tel
    ? <a href={`tel:${tel}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm font-semibold hover:bg-surface-2"><Phone className="h-4 w-4" aria-hidden /> {label}: {tel}</a>
    : <span className="text-sm font-semibold text-closed">{label}: telefon yok</span>;
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-extrabold">Randevu talepleri</h1>
      <p className="text-sm text-muted">Bermatik&apos;e katılmamış dükkânlar için. Dükkânı arayıp ayarlayın, sonra onaylayın; müşteriye bildirim gider.</p>
      <div className="mt-3 flex gap-2 text-sm">
        <a href="?" className={`rounded-lg px-3 py-1.5 font-semibold ${all ? "border border-line" : "bg-primary text-primary-ink"}`}>Bekleyenler</a>
        <a href="?durum=hepsi" className={`rounded-lg px-3 py-1.5 font-semibold ${all ? "bg-primary text-primary-ink" : "border border-line"}`}>Tümü</a>
      </div>
      {rows.length === 0 ? <p className="mt-6 text-muted">{all ? "Henüz talep yok." : "Bekleyen talep yok."}</p> : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.Id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{r.Kind === "sira" ? "Sıra" : "Randevu"}: {localLabel(r.PreferredAtLocal)}</p>
                  <p className="text-sm text-muted">{r.CategoryName ?? "Hizmet seçilmedi"}{r.Note ? ` · “${r.Note}”` : ""}</p>
                </div>
                <span className="text-xs text-muted">{r.Status === "open" ? "bekliyor" : r.Status === "confirmed" ? `✓ ${localLabel(r.ConfirmedAtLocal!)}` : r.Status === "rejected" ? "✗ reddedildi" : "iptal"}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-surface-2 p-3">
                  <p className="text-xs text-muted">Müşteri</p>
                  <p className="font-semibold">{r.CustomerName}</p>
                  <p className="mb-2 text-xs text-muted">{r.CustomerEmail}</p>
                  {phone(r.CustomerPhone, "Ara")}
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <p className="text-xs text-muted">Dükkân</p>
                  <Link href={`/admin/dukkanlar/${r.ShopId}`} className="font-semibold underline">{r.ShopName}</Link>
                  <p className="mb-2 text-xs text-muted">{r.Code} · {r.District}</p>
                  {phone(r.ShopPhone, "Ara")}
                </div>
              </div>
              {r.Status === "open" && <ResolveRequestForm id={r.Id} preferred={inputValue(r.PreferredAtLocal)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
