import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { call } from "@/lib/db";
import { SEGMENTS, isSegment, type ShopCard } from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";
import { ShopList } from "@/components/ShopCard";

// Canlı bilgi: her açılışta güncel
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Şu an açık olanlar", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  if (!isSegment(segment)) notFound();
  const seg = SEGMENTS[segment];
  const shops = (await call<ShopCard>("api.Shop_Search", { Segment: segment, Limit: 100 }))
    .filter((s) => s.IsClaimed && s.IsOpen)
    .sort((a, b) => a.TodayAppointments - b.TodayAppointments);
  return (
    <SiteShell segment={segment}>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <nav aria-label="Konum" className="mb-3 text-sm text-muted"><Link href={seg.home} className="hover:text-ink">{seg.Shops}</Link> › Şu an açık</nav>
        <h1 className="text-3xl font-extrabold">Şu an açık {seg.shops}</h1>
        <p className="mt-1 text-muted">Bugün randevusu en az olan en üstte. Sayfayı yenileyerek güncel durumu görebilirsiniz.</p>
        {shops.length ? (
          <div className="mt-6"><ShopList shops={shops} /></div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center">
            <p className="font-semibold">Şu an açık {seg.shop} yok.</p>
            <p className="mt-1 text-muted">Bu liste Bermatik&apos;e katılmış {seg.shops} için gösterilir. {seg.Shops} katıldıkça burada görünecek.</p>
            <Link href={`/${segment}/ankara`} className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-ink">Tüm {seg.shops}</Link>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
