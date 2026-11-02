import "server-only";
import { hhmm, localIso, type Hours, type Review, type Service, type ShopCard, type ShopDetail, type Staff } from "./types";

// Veritabanı satırlarını telefon uygulamasının beklediği sade biçime çevirir.
// Saatler "09:00", Türkiye saatli tarihler "2026-11-01T10:30" biçiminde gider.

export const shopCard = (s: ShopCard) => ({
  id: s.Id, code: s.Code, segment: s.Segment, name: s.Name, slug: s.Slug,
  provinceSlug: s.ProvinceSlug, districtSlug: s.DistrictSlug,
  province: s.Province, district: s.District, neighborhood: s.Neighborhood,
  street: s.Street, buildingNo: s.BuildingNo, phone: s.Phone,
  lat: s.Latitude, lng: s.Longitude, cover: s.CoverImagePath,
  distanceKm: s.DistanceKm == null ? null : Number(s.DistanceKm),
  isOpen: Boolean(s.IsOpen), opensAt: hhmm(s.OpensAt) || null, closesAt: hhmm(s.ClosesAt) || null,
  isCertified: Boolean(s.IsCertified), rating: s.AvgRating == null ? null : Number(s.AvgRating), reviewCount: s.ReviewCount ?? 0,
  todayAppointments: s.TodayAppointments ?? 0, isClaimed: Boolean(s.IsClaimed),
});

export const shopDetail = (s: ShopDetail) => ({
  ...shopCard(s),
  description: s.Description, addressDetail: s.AddressDetail,
  isTemporarilyClosed: Boolean(s.IsTemporarilyClosed), closedReason: s.ClosedReason,
  showServiceDescriptions: Boolean(s.ShowServiceDescriptions), reviewsEnabled: Boolean(s.ReviewsEnabled),
  source: s.Source, ownerIsAdmin: Boolean(s.OwnerIsAdmin),
});

export const service = (x: Service, withDesc: boolean) => ({
  id: x.Id, category: x.CategoryName, categorySlug: x.CategorySlug, name: x.Name,
  description: withDesc ? x.Description : null, price: Number(x.Price), minutes: x.DurationMinutes,
});

export const staff = (x: Staff) => ({ id: x.Id, name: x.DisplayName, title: x.Title, photo: x.PhotoPath, phone: x.Phone, isCertified: Boolean(x.IsCertified) });

export const review = (x: Review) => ({
  id: x.Id, rating: x.Rating, comment: x.Comment, createdAt: new Date(x.CreatedAt).toISOString(), customer: x.CustomerName, staff: x.StaffName,
});

export const hours = (x: Hours) => ({ weekday: x.Weekday, isClosed: Boolean(x.IsClosed), opensAt: hhmm(x.OpensAt) || null, closesAt: hhmm(x.ClosesAt) || null });

export { localIso };
