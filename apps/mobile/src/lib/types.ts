// Sitenin /api/m uç noktalarından gelen veriler

export type Segment = 'erkek' | 'kadin';
export type Role = 'customer' | 'shop_owner' | 'staff' | 'admin';

export type User = {
  id: string; email: string; role: Role; firstName: string; lastName: string;
  phone: string | null; birthYear: number | null; emailVerified: boolean;
};

export type ShopCard = {
  id: string; code: string; segment: Segment; name: string; slug: string;
  provinceSlug: string; districtSlug: string; province: string; district: string; neighborhood: string;
  street: string; buildingNo: string; phone: string | null; lat: number; lng: number; cover: string | null;
  distanceKm: number | null; isOpen: boolean; opensAt: string | null; closesAt: string | null;
  isCertified: boolean; rating: number | null; reviewCount: number; todayAppointments: number; isClaimed: boolean;
};

export type ShopDetail = ShopCard & {
  description: string | null; addressDetail: string | null; isTemporarilyClosed: boolean; closedReason: string | null;
  showServiceDescriptions: boolean; reviewsEnabled: boolean;
  source: 'owner' | 'admin' | 'osm' | 'overture'; ownerIsAdmin: boolean;
};

export type Service = { id: string; category: string; categorySlug: string; name: string; description: string | null; price: number; minutes: number };
export type Staff = { id: string; name: string; title: string | null; photo: string | null; phone: string | null; isCertified: boolean };
export type Review = { id: string; rating: number; comment: string | null; createdAt: string; customer: string; staff: string | null };
export type Hours = { weekday: number; isClosed: boolean; opensAt: string | null; closesAt: string | null };

export type ShopPage = {
  shop: ShopDetail; isFavorite: boolean; services: Service[]; staff: Staff[]; reviews: Review[]; hours: Hours[];
  gallery: { id: string; path: string; caption: string | null; staff: string | null }[];
  today: { start: string; end: string; staff: string; isPast: boolean }[];
  /** yalnızca katılmamış dükkânda: randevu talebi formundaki hizmet seçimi */
  categories?: { id: number; name: string }[];
};

export type Slot = { start: string; end: string; staffId: string; staffName: string | null; minutes: number };

export type Appointment = {
  id: string; status: string; start: string; end: string; price: number; note: string | null;
  shopId: string; shopName: string; shopPhone: string | null; staffId: string; staffName: string;
  services: string; canReview: boolean; segment: Segment;
};

export type BookingRequest = {
  id: string; kind: string; status: string; preferred: string; confirmed: string | null; note: string | null; adminNote: string | null;
  category: string | null; shopId: string | null; shopName: string; shopPhone: string | null; segment: Segment; district: string;
};

export type Notification = { id: number; kind: string; title: string; body: string; url: string | null; createdAt: string; isRead: boolean };
export type Province = { Id: number; Name: string; Slug: string };
export type District = { Id: number; Name: string; Slug: string };
