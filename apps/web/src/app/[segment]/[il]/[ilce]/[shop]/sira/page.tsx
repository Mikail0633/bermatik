import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarPlus, Check } from "lucide-react";
import { call, callOne } from "@/lib/db";
import { hhmm, isSegment, shopUrl, type ShopDetail } from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";
import { OpenBadge } from "@/components/ShopCard";
import { AutoRefresh } from "@/components/AutoRefresh";

export const metadata: Metadata = { title: "Sırayı gör", robots: { index: false } };
export const dynamic = "force-dynamic";

type Params = Promise<{ segment: string; il: string; ilce: string; shop: string }>;
type Slot = { StartsAtLocal: Date; EndsAtLocal: Date; StaffName: string; IsPast: boolean };

// Sırayı gör: dükkânın bugünkü randevuları saat sırasıyla (müşteri adı yok)
export default async function Page({ params }: { params: Params }) {
  const p = await params;
  if (!isSegment(p.segment)) notFound();
  const found = await callOne<{ Id: string }>("api.Shop_GetIdBySlug", { Segment: p.segment, ProvinceSlug: p.il, DistrictSlug: p.ilce, ShopSlug: p.shop });
  if (!found) notFound();
  const shop = await callOne<ShopDetail>("api.Shop_Get", { ShopId: found.Id });
  if (!shop) notFound();
  const url = shopUrl(shop);
  if (!shop.IsClaimed) redirect(url); // katılmamış dükkânda randevu verisi yok
  const slots = await call<Slot>("api.Shop_DaySchedule", { ShopId: shop.Id });
  const nextIdx = slots.findIndex((s) => !s.IsPast);
  const waiting = slots.filter((s) => !s.IsPast).length;

  return (
    <SiteShell segment={shop.Segment}>
      <AutoRefresh seconds={30} />
      <div className="mx-auto max-w-xl px-4 py-6">
        <Link href={url} className="text-sm text-muted underline">← {shop.Name}</Link>
        <h1 className="mt-2 text-3xl font-extrabold">Sırayı gör</h1>
        <div className="mt-1 flex items-center gap-2"><span className="text-muted">{shop.Name}</span><OpenBadge shop={shop} /></div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-surface p-4 text-center">
            <p className="text-sm text-muted">Bugünkü randevu</p>
            <p className="text-4xl font-extrabold">{slots.length}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 text-center">
            <p className="text-sm text-muted">Sıradaki</p>
            <p className="text-4xl font-extrabold">{nextIdx >= 0 ? hhmm(slots[nextIdx].StartsAtLocal) : "—"}</p>
          </div>
        </div>

        {slots.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-center text-muted">Bugün henüz randevu yok.</p>
        ) : (
          <>
            <p className="mt-6 text-sm text-muted">{waiting === 0 ? "Bugünkü randevuların hepsi geçti." : `${waiting} randevu bekliyor.`}</p>
            <ol className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {slots.map((s, i) => (
                <li key={i} className={`flex items-center gap-3 px-4 py-3 ${i === nextIdx ? "bg-accent/15" : ""} ${s.IsPast ? "text-muted" : ""}`}>
                  <span className="w-14 text-lg font-bold tabular-nums">{hhmm(s.StartsAtLocal)}</span>
                  <span className="flex-1">{s.StaffName}</span>
                  {s.IsPast ? (
                    <span className="inline-flex items-center gap-1 text-sm"><Check className="h-4 w-4" aria-hidden /> geçti</span>
                  ) : i === nextIdx ? (
                    <span className="text-sm font-bold text-accent">● sıradaki</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        )}
        <p className="mt-3 text-xs text-muted">Müşteri adları gösterilmez. Bu sayfa kendiliğinden güncellenir.</p>

        <Link href={`${url}/randevu`} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-lg font-bold text-primary-ink hover:opacity-90">
          <CalendarPlus className="h-5 w-5" aria-hidden /> Randevu al
        </Link>
      </div>
    </SiteShell>
  );
}
