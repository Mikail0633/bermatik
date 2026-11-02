import Link from "next/link";
import { BadgeCheck, ChevronRight, Star, Users } from "lucide-react";
import { distanceLabel, hhmm, initials, shopUrl, type ShopCard as Shop } from "@/lib/types";

export function OpenBadge({ shop, compact = false }: { shop: Pick<Shop, "IsOpen" | "OpensAt" | "ClosesAt">; compact?: boolean }) {
  const time = shop.IsOpen ? shop.ClosesAt && `Kapanış ${hhmm(shop.ClosesAt)}` : shop.OpensAt && `Açılış ${hhmm(shop.OpensAt)}`;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        shop.IsOpen ? "bg-open/10 text-open" : "bg-closed/10 text-closed"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${shop.IsOpen ? "bg-open" : "bg-closed"}`} />
      {shop.IsOpen ? (compact ? "Açık" : "Şu an açık") : "Kapalı"}
      {!compact && time ? ` · ${time}` : ""}
    </span>
  );
}

export function Rating({ value, count }: { value: number | null; count: number }) {
  if (!value) return <span className="text-xs text-muted">Yeni</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold">
      <Star className="h-4 w-4 fill-accent text-accent" aria-hidden />
      {Number(value).toFixed(1)}
      <span className="font-normal text-muted">({count})</span>
    </span>
  );
}

// Dükkân fotoğrafı; yüklenmemişse baş harfli renkli kutu
export function ShopThumb({ shop, size = 64 }: { shop: Pick<Shop, "Name" | "CoverImagePath">; size?: number }) {
  if (shop.CoverImagePath) {
    // eslint-disable-next-line @next/next/no-img-element -- yüklenen fotoğraflar sonradan optimize edilecek
    return <img src={`/uploads/${shop.CoverImagePath}`} alt="" width={size} height={size} className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />;
  }
  const letters = initials(shop.Name);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-lg font-extrabold text-primary-ink"
      style={{ width: size, height: size }}
    >
      {letters}
    </span>
  );
}

// Sade liste satırı: solda fotoğraf, ortada isim/adres, sağda açık/kapalı ve puan
export function ShopRow({ shop }: { shop: Shop }) {
  return (
    <li>
      <Link href={shopUrl(shop)} className="flex items-center gap-3 p-3 transition hover:bg-surface-2 sm:gap-4 sm:p-4">
        <ShopThumb shop={shop} />
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-snug">
            <span className="line-clamp-2 break-words">
              {shop.Name}
              {shop.IsCertified && <BadgeCheck className="ml-1 inline h-4 w-4 align-[-2px] text-accent" aria-label="Belgeli usta" />}
            </span>
          </p>
          {/* Mesafe başta: dar ekranda adres kısalsa da mesafe görünsün */}
          <p className="truncate text-sm text-muted">
            {shop.DistanceKm != null && <span className="font-semibold text-ink">{distanceLabel(Number(shop.DistanceKm))} · </span>}
            {shop.Neighborhood.replace(/ Mahallesi$/, "")}, {shop.District}
          </p>
          {shop.IsClaimed && shop.TodayAppointments != null && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {shop.TodayAppointments === 0 ? "Bugün randevu yok" : `Bugün ${shop.TodayAppointments} randevu`}
            </p>
          )}
          {!shop.IsClaimed && <p className="mt-0.5 text-xs text-muted">Henüz Bermatik&apos;te değil</p>}
        </div>
        {shop.IsClaimed && (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <OpenBadge shop={shop} compact />
            <Rating value={shop.AvgRating} count={shop.ReviewCount} />
          </div>
        )}
        <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted sm:block" aria-hidden />
      </Link>
    </li>
  );
}

export function ShopList({ shops }: { shops: Shop[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {shops.map((s) => (
        <ShopRow key={s.Id} shop={s} />
      ))}
    </ul>
  );
}
