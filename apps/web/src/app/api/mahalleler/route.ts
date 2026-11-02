import { NextResponse } from "next/server";
import { call } from "@/lib/db";

// İlçe seçilince mahalle listesi (değişmeyen veri: tarayıcı 1 gün saklar)
export async function GET(req: Request) {
  const ilce = Number(new URL(req.url).searchParams.get("ilce"));
  if (!Number.isInteger(ilce) || ilce < 1) return NextResponse.json([], { status: 400 });
  const rows = await call<{ Id: number; Name: string }>("api.Lookup_Neighborhoods", { DistrictId: ilce });
  return NextResponse.json(rows, { headers: { "Cache-Control": "public, max-age=86400" } });
}
