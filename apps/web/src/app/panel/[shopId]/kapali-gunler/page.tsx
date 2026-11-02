import { notFound } from "next/navigation";
import { call } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { removeClosure } from "@/app/panel/actions";
import { loadPanelShop } from "../data";
import { ClosureForm } from "./ClosureForm";

export const metadata = { title: "Kapalı günler" };
type Row = { Id: string; StartDate: Date; EndDate: Date; Reason: string | null };
const d = (x: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(x));

export default async function Page({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const { user, shop } = await loadPanelShop(shopId);
  if (!shop.IsOwner && user.Role !== "admin") notFound();
  const rows = await call<Row>("api.ShopClosure_List", { ShopId: shopId });
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 text-lg font-bold">Kapalı gün ekle</h2>
        <p className="mb-3 text-sm text-muted">Bayram, tatil, tadilat… O günlerde randevu alınamaz; sayfanızda &quot;Bugün kapalı&quot; yazar.</p>
        <ClosureForm shopId={shopId} />
      </section>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-lg font-bold">Planlanan kapalı günler</h2>
        {rows.length === 0 ? <p className="text-sm text-muted">Planlanan kapalı gün yok.</p> : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.Id} className="flex items-center justify-between gap-2 py-2">
                <span>{d(r.StartDate)}{+new Date(r.EndDate) !== +new Date(r.StartDate) && ` – ${d(r.EndDate)}`}{r.Reason && <span className="text-muted"> · {r.Reason}</span>}</span>
                <ActionButton variant="danger" action={removeClosure.bind(null, r.Id)}>Kaldır</ActionButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
