import { NextResponse } from "next/server";
import { call } from "@/lib/db";
import { isSegment, type ShopCard } from "@/lib/types";

// "Sırayı gör" arama listesi: tüm Türkiye, dükkân / ilçe / il adıyla (yazdıkça sorulur)
export async function GET(req: Request) {
  const u = new URL(req.url);
  const seg = u.searchParams.get("bolum") ?? "";
  if (!isSegment(seg)) return NextResponse.json({ error: "Bölüm geçersiz" }, { status: 400 });
  const q = (u.searchParams.get("q") ?? "").replace(/[%_[\]]/g, " ").trim().slice(0, 60);
  const limit = Math.min(Math.max(Number(u.searchParams.get("adet")) || 50, 1), 500);
  const rows = await call<ShopCard>("api.Shop_Search", { Segment: seg, Query: q || null, Limit: limit + 1 });
  return NextResponse.json(
    {
      more: rows.length > limit,
      shops: rows.slice(0, limit).map((s) => ({
        Id: s.Id, Name: s.Name, Segment: s.Segment, Slug: s.Slug, ProvinceSlug: s.ProvinceSlug, DistrictSlug: s.DistrictSlug,
        Neighborhood: s.Neighborhood, District: s.District, Province: s.Province,
        IsOpen: s.IsOpen, OpensAt: s.OpensAt, ClosesAt: s.ClosesAt, IsClaimed: s.IsClaimed, TodayAppointments: s.TodayAppointments,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
