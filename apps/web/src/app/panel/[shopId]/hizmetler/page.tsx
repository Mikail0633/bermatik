import { notFound } from "next/navigation";
import { call } from "@/lib/db";
import { tl } from "@/lib/types";
import { ActionButton } from "@/components/ActionButton";
import { deleteService } from "@/app/panel/actions";
import { loadPanelShop } from "../data";
import { ServiceForm } from "./ServiceForm";

export const metadata = { title: "Hizmetler ve fiyatlar" };

type Row = {
  Id: string; CategoryId: number; CategoryName: string; Name: string; Description: string | null; OwnDescription: string | null;
  Price: number; DurationMinutes: number; IsActive: boolean; SortOrder: number;
};

export default async function Page({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const { user, shop } = await loadPanelShop(shopId);
  if (!shop.IsOwner && user.Role !== "admin") notFound();
  const [rows, categories] = await Promise.all([
    call<Row>("api.ShopService_List", { ShopId: shopId, ActorId: user.Id }),
    call<{ Id: number; Name: string; Description: string | null }>("api.ServiceCategory_List", { Segment: shop.Segment }),
  ]);
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 text-lg font-bold">Yeni hizmet ekle</h2>
        <p className="mb-3 text-sm text-muted">Fiyatları siz belirlersiniz. Açıklama yazmazsanız Bermatik&apos;in hazır açıklaması gösterilir.</p>
        <ServiceForm shopId={shopId} categories={categories} />
      </section>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-lg font-bold">Fiyat listeniz</h2>
        {rows.length === 0 ? <p className="text-sm text-muted">Henüz hizmet eklemediniz.</p> : (
          <ul className="divide-y divide-line">
            {rows.map((s) => (
              <li key={s.Id} className="py-3">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-semibold">{s.Name}</span> <span className="text-sm text-muted">· {s.CategoryName} · {s.DurationMinutes} dk{!s.IsActive && " · pasif"}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <b>{tl(Number(s.Price))}</b>
                      <span className="text-sm underline">Düzenle</span>
                    </span>
                  </summary>
                  <div className="mt-3 rounded-xl bg-surface-2 p-3">
                    <ServiceForm shopId={shopId} categories={categories} initial={s} />
                    <div className="mt-2"><ActionButton variant="danger" confirm="Hizmet kaldırılsın mı?" action={deleteService.bind(null, s.Id)}>Hizmeti kaldır</ActionButton></div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
