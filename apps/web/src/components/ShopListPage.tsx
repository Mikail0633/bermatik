import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SEGMENTS, shopUrl, type Segment, type ShopCard as Shop } from "@/lib/types";
import { SiteShell } from "./SiteShell";
import { ShopList } from "./ShopCard";
import { LazyMap } from "./LazyMap";

// İl, ilçe ve "yakınımda" sonuç sayfalarının ortak görünümü
export function ShopListPage({
  segment, title, intro, crumbs, shops, center, extra, after,
}: {
  segment: Segment;
  title: string;
  intro: string;
  crumbs: { href: string; label: string }[];
  shops: Shop[];
  center?: [number, number];
  extra?: React.ReactNode;
  /** listenin altına eklenecek bölüm (ör. yakın çevredeki dükkânlar) */
  after?: React.ReactNode;
}) {
  return (
    <SiteShell segment={segment}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <nav aria-label="Konum" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted">
          <Link href={SEGMENTS[segment].home} className="hover:text-ink">{SEGMENTS[segment].Shops}</Link>
          {crumbs.map((c) => (
            <span key={c.href} className="inline-flex items-center gap-1">
              <ChevronRight className="h-4 w-4" aria-hidden />
              <Link href={c.href} className="hover:text-ink">{c.label}</Link>
            </span>
          ))}
        </nav>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <p className="mt-1 text-muted">{intro}</p>

        {extra}

        {shops.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              <ShopList shops={shops} />
            </div>
            <div className="lg:sticky lg:top-20 lg:self-start">
              <LazyMap
                center={center}
                zoom={13}
                height={420}
                points={shops.map((s) => ({ id: s.Id, name: s.Name, lat: Number(s.Latitude), lng: Number(s.Longitude), href: shopUrl(s) }))}
              />
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-line p-10 text-center">
            <p className="text-lg font-semibold">Burada henüz {SEGMENTS[segment].shop} yok.</p>
            <p className="mt-1 text-muted">Bermatik yeni büyüyor. Çevrenizdeki {SEGMENTS[segment].shopAcc} bize önerebilirsiniz!</p>
          </div>
        )}
        {after}
        <p className="mt-8 text-center text-sm text-muted">
          Listede olmayan bir {segment === "erkek" ? "berber mi" : "kuaför mü"} var? <Link href="/oneri" className="font-semibold text-ink underline">Bize bildirin</Link>
        </p>
      </div>
    </SiteShell>
  );
}
