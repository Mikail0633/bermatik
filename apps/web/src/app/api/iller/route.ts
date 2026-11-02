import { NextResponse } from "next/server";
import { call } from "@/lib/db";
import type { Province } from "@/lib/types";

// 81 il (değişmeyen veri: tarayıcı 1 gün saklar)
export async function GET() {
  const rows = await call<Province>("api.Lookup_Provinces");
  return NextResponse.json(rows, { headers: { "Cache-Control": "public, max-age=86400" } });
}
