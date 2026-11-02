import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, Store } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { call } from "@/lib/db";
import type { MyShop } from "./layout";
import { Search } from "lucide-react";
import { InviteCodeForm } from "./InviteCodeForm";

export const metadata = { title: "Dükkânlarım" };

type AnyShop = { Id: string; Code: string; Name: string; Status: string; District: string; OwnerName: string | null; IsClaimed: boolean; Segment: string };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser("/panel");
  const shops = await call<MyShop>("api.Shop_ListMine", { ActorId: user.Id });
  if (user.Role === "admin") {
    // Admin: sahibi olan dükkânlar (ya da arama sonucu) — her birinin sahip ve personel panelini görebilir
    const q = (await searchParams).q?.trim();
    const all = await call<AnyShop>("api.Admin_Shop_List", { ActorId: user.Id, Search: q || null, Claimed: q ? null : true, Top: 100 });
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-extrabold">İşletme panelleri</h1>
        <p className="text-sm text-muted">Admin olarak her dükkânın panelini <b>dükkân sahibi</b> ya da <b>personel</b> gözüyle görebilirsiniz.</p>
        <form className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Dükkân adı, kodu veya telefonu ara (tüm dükkânlar)" className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-3" />
          </div>
          <button className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-ink">Ara</button>
        </form>
        <p className="mt-3 text-sm text-muted">{q ? `"${q}" için ${all.length} sonuç` : `Bermatik'te olan (sahibi veya admin yönetiminde) ${all.length} dükkân`}</p>
        <ul className="mt-2 space-y-2">
          {all.map((s) => (
            <li key={s.Id}>
              <Link href={`/panel/${s.Id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
                <span className="min-w-0">
                  <span className="block truncate font-bold">{s.Name}</span>
                  <span className="block text-sm text-muted">{s.Code} · {s.District}{s.Status === "pending" ? " · onay bekliyor" : ""}</span>
                </span>
                <span className="shrink-0 text-sm text-muted">{s.IsClaimed ? (s.OwnerName ?? "Sahibi var") : "Katılmamış"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (shops.length === 1) redirect(`/panel/${shops[0].Id}`);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold">İşletme paneli</h1>
      {shops.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {shops.map((s) => (
            <li key={s.Id}>
              <Link href={`/panel/${s.Id}`} className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
                <span className="font-bold">{s.Name}</span>
                <span className="text-sm text-muted">{s.IsOwner ? "Sahibi" : "Personel"}{s.Status === "pending" ? " · onay bekliyor" : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-muted">Henüz bir dükkânınız yok. Aşağıdan başlayın:</p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/panel/yeni" className="rounded-2xl bg-primary p-5 text-primary-ink hover:opacity-90">
          <Store className="h-8 w-8" aria-hidden />
          <p className="mt-2 text-lg font-bold">Dükkânımı ekle (ilan ver)</p>
          <p className="text-sm opacity-80">Dükkân sahibiyseniz bilgilerinizi girin; onaylandıktan sonra sitede yayınlanır.</p>
        </Link>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <KeyRound className="h-8 w-8 text-accent" aria-hidden />
          <p className="mt-2 text-lg font-bold">Personel misiniz?</p>
          <p className="text-sm text-muted">Dükkân sahibinizden aldığınız davet kodunu girin.</p>
          <div className="mt-3"><InviteCodeForm /></div>
        </div>
      </div>
      <p className="mt-6 text-sm text-muted">Dükkânınız sitede &quot;Bermatik&apos;te değil&quot; olarak görünüyorsa, dükkân sayfasındaki &quot;Dükkânı sahiplen&quot; butonunu kullanın.</p>
    </div>
  );
}
