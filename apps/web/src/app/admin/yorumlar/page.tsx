import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { setReviewHidden } from "../actions";

export const metadata = { title: "Yorumlar" };
export const dynamic = "force-dynamic";

type Review = {
  Id: string; Rating: number; Comment: string | null; IsHidden: boolean; CreatedAtLocal: Date;
  Code: string; ShopName: string; CustomerName: string; Email: string;
};
const when = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }).format(new Date(d));

export default async function Page({ searchParams }: { searchParams: Promise<{ gizli?: string }> }) {
  const admin = await requireAdmin();
  const onlyHidden = (await searchParams).gizli === "1";
  const all = await call<Review>("api.Admin_Review_List", { ActorId: admin.Id });
  const rows = onlyHidden ? all.filter((r) => r.IsHidden) : all;
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-extrabold">Yorumlar</h1>
      <p className="text-sm text-muted">Son 200 yorum. Uygunsuz yorumu gizleyebilirsiniz; gizlenen yorum sitede görünmez ve puana katılmaz.</p>
      <div className="mt-3 flex gap-2 text-sm">
        <a href="?" className={`rounded-lg px-3 py-1.5 font-semibold ${onlyHidden ? "border border-line" : "bg-primary text-primary-ink"}`}>Tümü</a>
        <a href="?gizli=1" className={`rounded-lg px-3 py-1.5 font-semibold ${onlyHidden ? "bg-primary text-primary-ink" : "border border-line"}`}>Gizlenenler</a>
      </div>
      {rows.length === 0 ? <p className="mt-6 text-muted">Yorum yok.</p> : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.Id} className={`rounded-2xl border border-line bg-surface p-4 ${r.IsHidden ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold"><span className="text-accent">{"★".repeat(r.Rating)}</span><span className="text-line">{"★".repeat(5 - r.Rating)}</span> · {r.ShopName} <span className="text-xs font-normal text-muted">{r.Code}</span></p>
                  <p className="text-xs text-muted">{r.CustomerName} ({r.Email}) · {when(r.CreatedAtLocal)}{r.IsHidden && " · GİZLİ"}</p>
                </div>
                {r.IsHidden
                  ? <ActionButton action={setReviewHidden.bind(null, r.Id, false)}>Tekrar göster</ActionButton>
                  : <ActionButton variant="danger" action={setReviewHidden.bind(null, r.Id, true)}>Gizle</ActionButton>}
              </div>
              {r.Comment && <p className="mt-2">{r.Comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
