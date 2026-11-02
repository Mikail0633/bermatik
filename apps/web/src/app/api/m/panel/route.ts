import { call, callOne } from "@/lib/db";
import { authed, body, fail, ok, str } from "@/lib/mobile";

type MyShop = { Id: string; Code: string; Segment: string; Name: string; Status: string; IsOwner: boolean };
type AnyShop = { Id: string; Code: string; Name: string; Status: string; District: string; OwnerName: string | null; IsClaimed: boolean; Segment: string };

// İşletme paneli giriş ekranı: dükkânlarım (admin: Bermatik'teki tüm dükkânlar + arama ?q=)
export const GET = authed(async (user, req: Request) => {
  if (user.Role === "admin") {
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
    const rows = await call<AnyShop>("api.Admin_Shop_List", { ActorId: user.Id, Search: q || null, Claimed: q ? null : true, Top: 100 });
    return ok({
      admin: true,
      shops: rows.map((s) => ({ id: s.Id, code: s.Code, name: s.Name, status: s.Status, segment: s.Segment, district: s.District, role: s.IsClaimed ? (s.OwnerName ?? "Sahibi var") : "Katılmamış" })),
    });
  }
  const rows = await call<MyShop>("api.Shop_ListMine", { ActorId: user.Id });
  return ok({
    admin: false,
    shops: rows.map((s) => ({ id: s.Id, code: s.Code, name: s.Name, status: s.Status, segment: s.Segment, district: null, role: s.IsOwner ? "Sahibi" : "Personel" })),
  });
});

// Personel davet kodu ile dükkâna katıl: { code } → { shopId }
export const POST = authed(async (user, req: Request) => {
  const code = str((await body(req)).code, 20).toUpperCase();
  if (!code) return fail("Davet kodunu yazın.");
  const r = await callOne<{ ShopId: string }>("api.Staff_ClaimInvite", { ActorId: user.Id, Code: code });
  return ok({ ok: "Dükkâna personel olarak katıldınız.", shopId: r?.ShopId ?? null });
});
