import Link from "next/link";
import { Clock, Scissors, Star, Store } from "lucide-react";
import { call } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { SEGMENTS, type Province, type Segment, type ShopCard as Shop } from "@/lib/types";
import { SiteShell } from "./SiteShell";
import { FindNearby } from "./FindNearby";
import { AreaPicker } from "./AreaPicker";
import { ShopList } from "./ShopCard";
import { HowItWorks } from "./HowItWorks";
import { WelcomeChoice } from "./WelcomeChoice";

// Ana sayfa (erkek: "/", kadın: "/kadin")
export async function HomePage({ segment }: { segment: Segment }) {
  const seg = SEGMENTS[segment];
  const user = await getUser();
  const [provinces, categories, shops] = await Promise.all([
    call<Province>("api.Lookup_Provinces"),
    call<{ Slug: string; Name: string }>("api.ServiceCategory_List", { Segment: segment }),
    call<Shop>("api.Shop_Search", { Segment: segment, Limit: 100, ProvinceId: 6 }),
  ]);

  // Vitrin 1: şu an açık ve bugün randevusu az olanlar
  const openShort = shops
    .filter((s) => s.IsOpen)
    .sort((a, b) => a.TodayAppointments - b.TodayAppointments || Number(b.AvgRating ?? 0) - Number(a.AvgRating ?? 0))
    .slice(0, 5);
  // Vitrin 2: en yüksek puanlılar (en az 1 yorum) — ilk vitrinde çıkanlar tekrar gösterilmez
  const shown = new Set(openShort.map((s) => s.Id));
  const topRated = shops
    .filter((s) => s.AvgRating && !shown.has(s.Id))
    .sort((a, b) => Number(b.AvgRating) - Number(a.AvgRating) || b.ReviewCount - a.ReviewCount)
    .slice(0, 5);

  // "Berberler" / "Kuaförler" bölümü: Ankara'dakiler, Pursaklar ve çevresi önce
  const FOCUS = ["pursaklar", "kecioren", "cubuk", "akyurt", "altindag"];
  const rank = (s: Shop) => (FOCUS.indexOf(s.DistrictSlug) + 1 || 99);
  const ankara = shops
    .filter((s) => s.ProvinceSlug === "ankara")
    .sort((a, b) => Number(b.IsClaimed) - Number(a.IsClaimed) || rank(a) - rank(b) || a.Name.localeCompare(b.Name, "tr"))
    .slice(0, 10);

  return (
    <SiteShell segment={segment}>
      {!user && <WelcomeChoice />}
      {/* Karşılama: konum butonu + il/ilçe seçimi */}
      <section className="bg-hero text-hero-ink">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h1 className="max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">
            {segment === "erkek" ? "Berberini bul, sıra beklemeden traş ol." : "Kuaförünü bul, beklemeden randevunu al."}
          </h1>
          <p className="mt-3 max-w-xl text-base opacity-85 sm:text-lg">
            Yakınındaki {seg.shops}, fiyatlar, bugünkü sıra ve boş randevu saatleri tek ekranda.
          </p>
          <div className="mt-8">
            <FindNearby segment={segment} />
          </div>
          <div className="mt-6 max-w-2xl rounded-2xl bg-surface p-3 text-ink shadow-lg">
            <p className="mb-2 px-1 text-sm font-medium text-muted">veya il, ilçe ve mahalle seç</p>
            <AreaPicker segment={segment} provinces={provinces} />
          </div>
        </div>
      </section>

      {/* Nasıl çalışır: tıklanabilir 3 kutu */}
      <HowItWorks segment={segment} />

      {/* Hizmete göre arama */}
      <section id="hizmetler" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-10">
        <h2 className="text-2xl font-extrabold">Hizmetler</h2>
        <p className="text-sm text-muted">Bir hizmet seç, onu yapan {seg.shops} listelensin.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link key={c.Slug} href={`/${segment}/hizmet/${c.Slug}`} className="rounded-full border border-line bg-surface px-4 py-2 font-semibold shadow-sm hover:border-accent hover:bg-surface-2">
              {c.Name}
            </Link>
          ))}
        </div>
      </section>

      {(openShort.length > 0 || topRated.length > 0) && (
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 pb-10 lg:grid-cols-2">
      <Showcase
        title="Şu an açık, bugün müsait"
        subtitle="Bugün randevusu az olan yerler"
        icon={<Clock className="h-6 w-6 text-accent" aria-hidden />}
        shops={openShort}
        empty={`Şu an açık ${seg.shop} bulunamadı.`}
      />
      <Showcase
        title="En yüksek puanlılar"
        subtitle="Müşterilerin en çok beğendikleri"
        icon={<Star className="h-6 w-6 fill-accent text-accent" aria-hidden />}
        shops={topRated}
        empty="Henüz yorum yapılmış dükkân yok."
      />
      </div>
      )}

      {ankara.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-10">
          <div className="mb-4 flex items-end justify-between gap-2">
            <div className="flex items-center gap-2">
              <Scissors className="h-6 w-6 text-accent" aria-hidden />
              <div>
                <h2 className="text-2xl font-extrabold">{seg.Shops}</h2>
                <p className="text-sm text-muted">Ankara · Pursaklar ve çevresi önce</p>
              </div>
            </div>
            <Link href={`/${segment}/ankara`} className="shrink-0 text-sm font-semibold underline">Tümünü gör</Link>
          </div>
          <ShopList shops={ankara} />
        </section>
      )}

      {/* Berberler için tanıtım (müşteri hesaplarına gösterilmez) */}
      {user?.Role !== "customer" && <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-surface-2 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex gap-4">
            <Store className="h-10 w-10 shrink-0 text-accent" aria-hidden />
            <div>
              <h2 className="text-2xl font-extrabold">{segment === "erkek" ? "Berber misiniz?" : "Kuaför müsünüz?"}</h2>
              <p className="mt-1 max-w-lg text-muted">
                Dükkânınızı Bermatik&apos;e ücretsiz ekleyin. Online randevu, bugünkü sıra ve müşteri hatırlatmaları sizin için çalışsın.
              </p>
            </div>
          </div>
          <Link href="/isletme" className="shrink-0 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-ink hover:opacity-90">
            Dükkânımı ekle
          </Link>
        </div>
      </section>}
    </SiteShell>
  );
}

function Showcase({ title, subtitle, icon, shops, empty }: { title: string; subtitle: string; icon: React.ReactNode; shops: Shop[]; empty: string }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <div>
          <h2 className="text-2xl font-extrabold">{title}</h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      {shops.length ? (
        <ShopList shops={shops} />
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{empty}</p>
      )}
    </section>
  );
}
