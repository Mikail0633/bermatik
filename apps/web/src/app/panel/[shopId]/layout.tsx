import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { shopUrl } from "@/lib/types";
import { getPanelView, loadPanelShop } from "./data";
import { ViewSwitch } from "./ViewSwitch";

const TABS = [
  { slug: "", label: "Bugün", owner: false },
  { slug: "randevular", label: "Randevular", owner: false },
  { slug: "bilgiler", label: "Bilgiler ve saatler", owner: true },
  { slug: "hizmetler", label: "Hizmetler ve fiyatlar", owner: true },
  { slug: "personel", label: "Personel", owner: true },
  { slug: "galeri", label: "Fotoğraflar", owner: false },
  { slug: "magaza", label: "Mağaza", owner: false },
  { slug: "mesajlar", label: "Müşterilere mesaj", owner: true },
  { slug: "kapali-gunler", label: "Kapalı günler", owner: true },
];

export default async function ShopPanelLayout({ children, params }: { children: React.ReactNode; params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const { user, shop } = await loadPanelShop(shopId);
  const isAdmin = user.Role === "admin";
  const view = isAdmin ? await getPanelView() : "sahip";
  const canManage = (shop.IsOwner || isAdmin) && view !== "personel";
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">{shop.Name}</h1>
          <p className="text-sm text-muted">{shop.Code} · {shop.Segment === "erkek" ? "Erkek berberi" : "Kadın kuaförü"} · {isAdmin ? (view === "personel" ? "Personel gözüyle bakıyorsunuz" : "Dükkân sahibi gözüyle bakıyorsunuz") : shop.IsOwner ? "Sahibi" : "Personel"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {isAdmin && <ViewSwitch view={view} />}
        {shop.Status === "approved" && (
          <Link href={shopUrl(shop)} target="_blank" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2">
            Sayfamı gör <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        )}
        </div>
      </div>
      {isAdmin && view === "personel" && (
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">👁 <b>Personel görünümü</b>: personel yalnızca &quot;Bugün&quot; ve &quot;Randevular&quot; sekmelerini görür; randevularda yalnızca kendisine ait olanları görür, fiyat/personel/saat ayarlarını değiştiremez.</p>
      )}
      {shop.Status === "pending" && (
        <p className="mt-3 rounded-xl bg-accent/15 px-3 py-2 text-sm">⏳ Dükkânınız <b>Bermatik ekibinin onayını bekliyor</b>. Bu sırada hizmetlerinizi, fiyatlarınızı, personelinizi ve saatlerinizi girebilirsiniz; onaylanınca sitede yayınlanır.</p>
      )}
      {(shop.Status === "suspended" || shop.Status === "rejected") && (
        <p className="mt-3 rounded-xl bg-closed/10 px-3 py-2 text-sm text-closed">Dükkânınız şu an yayında değil{shop.StatusReason ? `: ${shop.StatusReason}` : ""}. Bilgi için bizimle iletişime geçin.</p>
      )}
      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.filter((t) => canManage || !t.owner).map((t) => (
          <Link key={t.slug} href={`/panel/${shopId}${t.slug ? `/${t.slug}` : ""}`} className="shrink-0 rounded-t-lg px-3 py-2 text-sm font-semibold hover:bg-surface-2">
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-5">{children}</div>
    </div>
  );
}
