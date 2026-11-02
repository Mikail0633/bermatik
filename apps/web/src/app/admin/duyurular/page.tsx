import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";
import type { Province } from "@/lib/types";
import { AnnouncementForm } from "./AnnouncementForm";

export const metadata = { title: "Duyurular" };
export const dynamic = "force-dynamic";

type Campaign = { Id: string; Title: string; Body: string; RecipientCount: number; CreatedAtLocal: Date; ShopName: string | null };
const when = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }).format(new Date(d));

export default async function Page() {
  const admin = await requireAdmin();
  const [provinces, history] = await Promise.all([
    call<Province>("api.Lookup_Provinces"),
    call<Campaign>("api.Campaign_List", { ActorId: admin.Id }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section>
        <h1 className="text-2xl font-extrabold">Duyuru gönder</h1>
        <p className="text-sm text-muted">
          Müşterilerin <b>Bildirimler</b> sayfasına düşer (telefon bildirimini açanlara telefona da gider). Bir kişiye 7 günde en fazla 2 duyuru/kampanya gider.
          Metinde <code>{"{ad}"}</code> yazarsanız kişinin adı gelir.
        </p>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-5">
          <AnnouncementForm provinces={provinces} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-extrabold">Gönderilenler</h2>
        {history.length === 0 ? <p className="mt-2 text-muted">Henüz duyuru/kampanya gönderilmedi.</p> : (
          <ul className="mt-3 space-y-2">
            {history.map((c) => (
              <li key={c.Id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{c.Title}</p>
                  <span className="text-xs text-muted">{when(c.CreatedAtLocal)}</span>
                </div>
                <p className="text-sm text-muted">{c.Body}</p>
                <p className="mt-1 text-xs text-muted">{c.ShopName ? `${c.ShopName} kampanyası` : "Bermatik duyurusu"} · {c.RecipientCount} kişi</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
