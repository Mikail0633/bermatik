import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { call } from "@/lib/db";
import { reverseGeocode } from "@/lib/geo";

// Admin/işletme formu: haritada seçilen noktanın il/ilçe/mahallesi + o ilçenin mahalle listesi
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat")), lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: "Konum geçersiz" }, { status: 400 });
  const a = await reverseGeocode(lat, lng);
  const districts = a.provinceId ? await call("api.Lookup_Districts", { ProvinceId: a.provinceId }) : [];
  const neighborhoods = a.districtId ? await call("api.Lookup_Neighborhoods", { DistrictId: a.districtId }) : [];
  return NextResponse.json({ ...a, districts, neighborhoods });
}
