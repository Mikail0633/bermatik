import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { resolveReport, setReviewHidden } from "../actions";

export const metadata = { title: "Şikayetler" };
export const dynamic = "force-dynamic";

type Report = {
  Id: string; TargetType: string; TargetId: string; Reason: string; Note: string | null; Status: string; ResolutionNote: string | null;
  CreatedAtLocal: Date; ReporterName: string; ReporterEmail: string; TargetSummary: string | null; TimesReported: number;
};
const TYPES: Record<string, string> = { shop: "Dükkân", review: "Yorum", photo: "Fotoğraf", product: "Ürün", user: "Kullanıcı" };
const REASONS: Record<string, string> = {
  uygunsuz: "Hakaret / uygunsuz", sahte: "Sahte / yanlış bilgi", dolandiricilik: "Dolandırıcılık", spam: "Reklam / spam", diger: "Diğer",
};
const when = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }).format(new Date(d));

export default async function Page({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  const admin = await requireAdmin();
  const showAll = (await searchParams).durum === "hepsi";
  const rows = await call<Report>("api.Admin_Report_List", { ActorId: admin.Id, Status: showAll ? null : "open" });
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-extrabold">Şikayetler</h1>
      <p className="text-sm text-muted">Kullanıcıların bildirdiği dükkân, yorum ve fotoğraflar. Aynı içerik için gelen tüm şikayetler birlikte kapanır.</p>
      <div className="mt-3 flex gap-2 text-sm">
        <a href="?" className={`rounded-lg px-3 py-1.5 font-semibold ${showAll ? "border border-line" : "bg-primary text-primary-ink"}`}>Açık olanlar</a>
        <a href="?durum=hepsi" className={`rounded-lg px-3 py-1.5 font-semibold ${showAll ? "bg-primary text-primary-ink" : "border border-line"}`}>Tümü</a>
      </div>
      {rows.length === 0 ? <p className="mt-6 text-muted">{showAll ? "Hiç şikayet yok." : "Açık şikayet yok. 🎉"}</p> : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.Id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    <span className="mr-2 rounded bg-surface-2 px-1.5 py-0.5 text-xs">{TYPES[r.TargetType] ?? r.TargetType}</span>
                    {r.TargetType === "shop"
                      ? <Link href={`/admin/dukkanlar/${r.TargetId}`} className="underline">{r.TargetSummary ?? "(silinmiş)"}</Link>
                      : r.TargetSummary ?? "(silinmiş)"}
                  </p>
                  <p className="mt-1 text-sm"><b>{REASONS[r.Reason] ?? r.Reason}</b>{r.Note && <span className="text-muted"> — “{r.Note}”</span>}</p>
                  <p className="text-xs text-muted">{r.ReporterName} ({r.ReporterEmail}) · {when(r.CreatedAtLocal)}{r.TimesReported > 1 && <b className="text-closed"> · {r.TimesReported} kez şikayet edildi</b>}</p>
                  {r.Status !== "open" && <p className="mt-1 text-xs text-muted">{r.Status === "resolved" ? "Gereği yapıldı" : "Yersiz bulundu"}{r.ResolutionNote ? `: ${r.ResolutionNote}` : ""}</p>}
                </div>
                {r.Status === "open" && (
                  <div className="flex flex-wrap gap-2">
                    {r.TargetType === "review" && (
                      <ActionButton variant="danger" action={async () => { "use server"; const a = await setReviewHidden(r.TargetId, true); return a?.error ? a : resolveReport(r.Id, "resolved", "Yorum gizlendi"); }}>
                        Yorumu gizle ve kapat
                      </ActionButton>
                    )}
                    <ActionButton variant="success" action={resolveReport.bind(null, r.Id, "resolved", undefined)}>Gereği yapıldı</ActionButton>
                    <ActionButton action={resolveReport.bind(null, r.Id, "dismissed", undefined)}>Yersiz</ActionButton>
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
