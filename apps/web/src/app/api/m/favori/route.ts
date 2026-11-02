import { call } from "@/lib/db";
import { authed, ok } from "@/lib/mobile";
import { hhmm, type Segment } from "@/lib/types";

type Fav = {
  Id: string; Segment: Segment; Name: string; District: string; Province: string;
  Phone: string | null; CoverImagePath: string | null; IsOpen: boolean; ClosesAt: Date | null;
};

// Favorilerim
export const GET = authed(async (user) => {
  const rows = await call<Fav>("api.Favorite_ListMine", { ActorId: user.Id });
  return ok({
    shops: rows.map((f) => ({
      id: f.Id, segment: f.Segment, name: f.Name, district: f.District, province: f.Province, phone: f.Phone,
      cover: f.CoverImagePath, isOpen: Boolean(f.IsOpen), closesAt: hhmm(f.ClosesAt) || null,
    })),
  });
});
