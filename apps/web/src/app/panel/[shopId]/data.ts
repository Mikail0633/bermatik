import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { AppError, callOne } from "@/lib/db";
import type { ShopDetail } from "@/lib/types";

export type PanelShop = ShopDetail & {
  ProvinceId: number; DistrictId: number; NeighborhoodId: number; StatusReason: string | null;
  ShopShowServiceDescriptions: boolean; ShopStoreEnabled: boolean;
};

// Sayfa ve sekmeler için tek sorgu
export const loadPanelShop = cache(async (shopId: string) => {
  const user = await requireUser(`/panel/${shopId}`);
  let shop: PanelShop | undefined;
  try {
    shop = await callOne<PanelShop>("api.Shop_Get", { ShopId: shopId, ActorId: user.Id });
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  if (!shop || (!shop.IsMember && user.Role !== "admin")) notFound();
  return { user, shop };
});

// Admin hangi gözle bakıyor: "sahip" (varsayılan) ya da "personel"
export const getPanelView = cache(async (): Promise<"sahip" | "personel"> => {
  const { cookies } = await import("next/headers");
  return (await cookies()).get("bm_gorunum")?.value === "personel" ? "personel" : "sahip";
});
