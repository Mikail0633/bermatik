import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { call } from "@/lib/db";
import { tl } from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";
import { ActionButton } from "@/components/ActionButton";
import { cancelMyOrder } from "@/app/magaza-actions";

export const metadata: Metadata = { title: "Siparişlerim", robots: { index: false } };
export const dynamic = "force-dynamic";

type Order = { Id: string; Status: string; Total: number; Note: string | null; CreatedAtLocal: Date; ShopName: string; ShopPhone: string | null; ShopUrl: string; Items: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Hazırlanıyor", cls: "bg-accent/20 text-ink" },
  ready: { label: "Hazır — gelip alabilirsiniz", cls: "bg-open/10 text-open" },
  picked_up: { label: "Teslim alındı", cls: "bg-surface-2 text-muted" },
  cancelled: { label: "İptal edildi", cls: "bg-closed/10 text-closed" },
};
const when = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(d));

export default async function Page({ searchParams }: { searchParams: Promise<{ yeni?: string }> }) {
  const user = await requireUser("/siparislerim");
  const orders = await call<Order>("api.Order_ListMine", { ActorId: user.Id });
  const fresh = (await searchParams).yeni === "1";
  return (
    <SiteShell segment="erkek">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-extrabold">Siparişlerim</h1>
        {fresh && <p className="mt-3 rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">Siparişiniz alındı! Dükkân hazırlayınca size haber verilecek. Ödemeyi dükkânda yaparsınız.</p>}
        {orders.length === 0 ? <p className="mt-4 text-muted">Henüz siparişiniz yok. Ürün satan dükkânların sayfasında &quot;Ürünler&quot; bölümünden sipariş verebilirsiniz.</p> : (
          <ul className="mt-4 space-y-3">
            {orders.map((o) => (
              <li key={o.Id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={o.ShopUrl} className="font-bold hover:underline">{o.ShopName}</Link>
                    <p className="text-sm">{o.Items}</p>
                    <p className="text-sm text-muted">{when(o.CreatedAtLocal)} · <b className="text-ink">{tl(Number(o.Total))}</b> (dükkânda ödenir)</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[o.Status]?.cls ?? ""}`}>{STATUS[o.Status]?.label ?? o.Status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {o.ShopPhone && <a href={`tel:${o.ShopPhone}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2"><Phone className="h-4 w-4" aria-hidden /> Dükkânı ara</a>}
                  {o.Status === "pending" && <ActionButton variant="danger" confirm="Sipariş iptal edilsin mi?" action={cancelMyOrder.bind(null, o.Id)}>İptal et</ActionButton>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SiteShell>
  );
}
