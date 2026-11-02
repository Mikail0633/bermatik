import { call, callOne } from "@/lib/db";
import { tl } from "@/lib/types";
import { ActionButton } from "@/components/ActionButton";
import { deleteProduct, setOrderStatus } from "@/app/magaza-actions";
import { loadPanelShop } from "../data";
import { ProductForm, ProductPhotos } from "./client";

export const metadata = { title: "Mağaza" };

type Order = { Id: string; Status: string; Total: number; Note: string | null; CreatedAtLocal: Date; CustomerName: string; CustomerPhone: string | null; Items: string };
type Product = { Id: string; Name: string; Description: string | null; Price: number; Stock: number; IsActive: boolean; CoverImagePath: string | null; ImageCount: number };
type Img = { Id: string; Path: string; IsCover: boolean };

const when = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
const STATUS: Record<string, string> = { pending: "Yeni", ready: "Hazır, müşteri bekleniyor", picked_up: "Teslim edildi", cancelled: "İptal" };

// Ürünleri sahip, personel ve admin yönetir. Ödeme salonda; kargo yok.
export default async function Page({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const { user, shop } = await loadPanelShop(shopId);
  const [settings, orders, products] = await Promise.all([
    callOne<{ StoreEnabled: boolean }>("api.Settings_Get"),
    call<Order>("api.Order_ListForShop", { ActorId: user.Id, ShopId: shopId }),
    call<Product>("api.Product_List", { ShopId: shopId, ActorId: user.Id }),
  ]);
  const images = new Map(await Promise.all(products.map(async (p) => [p.Id, await call<Img>("api.Product_Images", { ProductId: p.Id, ActorId: user.Id })] as const)));
  const open = orders.filter((o) => o.Status === "pending" || o.Status === "ready");
  const past = orders.filter((o) => o.Status !== "pending" && o.Status !== "ready").slice(0, 20);
  const box = "rounded-2xl border border-line bg-surface p-5";

  return (
    <div className="space-y-6">
      {!settings?.StoreEnabled ? (
        <p className="rounded-xl bg-accent/15 px-3 py-2 text-sm">Ürün satışı Bermatik genelinde henüz açılmadı. Ürünlerinizi şimdiden ekleyebilirsiniz; satış açılınca dükkân sayfanızda görünür.</p>
      ) : !shop.ShopStoreEnabled ? (
        <p className="rounded-xl bg-accent/15 px-3 py-2 text-sm">Dükkânınızda ürün satışı kapalı. Açmak için <b>Bilgiler ve saatler</b> sekmesinde &quot;Ürün satışı&quot; kutusunu işaretleyin.</p>
      ) : shop.StoreOpen ? (
        <p className="rounded-xl bg-open/10 px-3 py-2 text-sm text-open">Ürünleriniz dükkân sayfanızda satışta. Müşteri sipariş verir, siz hazırlayınca gelip <b>dükkânda öder</b> ve alır.</p>
      ) : null}

      <section className={box}>
        <h2 className="mb-3 text-lg font-bold">Siparişler {open.length > 0 && <span className="text-accent">({open.length} açık)</span>}</h2>
        {open.length === 0 ? <p className="text-sm text-muted">Bekleyen sipariş yok.</p> : (
          <ul className="space-y-3">
            {open.map((o) => (
              <li key={o.Id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-bold">{o.CustomerName} · {tl(Number(o.Total))}</p>
                    <p>{o.Items}</p>
                    <p className="text-muted">{when(o.CreatedAtLocal)} · {STATUS[o.Status]}{o.CustomerPhone && <> · <a href={`tel:${o.CustomerPhone}`} className="underline">{o.CustomerPhone}</a></>}</p>
                    {o.Note && <p className="mt-1 rounded-lg bg-surface-2 px-2 py-1">Not: {o.Note}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {o.Status === "pending" && <ActionButton variant="success" action={setOrderStatus.bind(null, o.Id, "ready")}>Hazır</ActionButton>}
                    {o.Status === "ready" && <ActionButton variant="success" action={setOrderStatus.bind(null, o.Id, "picked_up")}>Teslim edildi</ActionButton>}
                    <ActionButton variant="danger" confirm="Sipariş iptal edilsin mi? Müşteriye haber verilir." action={setOrderStatus.bind(null, o.Id, "cancelled")}>İptal</ActionButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold underline">Geçmiş siparişler</summary>
            <ul className="mt-2 divide-y divide-line">
              {past.map((o) => <li key={o.Id} className="py-1.5">{when(o.CreatedAtLocal)} · {o.CustomerName} · {o.Items} · {tl(Number(o.Total))} · <span className="text-muted">{STATUS[o.Status]}</span></li>)}
            </ul>
          </details>
        )}
      </section>

      <section className={box}>
        <h2 className="mb-3 text-lg font-bold">Yeni ürün ekle</h2>
        <ProductForm shopId={shopId} />
      </section>

      {products.map((p) => (
        <section key={p.Id} className={`${box} ${p.IsActive ? "" : "opacity-70"}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">{p.Name} {!p.IsActive && <span className="text-sm font-normal text-muted">(satışta değil)</span>}</h2>
              <p className="text-sm text-muted">{tl(Number(p.Price))} · Stok: {p.Stock}{p.Stock === 0 && <b className="text-closed"> — tükendi</b>}</p>
            </div>
            <ActionButton variant="danger" confirm={`"${p.Name}" silinsin mi?`} action={deleteProduct.bind(null, p.Id)}>Sil</ActionButton>
          </div>
          <div className="mt-3"><ProductPhotos productId={p.Id} images={images.get(p.Id) ?? []} /></div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold underline">Bilgileri düzenle</summary>
            <div className="mt-3"><ProductForm shopId={shopId} initial={p} /></div>
          </details>
        </section>
      ))}
    </div>
  );
}
