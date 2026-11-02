import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { reviewCertificate } from "../actions";

export const metadata = { title: "Belgeler" };
export const dynamic = "force-dynamic";

type Cert = {
  Id: string; Type: string; SerialNo: string | null; IssuedBy: string | null; Status: string; ReviewNote: string | null; CreatedAtLocal: Date;
  UserId: string; UserName: string; BirthYear: number | null; Email: string; Shops: string | null;
};
const TYPES: Record<string, string> = {
  ciraklik: "Çıraklık belgesi", kalfalik: "Kalfalık belgesi", ustalik: "Ustalık belgesi", usta_ogreticilik: "Usta öğreticilik belgesi", diger: "Diğer belge",
};
const when = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", dateStyle: "medium" }).format(new Date(d));

// Ustalık belgesi onayı → dükkân sayfasında "Belgeli usta" rozeti
export default async function Page({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  const admin = await requireAdmin();
  const all = (await searchParams).durum === "hepsi";
  const rows = await call<Cert>("api.Admin_Certificate_List", { ActorId: admin.Id, Status: all ? null : "pending" });
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-extrabold">Belge onayı</h1>
      <p className="text-sm text-muted">Onaylanan belge, sahibinin dükkân sayfasında &quot;Belgeli usta&quot; rozeti olarak görünür. Belgedeki ad ile hesap adının aynı olduğunu kontrol edin.</p>
      <div className="mt-3 flex gap-2 text-sm">
        <a href="?" className={`rounded-lg px-3 py-1.5 font-semibold ${all ? "border border-line" : "bg-primary text-primary-ink"}`}>Bekleyenler</a>
        <a href="?durum=hepsi" className={`rounded-lg px-3 py-1.5 font-semibold ${all ? "bg-primary text-primary-ink" : "border border-line"}`}>Tümü</a>
      </div>
      {rows.length === 0 ? <p className="mt-6 text-muted">{all ? "Hiç belge yüklenmemiş." : "Bekleyen belge yok."}</p> : (
        <ul className="mt-4 space-y-3">
          {rows.map((c) => (
            <li key={c.Id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{TYPES[c.Type] ?? c.Type} · {c.UserName}{c.BirthYear ? <span className="font-normal text-muted"> ({c.BirthYear})</span> : null}</p>
                  <p className="text-sm text-muted">{c.Email} · {when(c.CreatedAtLocal)}</p>
                  <p className="text-sm">Seri no: <b>{c.SerialNo ?? "—"}</b> · Veren kurum: {c.IssuedBy ?? "—"} · <a href={`/api/ustalik/${c.Id}`} target="_blank" className="font-semibold underline">Belgeyi aç</a></p>
                  {c.Shops && <p className="text-sm text-muted">Dükkânları: {c.Shops}</p>}
                  {c.Status !== "pending" && <p className="mt-1 text-xs">{c.Status === "verified" ? "✓ Onaylandı" : "✗ Reddedildi"}{c.ReviewNote ? `: ${c.ReviewNote}` : ""}</p>}
                </div>
                {c.Status === "pending" && (
                  <div className="flex gap-2">
                    <ActionButton variant="success" action={reviewCertificate.bind(null, c.Id, "verified", undefined)}>Onayla</ActionButton>
                    <ActionButton variant="danger" confirm="Belge reddedilsin mi?" action={reviewCertificate.bind(null, c.Id, "rejected", "Belge doğrulanamadı")}>Reddet</ActionButton>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
