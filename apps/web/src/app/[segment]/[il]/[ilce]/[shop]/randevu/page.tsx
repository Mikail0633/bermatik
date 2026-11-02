import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { call, callOne } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { isSegment, shopUrl, type Service, type ShopDetail, type Staff } from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";
import { BookingWizard } from "@/components/BookingWizard";
import { RequestPage } from "@/components/RequestPage";

export const metadata: Metadata = { title: "Randevu al", robots: { index: false } };
export const dynamic = "force-dynamic";

type Params = Promise<{ segment: string; il: string; ilce: string; shop: string }>;

export default async function Page({ params, searchParams }: { params: Params; searchParams: Promise<{ hizmet?: string; personel?: string }> }) {
  const p = await params;
  if (!isSegment(p.segment)) notFound();
  const found = await callOne<{ Id: string }>("api.Shop_GetIdBySlug", { Segment: p.segment, ProvinceSlug: p.il, DistrictSlug: p.ilce, ShopSlug: p.shop });
  if (!found) notFound();
  const user = await getUser();
  const shop = await callOne<ShopDetail>("api.Shop_Get", { ShopId: found.Id, ActorId: user?.Id ?? null });
  if (!shop) notFound();
  const url = shopUrl(shop);
  const sp = await searchParams;

  if (!shop.IsClaimed) return <RequestPage shop={shop} user={user} />;

  const [services, staff] = await Promise.all([
    call<Service>("api.ShopService_List", { ShopId: shop.Id }),
    call<Staff>("api.Staff_List", { ShopId: shop.Id }),
  ]);
  return (
    <SiteShell segment={shop.Segment}>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link href={url} className="text-sm text-muted underline">← {shop.Name}</Link>
        <h1 className="mt-2 text-3xl font-extrabold">Randevu al</h1>
        <p className="text-muted">{shop.Name} · {shop.District}</p>
        {!user && (
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            Seçimlerinizi yapın; onaylarken giriş yapmanız istenecek. Hesabınız yoksa 1 dakikada <Link href={`/kayit?sonra=${encodeURIComponent(url + "/randevu")}`} className="font-semibold underline">kayıt olabilirsiniz</Link>.
          </p>
        )}
        <div className="mt-6">
          {services.length && staff.length ? (
            <BookingWizard
              shopId={shop.Id}
              services={services}
              staff={staff}
              back={`${url}/randevu`}
              initialServices={sp.hizmet?.split(",") ?? []}
              initialStaff={sp.personel}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Bu dükkân henüz hizmet veya personel eklemedi. Telefonla randevu alabilirsiniz.</p>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
