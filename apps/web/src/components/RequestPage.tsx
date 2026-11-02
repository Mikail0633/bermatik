import Link from "next/link";
import { call } from "@/lib/db";
import { shopUrl, type ShopDetail } from "@/lib/types";
import type { SessionUser } from "@/lib/auth";
import { SiteShell } from "./SiteShell";
import { RequestForm } from "./RequestForm";

// Bermatik'e katılmamış dükkânın randevu sayfası: talep formu
export async function RequestPage({ shop, user }: { shop: ShopDetail; user: SessionUser | null }) {
  const url = shopUrl(shop);
  const here = `${url}/randevu`;
  const categories = await call<{ Id: number; Name: string }>("api.ServiceCategory_List", { Segment: shop.Segment });
  return (
    <SiteShell segment={shop.Segment}>
      <div className="mx-auto max-w-xl px-4 py-6">
        <Link href={url} className="text-sm text-muted underline">← {shop.Name}</Link>
        <h1 className="mt-2 text-3xl font-extrabold">Randevu al</h1>
        <p className="text-muted">{shop.Name} · {shop.District}</p>
        <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm">
          Bu dükkân henüz Bermatik&apos;e katılmadı. Talebinizi bırakın; <b>dükkânı biz arayıp sizin için ayarlayalım</b>.
          Onaylanınca bildirim gelir ve Randevularım sayfanızda görünür.
        </p>
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
          {user ? (
            <RequestForm shopId={shop.Id} categories={categories} />
          ) : (
            <div className="text-center">
              <p>Talep bırakmak için giriş yapın; size ulaşabilmemiz için telefonunuz gerekli.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href={`/giris?sonra=${encodeURIComponent(here)}`} className="rounded-xl border border-line px-5 py-2.5 font-semibold">Giriş yap</Link>
                <Link href={`/kayit?sonra=${encodeURIComponent(here)}`} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-ink">Kayıt ol</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
