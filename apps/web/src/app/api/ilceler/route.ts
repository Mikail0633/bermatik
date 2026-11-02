import { NextResponse } from "next/server";
import { call } from "@/lib/db";
import type { District } from "@/lib/types";

// İl seçilince ilçe listesi (değişmeyen veri: tarayıcı 1 gün saklar)
export async function GET(req: Request) {
  const il = Number(new URL(req.url).searchParams.get("il"));
  if (!Number.isInteger(il) || il < 1 || il > 81) return NextResponse.json([], { status: 400 });
  const rows = await call<District>("api.Lookup_Districts", { ProvinceId: il });
  return NextResponse.json(rows, { headers: { "Cache-Control": "public, max-age=86400" } });
}
