import "server-only";
import { AppError, callOne } from "./db";
import { localIso } from "./types";
import type { SessionUser } from "./auth";
import type { ShopDetail } from "./types";

// Telefon uygulamasındaki İşletme paneli için ortak yardımcılar.
// Asıl yetki kontrolü veritabanı işlemlerinin içindedir (sahip / personel / admin);
// burada ayrıca dükkânın bu kişiye ait olduğu (üye ya da admin) doğrulanır.

export type PanelShop = ShopDetail & {
  ProvinceId: number; DistrictId: number; NeighborhoodId: number; StatusReason: string | null;
  ShopShowServiceDescriptions: boolean; ShopStoreEnabled: boolean;
};

export async function panelShop(user: SessionUser, shopId: string) {
  let shop: PanelShop | undefined;
  try {
    shop = await callOne<PanelShop>("api.Shop_Get", { ShopId: shopId, ActorId: user.Id });
  } catch (e) {
    if (e instanceof AppError) throw new AppError("Dükkân bulunamadı.", 404);
    throw e;
  }
  if (!shop || (!shop.IsMember && user.Role !== "admin")) throw new AppError("Dükkân bulunamadı.", 404);
  const canManage = Boolean(shop.IsOwner) || user.Role === "admin";
  return { shop, canManage };
}

export type PanelAppt = {
  Id: string; Status: string; Source: string; StartsAtLocal: Date; EndsAtLocal: Date; CustomerName: string; CustomerPhone: string | null;
  TotalPrice: number; Note: string | null; StaffId: string; StaffName: string; Services: string;
};

export const panelAppt = (a: PanelAppt) => ({
  id: a.Id, status: a.Status, source: a.Source, start: localIso(a.StartsAtLocal), end: localIso(a.EndsAtLocal),
  customerName: a.CustomerName, customerPhone: a.CustomerPhone, price: Number(a.TotalPrice), note: a.Note,
  staffId: a.StaffId, staffName: a.StaffName, services: a.Services,
});

/** Türkiye tarihiyle bugün "2026-11-01" */
export const todayTR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
