import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SEGMENTS, isSegment } from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";
import { QueueFinder } from "@/components/QueueFinder";

export const metadata: Metadata = { title: "Sırayı gör", robots: { index: false } };

// Sırayı gör: dükkânı ara, seç → o dükkânın bugünkü randevu sırası
export default async function Page({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  if (!isSegment(segment)) notFound();
  const seg = SEGMENTS[segment];
  return (
    <SiteShell segment={segment}>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <nav aria-label="Konum" className="mb-3 text-sm text-muted"><Link href={seg.home} className="hover:text-ink">{seg.Shops}</Link> › Sırayı gör</nav>
        <h1 className="text-3xl font-extrabold">Sırayı gör</h1>
        <p className="mt-1 text-muted">{seg.Shops} içinde arayın, seçtiğiniz dükkânın bugünkü randevu sırasını görün.</p>
        <div className="mt-5"><QueueFinder segment={segment} /></div>
      </div>
    </SiteShell>
  );
}
