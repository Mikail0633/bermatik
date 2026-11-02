import type { Metadata } from "next";
import { ShopStore } from "@/components/ShopStore";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BadgeCheck, CalendarPlus, ChevronDown, Clock, MapPin, Navigation, Phone, Star, Users } from "lucide-react";
import { call, callOne } from "@/lib/db";
import { getUser } from "@/lib/auth";
import {
  SEGMENTS, hhmm, initials, isSegment, shopUrl, tl,
  type Hours, type Review, type Service, type ShopDetail, type Staff,
} from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ReportButton } from "@/components/ReportButton";
import { OpenBadge, Rating } from "@/components/ShopCard";
import { LazyMap } from "@/components/LazyMap";

export const revalidate = 60;

type Params = Promise<{ segment: string; il: string; ilce: string; shop: string }>;
const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const SCHEMA_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Aynı istekte metadata ve sayfa için tek kez yükle
const load = cache(async (segment: string, il: string, ilce: string, slug: string) => {
  if (!isSegment(segment)) return null;
  const found = await callOne<{ Id: string }>("api.Shop_GetIdBySlug", { Segment: segment, ProvinceSlug: il, DistrictSlug: ilce, ShopSlug: slug });
  if (!found) return null;
  const shop = await callOne<ShopDetail>("api.Shop_Get", { ShopId: found.Id });
  return shop ?? null;
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await params;
  const shop = await load(p.segment, p.il, p.ilce, p.shop);
  if (!shop) return {};
  const seg = SEGMENTS[shop.Segment];
  return {
    title: `${shop.Name} — ${shop.District} ${seg.shop}`,
    description: (shop.Description ?? `${shop.Name}, ${shop.Neighborhood} ${shop.District}/${shop.Province}.`) +
      " Fiyat listesi, yorumlar, çalışma saatleri ve online randevu.",
    alternates: { canonical: shopUrl(shop) },
    openGraph: { title: shop.Name, description: shop.Description ?? undefined, type: "website" },
  };
}

type StoreProduct = { Id: string; Name: string; Description: string | null; Price: number; Stock: number; IsActive: boolean; CoverImagePath: string | null; ImageCount: number };

export default async function Page({ params }: { params: Params }) {
  const p = await params;
  const shop = await load(p.segment, p.il, p.ilce, p.shop);
  if (!shop) notFound();
  const seg = SEGMENTS[shop.Segment];
  const user = await getUser();
  const isFav = user ? (await call<{ Id: string }>("api.Favorite_ListMine", { ActorId: user.Id })).some((f) => f.Id.toLowerCase() === shop.Id.toLowerCase()) : false;
  if (!shop.IsClaimed) {
    const [svc, hrs] = await Promise.all([
      call<Service>("api.ShopService_List", { ShopId: shop.Id }),
      call<Hours>("api.ShopHours_Get", { ShopId: shop.Id }),
    ]);
    return <NotJoinedShop shop={shop} canClaim={user?.Role !== "customer"} isFav={isFav} loggedIn={!!user} services={svc} hours={hrs} />;
  }

  const [services, staff, reviews, hours, todayAppts, gallery, products] = await Promise.all([
    call<Service>("api.ShopService_List", { ShopId: shop.Id }),
    call<Staff>("api.Staff_List", { ShopId: shop.Id }),
    call<Review>("api.Review_List", { ShopId: shop.Id, Top: 20 }),
    call<Hours>("api.ShopHours_Get", { ShopId: shop.Id }),
    call<{ StartsAtLocal: Date }>("api.Shop_DaySchedule", { ShopId: shop.Id }),
    call<{ Id: string; Path: string; Caption: string | null; StaffName: string | null }>("api.Gallery_List", { ShopId: shop.Id }),
    shop.StoreOpen ? call<StoreProduct>("api.Product_List", { ShopId: shop.Id }) : Promise.resolve([] as StoreProduct[]),
  ]);
  const url = shopUrl(shop);
  const todayCount = todayAppts.length;
  const address = `${shop.Street} No: ${shop.BuildingNo}${shop.AddressDetail ? `, ${shop.AddressDetail}` : ""}, ${shop.Neighborhood}, ${shop.District}/${shop.Province}`;
  const minPrice = services.length ? Math.min(...services.map((s) => Number(s.Price))) : null;
  const maxPrice = services.length ? Math.max(...services.map((s) => Number(s.Price))) : null;
  const todayIdx = (new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" })).getDay() + 6) % 7;

  // Google'ın dükkânı "kuaför" olarak tanıması için yapılandırılmış veri (schema.org)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": shop.Segment === "erkek" ? "HairSalon" : "BeautySalon",
    name: shop.Name,
    description: shop.Description ?? undefined,
    url: new URL(url, process.env.SITE_URL ?? "http://localhost:3000").toString(),
    telephone: shop.Phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${shop.Street} No: ${shop.BuildingNo}`,
      addressLocality: shop.District,
      addressRegion: shop.Province,
      addressCountry: "TR",
    },
    geo: { "@type": "GeoCoordinates", latitude: Number(shop.Latitude), longitude: Number(shop.Longitude) },
    priceRange: minPrice != null ? `${tl(minPrice)} - ${tl(maxPrice!)}` : undefined,
    openingHoursSpecification: hours.filter((h) => !h.IsClosed).map((h) => ({
      "@type": "OpeningHoursSpecification", dayOfWeek: SCHEMA_DAYS[h.Weekday - 1], opens: hhmm(h.OpensAt), closes: hhmm(h.ClosesAt),
    })),
    aggregateRating: shop.AvgRating
      ? { "@type": "AggregateRating", ratingValue: Number(shop.AvgRating), reviewCount: shop.ReviewCount }
      : undefined,
  };

  return (
    <SiteShell segment={shop.Segment}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="mx-auto max-w-6xl px-4 py-6">
        <nav aria-label="Konum" className="mb-3 text-sm text-muted">
          <Link href={seg.home} className="hover:text-ink">{seg.Shops}</Link> ›{" "}
          <Link href={`/${shop.Segment}/${shop.ProvinceSlug}`} className="hover:text-ink">{shop.Province}</Link> ›{" "}
          <Link href={`/${shop.Segment}/${shop.ProvinceSlug}/${shop.DistrictSlug}`} className="hover:text-ink">{shop.District}</Link>
        </nav>

        {shop.CoverImagePath && (
          // eslint-disable-next-line @next/next/no-img-element -- fotoğraflar yüklenirken zaten küçültülüyor
          <img src={`/uploads/${shop.CoverImagePath}`} alt={shop.Name} className="mb-5 aspect-[16/9] w-full rounded-2xl object-cover sm:aspect-[21/8]" />
        )}

        {/* Başlık */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold sm:text-4xl">
              {shop.Name}
              {shop.IsCertified && <BadgeCheck className="h-7 w-7 text-accent" aria-label="Ustalık belgesi onaylı" />}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <OpenBadge shop={shop} />
              <Rating value={shop.AvgRating} count={shop.ReviewCount} />
              {shop.IsCertified && <span className="text-sm text-muted">Belgeli usta</span>}
            </div>
            {shop.ClosedReason && (
              <p className="mt-2 rounded-lg bg-closed/10 px-3 py-2 text-sm font-medium text-closed">Bugün kapalı: {shop.ClosedReason}</p>
            )}
            {shop.Description && <p className="mt-3 max-w-2xl text-muted">{shop.Description}</p>}
          </div>

          {/* Ana eylemler */}
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <Link href={`${url}/randevu`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-ink hover:opacity-90">
              <CalendarPlus className="h-5 w-5" aria-hidden /> Randevu al
            </Link>
            {shop.Phone && (
              <a href={`tel:${shop.Phone}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 py-3 font-semibold hover:bg-surface-2">
                <Phone className="h-5 w-5" aria-hidden /> Ara
              </a>
            )}
            <FavoriteButton shopId={shop.Id} initial={isFav} />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            {/* Sırayı gör: bugünkü randevular */}
            <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-accent" aria-hidden />
                <div>
                  <h2 className="text-lg font-bold">Bugünkü sıra</h2>
                  <p className="text-muted">{todayCount === 0 ? "Bugün henüz randevu yok." : `Bugün ${todayCount} randevu var.`}</p>
                </div>
              </div>
              <Link href={`${url}/sira`} className="rounded-xl bg-accent px-5 py-2.5 text-center font-bold text-accent-ink hover:brightness-105">
                Sırayı gör
              </Link>
            </section>

            {/* Fiyat listesi — açıklamalar açılır/kapanır */}
            <section>
              <h2 className="mb-3 text-2xl font-extrabold">Hizmetler ve fiyatlar</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {services.map((s) => (
                  <li key={s.Id}>
                    {shop.ShowServiceDescriptions && s.Description ? (
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 hover:bg-surface-2">
                          <ServiceRow s={s} />
                          <ChevronDown className="h-5 w-5 shrink-0 text-muted transition group-open:rotate-180" aria-label="Açıklamayı göster" />
                        </summary>
                        <p className="px-4 pb-4 text-sm text-muted">{s.Description}</p>
                      </details>
                    ) : (
                      <div className="flex items-center justify-between gap-3 p-4">
                        <ServiceRow s={s} />
                        <span className="w-5" />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* Personel */}
            {staff.length > 0 && (
              <section>
                <h2 className="mb-3 text-2xl font-extrabold">Ekibimiz</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {staff.map((st) => (
                    <div key={st.Id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
                      {st.PhotoPath ? (
                        // eslint-disable-next-line @next/next/no-img-element -- fotoğraflar yüklenirken zaten küçültülüyor
                        <img src={`/uploads/${st.PhotoPath}`} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-primary-ink">
                          {initials(st.DisplayName, 1)}
                        </span>
                      )}
                      <div className="flex-1">
                        <p className="flex items-center gap-1 font-bold">{st.DisplayName}{st.IsCertified && <BadgeCheck className="h-4 w-4 text-accent" aria-label="Belgeli" />}</p>
                        {st.Title && <p className="text-sm text-muted">{st.Title}</p>}
                      </div>
                      {st.Phone && (
                        <a href={`tel:${st.Phone}`} className="rounded-lg p-2 hover:bg-surface-2" aria-label={`${st.DisplayName}'i ara`}>
                          <Phone className="h-5 w-5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Çalışmalar (galeri) */}
            {gallery.length > 0 && (
              <section>
                <h2 className="mb-3 text-2xl font-extrabold">Çalışmalarımız</h2>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {gallery.slice(0, 12).map((g) => (
                    <li key={g.Id}>
                      <a href={`/uploads/${g.Path}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element -- fotoğraflar yüklenirken zaten küçültülüyor */}
                        <img src={`/uploads/${g.Path}`} alt={g.Caption ?? `${shop.Name} çalışma fotoğrafı`} loading="lazy" className="aspect-square w-full object-cover transition hover:scale-105" />
                      </a>
                      {(g.Caption || g.StaffName) && (
                        <p className="mt-1 truncate text-xs text-muted">{[g.Caption, g.StaffName].filter(Boolean).join(" · ")}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Ürünler (sipariş ver, dükkânda öde) */}
            {products.length > 0 && (
              <section>
                <h2 className="mb-1 text-2xl font-extrabold">Ürünler</h2>
                <p className="mb-3 text-sm text-muted">Sipariş verin, dükkân hazırlayınca gelip ödeyip alın.</p>
                <ShopStore shopId={shop.Id} products={products} />
              </section>
            )}

            {/* Yorumlar */}
            {shop.ReviewsEnabled && (
              <section>
                <h2 className="mb-3 text-2xl font-extrabold">Yorumlar</h2>
                {reviews.length === 0 ? (
                  <p className="text-muted">Henüz yorum yok. Hizmet alan müşteriler yorum yazabilir.</p>
                ) : (
                  <ul className="space-y-3">
                    {reviews.map((r) => (
                      <li key={r.Id} className="rounded-2xl border border-line bg-surface p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{r.CustomerName}</span>
                          <span className="flex" aria-label={`${r.Rating} yıldız`}>
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star key={i} className={`h-4 w-4 ${i < r.Rating ? "fill-accent text-accent" : "text-line"}`} aria-hidden />
                            ))}
                          </span>
                        </div>
                        {r.Comment && <p className="mt-1 text-muted">{r.Comment}</p>}
                        <p className="mt-1 text-xs text-muted">
                          {new Date(r.CreatedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                          {r.StaffName ? ` · ${r.StaffName}` : ""}
                        </p>
                        <div className="mt-1"><ReportButton targetType="review" targetId={r.Id} loggedIn={!!user} /></div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          {/* Yan sütun: konum, yol tarifi, çalışma saatleri */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <LazyMap points={[{ id: shop.Id, name: shop.Name, lat: Number(shop.Latitude), lng: Number(shop.Longitude) }]} zoom={16} height={260} />
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="flex gap-2 text-sm"><MapPin className="h-5 w-5 shrink-0 text-accent" aria-hidden />{address}</p>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${shop.Latitude},${shop.Longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-surface-2"
              >
                <Navigation className="h-5 w-5" aria-hidden /> Google Haritalar&apos;da yol tarifi
              </a>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="mb-2 flex items-center gap-2 font-bold"><Clock className="h-5 w-5 text-accent" aria-hidden /> Çalışma saatleri</h2>
              <table className="w-full text-sm">
                <tbody>
                  {hours.map((h) => (
                    <tr key={h.Weekday} className={h.Weekday - 1 === todayIdx ? "font-bold" : "text-muted"}>
                      <td className="py-1">{DAYS[h.Weekday - 1]}</td>
                      <td className="py-1 text-right">{h.IsClosed ? "Kapalı" : `${hhmm(h.OpensAt)} – ${hhmm(h.ClosesAt) === "23:59" ? "24:00" : hhmm(h.ClosesAt)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </aside>
        </div>
        {shop.OwnerIsAdmin && user?.Role !== "customer" && user?.Role !== "admin" && (
          <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">Bu dükkân sizin mi?</p>
              <p className="text-sm text-muted">Sahiplenin; randevuları, fiyatları ve personeli kendiniz yönetin.</p>
            </div>
            <Link href={`/isletme?sahiplen=${shop.Id}`} className="shrink-0 rounded-xl bg-accent px-5 py-2.5 font-bold text-accent-ink hover:brightness-105">Dükkânı sahiplen</Link>
          </div>
        )}
        <div className="mt-8 text-right"><ReportButton targetType="shop" targetId={shop.Id} loggedIn={!!user} label="Bu dükkânı bildir" /></div>
      </div>
    </SiteShell>
  );
}

function ServiceRow({ s }: { s: Service }) {
  return (
    <div className="flex flex-1 items-center justify-between gap-3">
      <div>
        <p className="font-semibold">{s.Name}</p>
        <p className="text-sm text-muted">{s.DurationMinutes} dk</p>
      </div>
      <p className="text-lg font-bold">{tl(Number(s.Price))}</p>
    </div>
  );
}

// Henüz Bermatik'e katılmamış dükkân: yalnızca bilgi, arama ve yol tarifi
function NotJoinedShop({ shop, canClaim, isFav, loggedIn, services, hours }: {
  shop: ShopDetail; canClaim: boolean; isFav: boolean; loggedIn: boolean; services: Service[]; hours: Hours[];
}) {
  const seg = SEGMENTS[shop.Segment];
  const address = `${shop.Street}${shop.BuildingNo && shop.BuildingNo !== "-" ? ` No: ${shop.BuildingNo}` : ""}, ${shop.Neighborhood}, ${shop.District}/${shop.Province}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": shop.Segment === "erkek" ? "HairSalon" : "BeautySalon",
    name: shop.Name,
    telephone: shop.Phone ?? undefined,
    address: { "@type": "PostalAddress", streetAddress: shop.Street, addressLocality: shop.District, addressRegion: shop.Province, addressCountry: "TR" },
    geo: { "@type": "GeoCoordinates", latitude: Number(shop.Latitude), longitude: Number(shop.Longitude) },
  };
  return (
    <SiteShell segment={shop.Segment}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }} />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <nav aria-label="Konum" className="mb-3 text-sm text-muted">
          <Link href={seg.home} className="hover:text-ink">{seg.Shops}</Link> ›{" "}
          <Link href={`/${shop.Segment}/${shop.ProvinceSlug}`} className="hover:text-ink">{shop.Province}</Link> ›{" "}
          <Link href={`/${shop.Segment}/${shop.ProvinceSlug}/${shop.DistrictSlug}`} className="hover:text-ink">{shop.District}</Link>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{shop.Name}</h1>
          <FavoriteButton shopId={shop.Id} initial={isFav} />
        </div>
        <p className="mt-1 flex items-center gap-1 text-muted"><MapPin className="h-4 w-4" aria-hidden /> {address}</p>

        <div className="mt-5 rounded-2xl border border-line bg-surface-2 p-4 text-sm">
          <p className="font-semibold">Bu {seg.shop} henüz Bermatik&apos;e katılmadı.</p>
          <p className="mt-1 text-muted">
            Randevu talebinizi bırakın, <b>dükkânı biz arayıp sizin için ayarlayalım</b>. {shop.Source === "overture" ? "Bilgiler açık veriden (Overture Maps) alınmıştır, değişmiş olabilir." : shop.Source === "osm" ? "Bilgiler OpenStreetMap'ten alınmıştır, değişmiş olabilir." : "Bilgiler değişmiş olabilir."}
          </p>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link href={`${shopUrl(shop)}/randevu`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-ink hover:opacity-90">
            <CalendarPlus className="h-5 w-5" aria-hidden /> Randevu al
          </Link>
          {shop.Phone ? (
            <a href={`tel:${shop.Phone}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 py-3 font-semibold hover:bg-surface-2">
              <Phone className="h-5 w-5" aria-hidden /> Ara
            </a>
          ) : (
            <span className="inline-flex items-center justify-center rounded-xl border border-dashed border-line px-6 py-3 text-sm text-muted">Telefon bilgisi yok</span>
          )}
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${shop.Latitude},${shop.Longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 py-3 font-semibold hover:bg-surface-2"
          >
            <Navigation className="h-5 w-5" aria-hidden /> Google Haritalar&apos;da yol tarifi
          </a>
        </div>

        {services.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xl font-extrabold">Fiyatlar</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {services.map((s) => (
                <li key={s.Id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span><span className="font-semibold">{s.Name}</span> <span className="text-sm text-muted">· {s.DurationMinutes} dk</span></span>
                  <b>{tl(Number(s.Price))}</b>
                </li>
              ))}
            </ul>
          </section>
        )}
        {hours.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xl font-extrabold">Çalışma saatleri</h2>
            <table className="w-full rounded-2xl border border-line bg-surface text-sm">
              <tbody>
                {hours.map((h) => (
                  <tr key={h.Weekday} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{DAYS[h.Weekday - 1]}</td>
                    <td className="px-4 py-2 text-right">{h.IsClosed ? "Kapalı" : `${hhmm(h.OpensAt)} – ${hhmm(h.ClosesAt) === "23:59" ? "24:00" : hhmm(h.ClosesAt)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <div className="mt-5">
          <LazyMap points={[{ id: shop.Id, name: shop.Name, lat: Number(shop.Latitude), lng: Number(shop.Longitude) }]} zoom={16} height={300} />
        </div>

        {canClaim && <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">Bu dükkân sizin mi?</p>
            <p className="text-sm text-muted">Ücretsiz sahiplenin: online randevu, bugünkü sıra ve fiyat listesi hemen açılsın.</p>
          </div>
          <Link href={`/isletme?sahiplen=${shop.Id}`} className="shrink-0 rounded-xl bg-accent px-5 py-2.5 font-bold text-accent-ink hover:brightness-105">
            Dükkânı sahiplen
          </Link>
        </div>}
        <div className="mt-6 text-right"><ReportButton targetType="shop" targetId={shop.Id} loggedIn={loggedIn} label="Bu dükkânı bildir (kapanmış, yanlış bilgi…)" /></div>
      </div>
    </SiteShell>
  );
}
