// Veritabanı işlemlerinin döndürdüğü satırlar

export type Segment = "erkek" | "kadin";

// shopAcc: belirtme hâli ("berberi" / "kuaförü") — Türkçe ses uyumu için ayrı yazıldı
export const SEGMENTS: Record<Segment, { label: string; shop: string; shopAcc: string; shops: string; Shops: string; home: string }> = {
  erkek: { label: "Erkek", shop: "berber", shopAcc: "berberi", shops: "berberler", Shops: "Berberler", home: "/" },
  kadin: { label: "Kadın", shop: "kuaför", shopAcc: "kuaförü", shops: "kuaförler", Shops: "Kuaförler", home: "/kadin" },
};

export function isSegment(v: string): v is Segment {
  return v === "erkek" || v === "kadin";
}

export type Province = { Id: number; Name: string; Slug: string };
export type District = { Id: number; Name: string; Slug: string };

export type ShopCard = {
  Id: string;
  Code: string;
  Segment: Segment;
  Name: string;
  Slug: string;
  ProvinceSlug: string;
  DistrictSlug: string;
  Phone: string | null;
  Street: string;
  BuildingNo: string;
  Neighborhood: string;
  District: string;
  Province: string;
  Latitude: number;
  Longitude: number;
  CoverImagePath: string | null;
  DistanceKm: number | null;
  IsOpen: boolean;
  OpensAt: Date | null;
  ClosesAt: Date | null;
  IsCertified: boolean;
  AvgRating: number | null;
  ReviewCount: number;
  /** Bugünkü randevu sayısı (yalnızca arama sonuçlarında) */
  TodayAppointments: number;
  /** false = henüz Bermatik'e katılmadı (OpenStreetMap veya admin ekledi): online randevu yok */
  IsClaimed: boolean;
};

export type ShopDetail = ShopCard & {
  Description: string | null;
  AddressDetail: string | null;
  Status: string;
  IsTemporarilyClosed: boolean;
  QueueAvgMinutes: number;
  ClosedReason: string | null;
  Source: "owner" | "admin" | "osm" | "overture";
  NeedsReview: boolean;
  ShowServiceDescriptions: boolean;
  StoreOpen: boolean;
  ReviewsEnabled: boolean;
  IsMember: boolean;
  IsOwner: boolean;
  /** dükkânı şu an admin yönetiyor (gerçek sahibi sahiplenebilir) */
  OwnerIsAdmin: boolean;
};

export type Service = {
  Id: string;
  CategoryName: string;
  CategorySlug: string;
  Name: string;
  Description: string | null;
  Price: number;
  DurationMinutes: number;
};

export type Staff = { Id: string; DisplayName: string; Title: string | null; PhotoPath: string | null; Phone: string | null; IsCertified?: boolean };
export type Review = { Id: string; Rating: number; Comment: string | null; CreatedAt: Date; CustomerName: string; StaffName: string | null };
export type Hours = { Weekday: number; IsClosed: boolean; OpensAt: Date | null; ClosesAt: Date | null };

export const shopUrl = (s: Pick<ShopCard, "Segment" | "ProvinceSlug" | "DistrictSlug" | "Slug">) =>
  `/${s.Segment}/${s.ProvinceSlug}/${s.DistrictSlug}/${s.Slug}`;

/** SQL "time" değeri (1970-01-01T09:00:00Z) → "09:00" */
export function hhmm(t: Date | string | null | undefined) {
  if (!t) return "";
  const d = typeof t === "string" ? new Date(t) : t;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Mesafe: 1 km altı metre (10 m adımla), üstü virgüllü km — "50 m", "1,4 km" */
export function distanceLabel(km: number) {
  const m = Math.max(10, Math.round(km * 100) * 10);
  return m < 1000 ? `${m} m` : `${km.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} km`;
}

export const tl = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

// Veritabanından gelen "Türkiye saati" değerleri (datetime2) JS'de UTC alanlarında durur.
/** 2026-10-30T10:30 biçiminde (Türkiye saati) */
export const localIso = (d: Date | string) => new Date(d).toISOString().slice(0, 16);
/** "30 Ekim Perşembe 10:30" */
export function localLabel(d: Date | string, withTime = true) {
  const x = new Date(d);
  const opts: Intl.DateTimeFormatOptions = { timeZone: "UTC", day: "numeric", month: "long", weekday: "long" };
  if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit" });
  return new Intl.DateTimeFormat("tr-TR", opts).format(x);
}

/**
 * Ad baş harfleri (fotoğrafı olmayan dükkân/personel kutusu için): her kelimenin ilk gerçek harfi/rakamı.
 * Emoji ve semboller atlanır; karakter asla ortadan bölünmez (eskiden "✂️ Barber" gibi adlar
 * yarım karakter üretip sayfa hatasına yol açıyordu).
 */
export function initials(name: string, count = 2) {
  const out: string[] = [];
  for (const word of name.replace(/['’]/g, "").split(/\s+/)) {
    const ch = word.match(/[\p{L}\p{N}]/u)?.[0];
    if (ch) out.push(ch);
    if (out.length >= count) break;
  }
  return (out.join("") || "?").toLocaleUpperCase("tr-TR");
}
