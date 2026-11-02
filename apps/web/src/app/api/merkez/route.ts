import { NextResponse } from "next/server";
import { areaCenter } from "@/lib/geo";

// İlçe (ve isteğe bağlı mahalle) merkezinin konumu: haritayı oraya götürmek için.
// Bir kez bulunan merkez veritabanına yazılır, sonraki isteklerde dış servise gidilmez.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const ilce = Number(sp.get("ilce")), mahalle = Number(sp.get("mahalle")) || null;
  if (!Number.isInteger(ilce) || ilce < 1) return NextResponse.json(null, { status: 400 });
  const c = await areaCenter(ilce, mahalle);
  const p = c?.neighborhood ?? c?.district;
  return NextResponse.json(p ? { lat: p[0], lng: p[1], zoom: c?.neighborhood ? 15 : 13 } : null, { headers: { "Cache-Control": "public, max-age=86400" } });
}
