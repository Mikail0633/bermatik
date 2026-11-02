import { callOne } from "@/lib/db";
import { GUID, authed, fail, ok } from "@/lib/mobile";

// Favoriye ekle / çıkar → { isFavorite }
export const POST = authed(async (user, _req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!GUID.test(id)) return fail("Dükkân bulunamadı.", 404);
  const r = await callOne<{ IsFavorite: boolean }>("api.Favorite_Toggle", { ActorId: user.Id, ShopId: id });
  return ok({ isFavorite: Boolean(r?.IsFavorite) });
});
