import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { call } from "@/lib/db";
import { shopUrl, type Segment } from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";
import { OpenBadge, ShopThumb } from "@/components/ShopCard";
import { FavoriteButton } from "@/components/FavoriteButton";

export const metadata: Metadata = { title: "Favorilerim", robots: { index: false } };
export const dynamic = "force-dynamic";

type Fav = {
  Id: string; Segment: Segment; Name: string; Slug: string; ProvinceSlug: string; DistrictSlug: string; District: string; Province: string;
  Phone: string | null; CoverImagePath: string | null; IsOpen: boolean; ClosesAt: Date | null;
};

export default async function Page() {
  const user = await requireUser("/favorilerim");
  const rows = await call<Fav>("api.Favorite_ListMine", { ActorId: user.Id });
  return (
    <SiteShell segment="erkek">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-extrabold">Favorilerim</h1>
        {rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center">
            <p className="text-lg font-semibold">Henüz favori dükkânınız yok.</p>
            <p className="mt-1 text-muted">Beğendiğiniz dükkânın sayfasında &quot;Favorilere ekle&quot;ye dokunun; burada hızlıca bulun.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((s) => (
              <li key={s.Id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <Link href={shopUrl(s)} className="flex min-w-0 flex-1 items-center gap-3">
                  <ShopThumb shop={s} size={56} />
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{s.Name}</span>
                    <span className="block text-sm text-muted">{s.District}/{s.Province}</span>
                    <OpenBadge shop={{ IsOpen: s.IsOpen, ClosesAt: s.ClosesAt, OpensAt: null }} compact />
                  </span>
                </Link>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  {s.Phone && <a href={`tel:${s.Phone}`} aria-label="Ara" className="rounded-lg border border-line p-2 hover:bg-surface-2"><Phone className="h-5 w-5" /></a>}
                  <FavoriteButton shopId={s.Id} initial />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SiteShell>
  );
}
