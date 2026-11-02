import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { call } from "@/lib/db";
import { SEGMENTS, isSegment, type ShopCard } from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";
import { ShopList } from "@/components/ShopCard";

export const revalidate = 300;

type Category = { Slug: string; Name: string; Description: string | null };
type Params = Promise<{ segment: string; slug: string }>;

const load = cache(async (segment: string, slug: string) => {
  if (!isSegment(segment)) return null;
  const cats = await call<Category>("api.ServiceCategory_List", { Segment: segment });
  const cat = cats.find((c) => c.Slug === slug);
  return cat ? { segment, cat, cats } : null;
});

// Google için: "Damat traşı yapan berberler" sayfası
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { segment, slug } = await params;
  const d = await load(segment, slug);
  if (!d) return {};
  const seg = SEGMENTS[d.segment];
  return {
    title: `${d.cat.Name} — ${seg.shops}, fiyatlar ve online randevu`,
    description: `${d.cat.Name} yapan ${seg.shops}: fiyat listesi, yorumlar ve boş randevu saatleri. ${d.cat.Description ?? ""}`.trim(),
    alternates: { canonical: `/${segment}/hizmet/${slug}` },
  };
}

export default async function Page({ params }: { params: Params }) {
  const { segment: s, slug } = await params;
  const d = await load(s, slug);
  if (!d) notFound();
  const { segment, cat, cats } = d;
  const seg = SEGMENTS[segment];
  const [providers, others] = await Promise.all([
    call<ShopCard>("api.Shop_Search", { Segment: segment, CategorySlug: slug, Limit: 100 }),
    call<ShopCard>("api.Shop_Search", { Segment: segment, ProvinceId: 6, Limit: 30 }),
  ]);
  const notJoined = others.filter((x) => !x.IsClaimed).slice(0, 15);

  return (
    <SiteShell segment={segment}>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <nav aria-label="Konum" className="mb-3 text-sm text-muted">
          <Link href={seg.home} className="hover:text-ink">{seg.Shops}</Link> › <Link href={`${seg.home}#hizmetler`} className="hover:text-ink">Hizmetler</Link>
        </nav>
        <h1 className="text-3xl font-extrabold">{cat.Name}</h1>
        {cat.Description && <p className="mt-2 text-muted">{cat.Description}</p>}

        {/* Diğer hizmetler */}
        <div className="mt-4 flex flex-wrap gap-2">
          {cats.filter((c) => c.Slug !== slug).map((c) => (
            <Link key={c.Slug} href={`/${segment}/hizmet/${c.Slug}`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:bg-surface-2">{c.Name}</Link>
          ))}
        </div>

        <h2 className="mt-8 text-xl font-extrabold">Bermatik&apos;te {cat.Name.toLocaleLowerCase("tr-TR")} yapan {seg.shops}</h2>
        {providers.length ? (
          <div className="mt-3"><ShopList shops={providers} /></div>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-line p-6 text-center text-muted">
            Bu hizmeti veren ve Bermatik&apos;e katılmış {seg.shop} henüz yok. {seg.Shops} katıldıkça fiyatlarıyla burada listelenecek.
          </p>
        )}

        {notJoined.length > 0 && (
          <>
            <h2 className="mt-8 text-xl font-extrabold">Bölgedeki diğer {seg.shops}</h2>
            <p className="text-sm text-muted">Henüz Bermatik&apos;e katılmadılar; bu hizmeti verip vermediklerini arayarak sorabilirsiniz.</p>
            <div className="mt-3"><ShopList shops={notJoined} /></div>
          </>
        )}
      </div>
    </SiteShell>
  );
}
