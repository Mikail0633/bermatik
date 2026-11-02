import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { call, callOne } from "@/lib/db";
import { areaCenter } from "@/lib/geo";
import { SEGMENTS, isSegment, type Segment, type ShopCard } from "@/lib/types";
import { ShopListPage } from "@/components/ShopListPage";
import { ShopList } from "@/components/ShopCard";

type Area = { ProvinceId: number; Province: string; DistrictId: number; District: string };
type Params = Promise<{ segment: string; il: string; ilce: string }>;
type Search = Promise<{ mahalle?: string }>;

const NEARBY_KM = 10;

async function load(params: Params) {
  const { segment, il, ilce } = await params;
  if (!isSegment(segment)) notFound();
  const area = await callOne<Area>("api.Area_Resolve", { ProvinceSlug: il, DistrictSlug: ilce });
  if (!area) notFound();
  return { segment, il, ilce, area };
}

// Google için: "Kadıköy berberleri" sayfası
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { segment, il, ilce, area } = await load(params);
  const seg = SEGMENTS[segment];
  return {
    title: `${area.District} ${seg.shops} (${area.Province}) — online randevu`,
    description: `${area.District}, ${area.Province} ${seg.shops}: fiyat listesi, yorumlar, açık/kapalı durumu ve bugünkü sıra. Bermatik ile hemen randevu al.`,
    alternates: { canonical: `/${segment}/${il}/${ilce}` },
  };
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { segment, il, ilce, area } = await load(params);
  const seg = SEGMENTS[segment];
  const hoodId = Number((await searchParams).mahalle) || null;
  const [hoods, center] = await Promise.all([
    call<{ Id: number; Name: string }>("api.Lookup_Neighborhoods", { DistrictId: area.DistrictId }),
    areaCenter(area.DistrictId, hoodId),
  ]);
  const crumbs = [
    { href: `/${segment}/${il}`, label: area.Province },
    { href: `/${segment}/${il}/${ilce}`, label: area.District },
  ];

  // Mahalle seçimi (sayfa yenilenir, JavaScript gerekmez)
  const picker = (
    <form className="mt-4 flex flex-wrap gap-2">
      <label className="sr-only" htmlFor="mahalle">Mahalle</label>
      <select id="mahalle" name="mahalle" defaultValue={hoodId ?? ""} className="min-w-60 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 sm:flex-none">
        <option value="">Tüm mahalleler</option>
        {hoods.map((h) => <option key={h.Id} value={h.Id}>{h.Name}</option>)}
      </select>
      <button className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-ink">Göster</button>
    </form>
  );

  // Mahalle seçildiyse: o mahalleye en yakın dükkânlar (ilçe sınırına bakmadan, mesafeyle)
  if (hoodId && center?.neighborhoodName) {
    const point = center.neighborhood ?? center.district;
    const inHood = await call<ShopCard>("api.Shop_Search", { Segment: segment, ProvinceId: area.ProvinceId, DistrictId: area.DistrictId, NeighborhoodId: hoodId, Limit: 1 });
    const shops = point
      ? await call<ShopCard>("api.Shop_Search", { Segment: segment, Latitude: point[0], Longitude: point[1], RadiusKm: NEARBY_KM, Limit: 200 })
      : await call<ShopCard>("api.Shop_Search", { Segment: segment, ProvinceId: area.ProvinceId, DistrictId: area.DistrictId, NeighborhoodId: hoodId, Limit: 1000 });
    return (
      <ShopListPage
        segment={segment}
        title={`${center.neighborhoodName} çevresindeki ${seg.shops}`}
        intro={center.neighborhood
          ? `${area.District} / ${center.neighborhoodName} mahallesine ${NEARBY_KM} km içindeki ${shops.length} ${seg.shop}, en yakından uzağa.`
          : point
          ? `${center.neighborhoodName} mahallesinin konumu haritada bulunamadı; ${area.District} merkezine ${NEARBY_KM} km içindeki ${shops.length} ${seg.shop} gösteriliyor.`
          : `${center.neighborhoodName} mahallesindeki ${shops.length} ${seg.shop}.`}
        crumbs={crumbs}
        shops={shops}
        center={point ?? undefined}
        extra={<>{picker}{inHood.length === 0 && <NoShopsNotice segment={segment} place={`${center.neighborhoodName} Mahallesi'nde`} hasNearby={shops.length > 0} />}</>}
      />
    );
  }

  // İlçenin tüm dükkânları + yakın çevredekiler (komşu ilçeler, mesafeyle)
  const [shops, nearby] = await Promise.all([
    call<ShopCard>("api.Shop_Search", { Segment: segment, ProvinceId: area.ProvinceId, DistrictId: area.DistrictId, Limit: 1000 }),
    center?.district
      ? call<ShopCard>("api.Shop_Search", {
          Segment: segment, Latitude: center.district[0], Longitude: center.district[1], RadiusKm: NEARBY_KM, ExcludeDistrictId: area.DistrictId, Limit: 30,
        })
      : Promise.resolve([] as ShopCard[]),
  ]);
  return (
    <ShopListPage
      segment={segment}
      title={`${area.District} ${seg.shops}`}
      intro={`${area.District}, ${area.Province}: ${shops.length} ${seg.shop}. Açık olanlar ve en yüksek puanlılar önce.`}
      crumbs={crumbs}
      shops={shops}
      center={center?.district ?? undefined}
      extra={<>{picker}{shops.length === 0 && <NoShopsNotice segment={segment} place={`${area.District} ilçesinde`} hasNearby={nearby.length > 0} />}</>}
      after={nearby.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-extrabold">{area.District} yakınındaki {seg.shops}</h2>
          <p className="mb-4 mt-1 text-muted">{area.District} merkezine {NEARBY_KM} km içinde, komşu bölgelerdeki {nearby.length} {seg.shop}.</p>
          <ShopList shops={nearby} />
        </section>
      )}
    />
  );
}

// "Maalesef burada berber yok" uyarısı: en yakınlar aşağıda, eksik dükkân bildirme bağlantısı
function NoShopsNotice({ segment, place, hasNearby }: { segment: Segment; place: string; hasNearby: boolean }) {
  const seg = SEGMENTS[segment];
  return (
    <div role="status" className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <p className="font-bold">😔 Maalesef {place} henüz kayıtlı {seg.shop} yok.</p>
      <p className="mt-1 text-sm text-muted">
        {hasNearby ? `Size en yakın ${seg.shops} aşağıda, en yakından uzağa sıralı.` : "Yakın çevrede de kayıtlı dükkân bulamadık."}{" "}
        Bildiğiniz bir {seg.shop} varsa <Link href="/oneri" className="font-semibold text-ink underline">bize bildirin</Link>, ekleyelim.
      </p>
    </div>
  );
}
