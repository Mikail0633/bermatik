import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { call } from "@/lib/db";
import type { District, Province } from "@/lib/types";
import { ShopForm } from "@/components/admin/ShopForm";
import { applyShop } from "../actions";

export const metadata = { title: "Dükkân ekle" };

// İlan ver: berber kendi dükkânını ekler → admin onaylar → sitede yayınlanır
export default async function Page() {
  const user = await requireUser("/panel/yeni");
  const provinces = await call<Province>("api.Lookup_Provinces");
  const districts = await call<District>("api.Lookup_Districts", { ProvinceId: 6 });
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel" className="text-sm text-muted underline">← İşletme paneli</Link>
      <h1 className="mt-2 text-2xl font-extrabold">Dükkânımı ekle</h1>
      <p className="text-muted">Bilgilerinizi girin. Bermatik ekibi kontrol edip onayladıktan sonra dükkânınız sitede yayınlanır. Ardından hizmet, fiyat ve personel eklersiniz.</p>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <ShopForm mode="create" action={applyShop} provinces={provinces} initialDistricts={districts} initial={{ provinceId: 6, phone: user.Phone }} />
      </div>
    </div>
  );
}
