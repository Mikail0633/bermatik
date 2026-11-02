import Link from "next/link";
import { ExternalLink, MapPin, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";
import { LazyMap } from "@/components/LazyMap";
import { ActionButton } from "@/components/ActionButton";
import { markReviewed, setSegment } from "../dukkanlar/actions";
import { removeShopQuick } from "../actions";

export const metadata = { title: "Hızlı kontrol" };
export const dynamic = "force-dynamic";

type Next = {
  Id: string; Code: string; Segment: "erkek" | "kadin"; Name: string; Status: string; Phone: string | null; Street: string; BuildingNo: string | null;
  Source: string; ExternalRef: string | null; Neighborhood: string; District: string; Province: string; Latitude: number; Longitude: number; Remaining: number;
};

// Açık veriden (OpenStreetMap / Overture) gelen, erkek/kadın veya mahallesi tahmin edilen dükkânları tek tek gözden geçirme
export default async function Page({ searchParams }: { searchParams: Promise<{ atla?: string }> }) {
  const admin = await requireAdmin();
  const skip = ((await searchParams).atla ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const [shop] = await call<Next>("api.Admin_Shop_NextReview", { ActorId: admin.Id, SkipIds: skip.join(",") || null });

  if (!shop) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-10 text-center">
        <p className="text-4xl">🎉</p>
        <h1 className="mt-2 text-2xl font-extrabold">{skip.length ? "Atladıklarınız dışında hepsi bitti" : "Kontrol bekleyen dükkân kalmadı"}</h1>
        {skip.length > 0 && <Link href="/admin/kontrol" className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-ink">Atladıklarıma bak ({skip.length})</Link>}
      </div>
    );
  }

  const address = `${shop.Street}${shop.BuildingNo && shop.BuildingNo !== "-" ? ` No: ${shop.BuildingNo}` : ""}, ${shop.Neighborhood}, ${shop.District}/${shop.Province}`;
  const osm = shop.ExternalRef?.startsWith("osm:") ? `https://www.openstreetmap.org/${shop.ExternalRef.slice(4)}` : null;
  const seg = (s: "erkek" | "kadin") => (s === "erkek" ? "Erkek berberi" : "Kadın kuaförü");
  const other = shop.Segment === "erkek" ? "kadin" : "erkek";
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Hızlı kontrol</h1>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold">Kalan: {shop.Remaining}</span>
      </div>
      <p className="mt-1 text-sm text-muted">OpenStreetMap&apos;ten gelen bu kaydın <b>bölümü (erkek/kadın)</b> ve <b>adresi</b> tahmin edildi. Doğruysa onaylayın, değilse düzeltin.</p>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs text-muted">{shop.Code}</p>
          <h2 className="text-2xl font-extrabold">{shop.Name}</h2>
          <p className="mt-2 text-lg">Tahmin: <b className="text-accent">{seg(shop.Segment)}</b></p>
          <p className="mt-2 flex items-start gap-1 text-sm text-muted"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {address}</p>
          {shop.Phone && <p className="mt-1 flex items-center gap-1 text-sm"><Phone className="h-4 w-4" aria-hidden /> <a href={`tel:${shop.Phone}`} className="underline">{shop.Phone}</a></p>}
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {osm && <a href={osm} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">OpenStreetMap kaydı <ExternalLink className="h-3.5 w-3.5" /></a>}
            <a href={`https://www.google.com/search?q=${encodeURIComponent(`${shop.Name} ${shop.District} ${shop.Province}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">Google&apos;da ara <ExternalLink className="h-3.5 w-3.5" /></a>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <ActionButton variant="success" className="w-full py-3 text-base" action={markReviewed.bind(null, shop.Id)}>✓ Doğru ({seg(shop.Segment)})</ActionButton>
            <ActionButton variant="primary" className="w-full py-3 text-base" action={setSegment.bind(null, shop.Id, other)}>⇄ Aslında {seg(other)}</ActionButton>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/admin/dukkanlar/${shop.Id}`} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2">Adresi / bilgileri düzenle</Link>
            <Link href={`/admin/kontrol?atla=${[...skip, shop.Id].join(",")}`} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2">Sonra bakarım →</Link>
            <ActionButton variant="danger" confirm={`"${shop.Name}" silinsin mi? (Kapanmış veya berber/kuaför değilse)`} action={removeShopQuick.bind(null, shop.Id)}>Sil (kapanmış / alakasız)</ActionButton>
          </div>
        </section>
        <LazyMap points={[{ id: shop.Id, name: shop.Name, lat: Number(shop.Latitude), lng: Number(shop.Longitude) }]} zoom={17} height={360} />
      </div>
    </div>
  );
}
