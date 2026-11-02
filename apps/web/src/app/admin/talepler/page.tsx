import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";
import { ClaimButtons, DismissSuggestion } from "./client";
import { OwnerDocs } from "@/components/admin/OwnerDocs";

export const metadata = { title: "Talepler" };
export const dynamic = "force-dynamic";

type Claim = {
  Id: string; Phone: string; Note: string | null; CreatedAtLocal: Date; ShopId: string; Code: string; ShopName: string;
  ShopPhone: string | null; District: string; UserName: string; UserEmail: string; OpenClaimsForShop: number;
};
type Suggestion = {
  Id: string; Segment: "erkek" | "kadin"; Name: string; Phone: string | null; Latitude: number; Longitude: number;
  Note: string | null; CreatedAtLocal: Date; ReporterName: string; NearbyShop: string | null;
};

const when = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }).format(new Date(d));

export default async function Page() {
  const admin = await requireAdmin();
  const [claims, suggestions] = await Promise.all([
    call<Claim>("api.Admin_Claim_List", { ActorId: admin.Id }),
    call<Suggestion>("api.Admin_Suggestion_List", { ActorId: admin.Id }),
  ]);
  const box = "rounded-2xl border border-line bg-surface p-4";
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section>
        <h1 className="text-2xl font-extrabold">Sahiplenme talepleri</h1>
        <p className="text-sm text-muted">&quot;Bu dükkân sizin mi?&quot; diyenler. Kişiyi arayıp doğruladıktan sonra onaylayın; dükkân ona geçer.</p>
        {claims.length === 0 ? <p className="mt-3 text-muted">Bekleyen talep yok.</p> : (
          <ul className="mt-3 space-y-3">
            {claims.map((c) => (
              <li key={c.Id} className={box}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/admin/dukkanlar/${c.ShopId}`} className="font-bold underline-offset-2 hover:underline">{c.ShopName}</Link>
                    <p className="text-xs text-muted">{c.Code} · {c.District}{c.ShopPhone ? ` · dükkân tel: ${c.ShopPhone}` : ""}</p>
                  </div>
                  <span className="text-xs text-muted">{when(c.CreatedAtLocal)}</span>
                </div>
                <p className="mt-2 text-sm"><b>{c.UserName}</b> ({c.UserEmail}) · <a href={`tel:${c.Phone}`} className="font-semibold underline">{c.Phone}</a></p>
                {c.Note && <p className="mt-1 text-sm text-muted">“{c.Note}”</p>}
                <div className="mt-2"><OwnerDocs claimId={c.Id} /></div>
                {c.OpenClaimsForShop > 1 && <p className="mt-1 text-xs font-semibold text-closed">Bu dükkân için {c.OpenClaimsForShop} açık talep var!</p>}
                <ClaimButtons id={c.Id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-extrabold">Eksik dükkân bildirimleri</h2>
        <p className="text-sm text-muted">Kullanıcıların bildirdiği, listede olmayan dükkânlar.</p>
        {suggestions.length === 0 ? <p className="mt-3 text-muted">Bekleyen bildirim yok.</p> : (
          <ul className="mt-3 space-y-3">
            {suggestions.map((s) => (
              <li key={s.Id} className={box}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{s.Name} <span className="text-xs font-normal text-muted">({s.Segment === "erkek" ? "erkek" : "kadın"})</span></p>
                    <p className="text-xs text-muted">{s.ReporterName} bildirdi · {when(s.CreatedAtLocal)}{s.Phone ? ` · tel: ${s.Phone}` : ""}</p>
                  </div>
                  <a href={`https://www.openstreetmap.org/?mlat=${s.Latitude}&mlon=${s.Longitude}#map=18/${s.Latitude}/${s.Longitude}`} target="_blank" rel="noopener noreferrer" className="text-sm underline">Haritada gör</a>
                </div>
                {s.Note && <p className="mt-1 text-sm text-muted">“{s.Note}”</p>}
                {s.NearbyShop && <p className="mt-1 text-xs font-semibold text-closed">Dikkat: 150 m içinde zaten “{s.NearbyShop}” var — aynı dükkân olabilir.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/dukkanlar/yeni?oneri=${s.Id}&ad=${encodeURIComponent(s.Name)}&bolum=${s.Segment}&lat=${s.Latitude}&lng=${s.Longitude}${s.Phone ? `&tel=${s.Phone}` : ""}`}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-ink"
                  >
                    Dükkân olarak ekle
                  </Link>
                  <DismissSuggestion id={s.Id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
