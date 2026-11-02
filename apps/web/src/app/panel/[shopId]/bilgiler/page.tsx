import { notFound } from "next/navigation";
import { call } from "@/lib/db";
import { hhmm, type District, type Hours, type Province } from "@/lib/types";
import { ShopForm } from "@/components/admin/ShopForm";
import { CoverPhotoUpload } from "@/components/PhotoUpload";
import { HoursForm } from "@/components/admin/ShopAdminTools";
import { saveShopHours, updateShopInfo } from "@/app/panel/actions";
import { loadPanelShop } from "../data";

export const metadata = { title: "Bilgiler ve saatler" };

export default async function Page({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const { user, shop } = await loadPanelShop(shopId);
  if (!shop.IsOwner && user.Role !== "admin") notFound();
  const [provinces, districts, hoods, hours] = await Promise.all([
    call<Province>("api.Lookup_Provinces"),
    call<District>("api.Lookup_Districts", { ProvinceId: shop.ProvinceId }),
    call<{ Id: number; Name: string }>("api.Lookup_Neighborhoods", { DistrictId: shop.DistrictId }),
    call<Hours>("api.ShopHours_Get", { ShopId: shopId }),
  ]);
  const box = "rounded-2xl border border-line bg-surface p-5";
  return (
    <div className="space-y-6">
      <section className={box}>
        <h2 className="mb-1 text-lg font-bold">Kapak fotoğrafı</h2>
        <p className="mb-3 text-sm text-muted">Listelerde ve dükkân sayfanızın en üstünde görünür. Dükkânın önünü ya da içini gösteren, yatay ve aydınlık bir fotoğraf seçin.</p>
        <CoverPhotoUpload shopId={shopId} current={shop.CoverImagePath} />
      </section>
      <section className={box}>
        <h2 className="mb-3 text-lg font-bold">Çalışma saatleri</h2>
        {hours.length === 0 && <p className="mb-3 rounded-xl bg-accent/15 px-3 py-2 text-sm">Saatlerinizi girin; müşteriler ancak bu saatler içinde randevu alabilir.</p>}
        <HoursForm
          shopId={shopId}
          action={saveShopHours}
          hours={hours.map((h) => ({ Weekday: h.Weekday, IsClosed: h.IsClosed, Open: hhmm(h.OpensAt), Close: hhmm(h.ClosesAt) }))}
        />
      </section>
      <section className={box}>
        <h2 className="mb-3 text-lg font-bold">Dükkân bilgileri ve konum</h2>
        <ShopForm
          mode="edit"
          action={updateShopInfo}
          provinces={provinces}
          initialDistricts={districts}
          initialHoods={hoods}
          initial={{
            shopId, name: shop.Name, description: shop.Description, phone: shop.Phone, provinceId: shop.ProvinceId,
            districtId: shop.DistrictId, neighborhoodId: shop.NeighborhoodId, street: shop.Street, buildingNo: shop.BuildingNo,
            addressDetail: shop.AddressDetail, lat: Number(shop.Latitude), lng: Number(shop.Longitude),
            isTemporarilyClosed: shop.IsTemporarilyClosed, showServiceDescriptions: shop.ShopShowServiceDescriptions,
            storeEnabled: shop.ShopStoreEnabled, queueAvgMinutes: shop.QueueAvgMinutes, coverImagePath: shop.CoverImagePath,
          }}
        />
      </section>
    </div>
  );
}
