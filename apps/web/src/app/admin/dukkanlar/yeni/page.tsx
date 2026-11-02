import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";
import { reverseGeocode } from "@/lib/geo";
import type { District, Province } from "@/lib/types";
import { ShopForm } from "@/components/admin/ShopForm";
import { createShop } from "../actions";

export const metadata = { title: "Yeni dükkân" };

type SP = { oneri?: string; ad?: string; bolum?: string; tel?: string; lat?: string; lng?: string };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const provinces = await call<Province>("api.Lookup_Provinces");
  const lat = Number(sp.lat), lng = Number(sp.lng);
  const hasPos = sp.lat && Number.isFinite(lat) && Number.isFinite(lng);

  // Bildirimden geldiyse konumdan adres; değilse varsayılan Ankara / Pursaklar
  let provinceId = 6, districtId: number | undefined, neighborhoodId: number | undefined, street: string | undefined, buildingNo: string | undefined;
  if (hasPos) {
    const a = await reverseGeocode(lat, lng);
    provinceId = a.provinceId ?? 6;
    districtId = a.districtId ?? undefined;
    neighborhoodId = a.neighborhoodId ?? undefined;
    street = a.street ?? undefined;
    buildingNo = a.houseNumber ?? undefined;
  }
  const districts = await call<District>("api.Lookup_Districts", { ProvinceId: provinceId });
  districtId ??= districts.find((d) => d.Slug === "pursaklar")?.Id;
  const hoods = districtId ? await call<{ Id: number; Name: string }>("api.Lookup_Neighborhoods", { DistrictId: districtId }) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={sp.oneri ? "/admin/talepler" : "/admin/dukkanlar"} className="text-sm text-muted underline">← Geri</Link>
      <h1 className="mt-2 text-2xl font-extrabold">Yeni dükkân ekle</h1>
      <p className="text-muted">
        {sp.oneri ? "Kullanıcı bildiriminden dolduruldu; kontrol edip kaydedin." : "Eklediğiniz dükkân hemen yayına girer ve \"henüz Bermatik'e katılmadı\" olarak görünür."}
      </p>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <ShopForm
          mode="create"
          action={createShop}
          provinces={provinces}
          initialDistricts={districts}
          initialHoods={hoods}
          hidden={sp.oneri ? { suggestionId: sp.oneri } : {}}
          initial={{
            segment: sp.bolum === "kadin" ? "kadin" : "erkek", name: sp.ad, phone: sp.tel,
            provinceId, districtId, neighborhoodId, street, buildingNo,
            lat: hasPos ? lat : undefined, lng: hasPos ? lng : undefined,
          }}
        />
      </div>
    </div>
  );
}
