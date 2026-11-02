import { notFound } from "next/navigation";
import { call } from "@/lib/db";
import { loadPanelShop } from "../data";
import { MessageForm } from "./MessageForm";

export const metadata = { title: "Müşterilere mesaj" };

type Template = { Id: number; Title: string; Body: string; IsActive: boolean };
type Sent = { Id: string; Title: string; Body: string; OnlyDue: boolean; RecipientCount: number; DeliveredCount: number; CreatedAtLocal: Date };
const when = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }).format(new Date(d));

// Dükkân sahibi: yalnızca kendi müşterilerine, yalnızca Bermatik'in hazır mesajlarından
export default async function Page({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const { user, shop } = await loadPanelShop(shopId);
  if (!shop.IsOwner && user.Role !== "admin") notFound();
  const [templates, sent] = await Promise.all([
    call<Template>("api.Template_List", { ActorId: user.Id, ShopId: shopId }),
    call<Sent>("api.Campaign_List", { ActorId: user.Id, ShopId: shopId }),
  ]);
  const box = "rounded-2xl border border-line bg-surface p-5";
  return (
    <div className="space-y-6">
      <section className={box}>
        <h2 className="mb-1 text-lg font-bold">Müşterilerinize mesaj gönderin</h2>
        <p className="mb-4 text-sm text-muted">
          Mesaj, dükkânınızdan daha önce hizmet almış ve bildirimleri açık olan müşterilerinizin telefonuna gider.
          Hazır mesajlardan birini seçin; <b>{"{ad}"}</b> müşterinin adıyla, <b>{"{dukkan}"}</b> dükkânınızın adıyla değişir.
          Rahatsız etmemek için bir müşteriye haftada en fazla 2 mesaj gider, siz de saatte en fazla 1 mesaj gönderebilirsiniz.
        </p>
        {shop.Status !== "approved"
          ? <p className="rounded-xl bg-accent/15 px-3 py-2 text-sm">Dükkânınız yayına girince mesaj gönderebilirsiniz.</p>
          : <MessageForm shopId={shopId} shopName={shop.Name} templates={templates.filter((t) => t.IsActive)} />}
      </section>

      <section className={box}>
        <h2 className="mb-3 text-lg font-bold">Gönderilen mesajlar</h2>
        {sent.length === 0 ? <p className="text-sm text-muted">Henüz mesaj göndermediniz.</p> : (
          <ul className="divide-y divide-line">
            {sent.map((c) => (
              <li key={c.Id} className="py-2 text-sm">
                <p className="font-semibold">{c.Title}</p>
                <p className="text-muted">{when(c.CreatedAtLocal)} · {c.RecipientCount} kişiye gönderildi · {c.DeliveredCount} telefona ulaştı{c.OnlyDue ? " · yalnızca zamanı gelenler" : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
