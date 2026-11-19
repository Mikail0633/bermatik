import { call } from "@/lib/db";
import { loadPanelShop } from "../data";
import { ReplyForm } from "./ReplyForm";

export const metadata = { title: "Yorumlar" };
export const dynamic = "force-dynamic";

type Review = {
  Id: string; Rating: number; Comment: string | null; CreatedAtLocal: Date; CustomerName: string; StaffName: string | null;
  ReplyText: string | null; ReplyAtLocal: Date | null; ReplyByName: string | null;
};
const day = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export default async function Page({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const { user, shop } = await loadPanelShop(shopId);
  const full = shop.IsOwner || user.Role === "admin";
  const rows = await call<Review>("api.Panel_Reviews", { ActorId: user.Id, ShopId: shopId });
  const avg = rows.length ? rows.reduce((s, r) => s + r.Rating, 0) / rows.length : 0;
  const waiting = rows.filter((r) => !r.ReplyText).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Yorumlar</h2>
        <p className="text-sm text-muted">
          {rows.length ? <>{full ? "Dükkânınız" : "Siz"} için {rows.length} yorum · ortalama <b className="text-ink">{avg.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</b> ★{waiting ? ` · ${waiting} yorum cevap bekliyor` : ""}</> : null}
        </p>
      </div>
      {!full && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">Burada yalnızca <b>sizin</b> yaptığınız randevularla ilgili yorumlar görünür; bunlara cevap yazabilirsiniz.</p>}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">Henüz yorum yok. Müşteriler tamamlanan randevularından sonra yorum yazabilir.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.Id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold"><span className="text-primary" aria-label={`${r.Rating} yıldız`}>{stars(r.Rating)}</span> {r.CustomerName}</p>
                <p className="text-xs text-muted">{day(r.CreatedAtLocal)}{r.StaffName ? ` · ${r.StaffName}` : ""}</p>
              </div>
              {r.Comment ? <p className="mt-1 whitespace-pre-line text-sm">{r.Comment}</p> : <p className="mt-1 text-sm text-muted">Yorum yazmadan puan verdi.</p>}
              {r.ReplyText && (
                <div className="mt-3 rounded-xl border-l-4 border-primary bg-surface-2 px-3 py-2 text-sm">
                  <p className="text-xs font-semibold text-muted">İşletmenin cevabı{r.ReplyByName ? ` · ${r.ReplyByName}` : ""}{r.ReplyAtLocal ? ` · ${day(r.ReplyAtLocal)}` : ""}</p>
                  <p className="mt-0.5 whitespace-pre-line">{r.ReplyText}</p>
                </div>
              )}
              <div className="mt-3"><ReplyForm key={r.ReplyText ?? "yok"} reviewId={r.Id} shopId={shopId} current={r.ReplyText} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
