import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { AppError, call, callOne } from "@/lib/db";
import { hhmm, shopUrl, type District, type Hours, type Province, type ShopDetail } from "@/lib/types";
import { ShopForm } from "@/components/admin/ShopForm";
import { AssignOwnerForm, HoursForm, ShopQuickActions } from "@/components/admin/ShopAdminTools";
import { updateShop } from "../actions";
import { setShopActive, takeOverShop } from "../../actions";
import { ActionButton } from "@/components/ActionButton";
import { OwnerDocs } from "@/components/admin/OwnerDocs";

export const metadata = { title: "Dükkânı düzenle" };

type Detail = ShopDetail & {
  ProvinceId: number; DistrictId: number; NeighborhoodId: number; AddressDetail: string | null; StatusReason: string | null;
  ShopShowServiceDescriptions: boolean; ShopStoreEnabled: boolean;
};

const STATUS: Record<string, string> = { approved: "Yayında", pending: "Onay bekliyor", suspended: "Askıda", rejected: "Reddedildi" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kaydedildi?: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const saved = (await searchParams).kaydedildi === "1";
  let shop: Detail | undefined;
  try {
    shop = await callOne<Detail>("api.Shop_Get", { ShopId: id, ActorId: admin.Id });
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  if (!shop) notFound();

  const [provinces, districts, hoods, hours] = await Promise.all([
    call<Province>("api.Lookup_Provinces"),
    call<District>("api.Lookup_Districts", { ProvinceId: shop.ProvinceId }),
    call<{ Id: number; Name: string }>("api.Lookup_Neighborhoods", { DistrictId: shop.DistrictId }),
    call<Hours>("api.ShopHours_Get", { ShopId: id }),
  ]);
  const box = "rounded-2xl border border-line bg-surface p-5";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin/dukkanlar" className="text-sm text-muted underline">← Dükkânlar</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold">{shop.Name}</h1>
            <p className="text-sm text-muted">
              {shop.Code} · {shop.Segment === "erkek" ? "Erkek berberi" : "Kadın kuaförü"} · {STATUS[shop.Status] ?? shop.Status}
              {shop.IsClaimed ? " · Bermatik'e katılmış" : " · Henüz katılmadı"}
              {shop.Source === "osm" && " · OpenStreetMap"}{shop.Source === "overture" && " · Overture Maps"}
            </p>
          </div>
          {shop.Status === "approved" && (
            <Link href={shopUrl(shop)} target="_blank" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2">
              Sitede gör <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
        {saved && <p className="mt-3 rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">Dükkân eklendi ve <Link href={`/panel/${shop.Id}`} className="underline">işletme panelinize</Link> düştü. Telefon, hizmet, personel ve saat girip &quot;Aktif yap&quot; derseniz online randevu doğrudan açılır; o zamana kadar müşteriler talep bırakabilir.</p>}
        {shop.NeedsReview && (
          <p className="mt-3 rounded-xl bg-accent/15 px-3 py-2 text-sm">
            ⚠️ Bu kayıt OpenStreetMap&apos;ten geldi; <b>erkek/kadın bölümü veya mahallesi tahmin edildi</b>. Kontrol edip düzeltin ya da &quot;Bilgiler doğru&quot; deyin.
          </p>
        )}
      </div>

      {shop.Status === "pending" && shop.Source === "owner" && (
        <section className={box}>
          <h2 className="mb-2 font-bold">Sahiplik belgesi (başvuru)</h2>
          <OwnerDocs shopId={shop.Id} />
        </section>
      )}

      <section className={box}>
        <h2 className="mb-1 font-bold">Dükkânın her şeyini yönet</h2>
        <p className="mb-3 text-sm text-muted">Dükkân sahibi gibi; yaptığınız değişiklik sitede hemen görünür.</p>
        {(!shop.IsClaimed || shop.OwnerIsAdmin) && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-3 text-sm">
            {shop.IsClaimed ? (
              <>
                <span><b className="text-open">● Aktif</b> — sizin yönetiminizde; online randevu açık. Gelen randevular işletme panelinize düşer.</span>
                <ActionButton variant="danger" confirm="Online randevu kapatılsın mı?" action={setShopActive.bind(null, shop.Id, false)}>Pasif yap</ActionButton>
              </>
            ) : (
              <>
                <span><b>○ Katılmamış</b> — sitede yalnızca bilgi ve &quot;Ara&quot; var. Telefon, hizmet, personel ve saat girip aktif yaparsanız <b>Randevu al</b> açılır.</span>
                {!shop.OwnerIsAdmin && <ActionButton action={takeOverShop.bind(null, shop.Id)}>İşletme panelime al</ActionButton>}
                <ActionButton variant="success" action={setShopActive.bind(null, shop.Id, true)}>Aktif yap</ActionButton>
              </>
            )}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["hizmetler", "Hizmetler ve fiyatlar"],
            ["personel", "Personel, mola, izin"],
            ["kapali-gunler", "Kapalı günler"],
            ["randevular", "Randevular"],
            ["", "Bugün"],
            ["bilgiler", "Bilgiler ve saatler"],
          ].map(([slug, label]) => (
            <Link key={slug} href={`/panel/${shop.Id}${slug ? `/${slug}` : ""}`} className="rounded-xl border border-line px-3 py-2.5 text-sm font-semibold hover:bg-surface-2">
              {label} →
            </Link>
          ))}
        </div>
      </section>

      <section className={box}>
        <h2 className="mb-3 font-bold">Hızlı işlemler</h2>
        <ShopQuickActions shopId={shop.Id} status={shop.Status} segment={shop.Segment} needsReview={shop.NeedsReview} />
      </section>

      <section className={box}>
        <h2 className="mb-3 font-bold">Dükkân bilgileri ve konum</h2>
        <ShopForm
          mode="edit"
          action={updateShop}
          provinces={provinces}
          initialDistricts={districts}
          initialHoods={hoods}
          initial={{
            shopId: shop.Id, name: shop.Name, description: shop.Description, phone: shop.Phone,
            provinceId: shop.ProvinceId, districtId: shop.DistrictId, neighborhoodId: shop.NeighborhoodId,
            street: shop.Street, buildingNo: shop.BuildingNo, addressDetail: shop.AddressDetail,
            lat: Number(shop.Latitude), lng: Number(shop.Longitude),
            isTemporarilyClosed: shop.IsTemporarilyClosed, showServiceDescriptions: shop.ShopShowServiceDescriptions,
            storeEnabled: shop.ShopStoreEnabled, queueAvgMinutes: shop.QueueAvgMinutes, coverImagePath: shop.CoverImagePath,
          }}
        />
      </section>

      <section className={box}>
        <h2 className="mb-3 font-bold">Çalışma saatleri</h2>
        <HoursForm
          shopId={shop.Id}
          hours={hours.map((h) => ({ Weekday: h.Weekday, IsClosed: h.IsClosed, Open: hhmm(h.OpensAt), Close: hhmm(h.ClosesAt) }))}
        />
      </section>

      {!shop.IsClaimed && (
        <section className={box}>
          <h2 className="mb-3 font-bold">Dükkân sahibine devret</h2>
          <AssignOwnerForm shopId={shop.Id} />
        </section>
      )}
    </div>
  );
}
