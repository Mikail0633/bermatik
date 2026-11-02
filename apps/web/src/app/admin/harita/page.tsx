import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";
import { AdminMapLazy } from "./AdminMapLazy";
import { COLORS, type AdminPoint } from "@/components/admin/mapColors";

export const metadata = { title: "Dükkân haritası" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ bolum?: string }> }) {
  const admin = await requireAdmin();
  const b = (await searchParams).bolum;
  const segment = b === "erkek" || b === "kadin" ? b : null;
  const points = await call<AdminPoint>("api.Admin_Shop_MapPoints", { ActorId: admin.Id, Segment: segment });
  const tab = (v: string | null, label: string) => (
    <Link href={v ? `?bolum=${v}` : "?"} className={`rounded-lg px-3 py-1.5 font-semibold ${segment === v ? "bg-primary text-primary-ink" : "border border-line"}`}>{label}</Link>
  );
  const dot = (bg: string, border = "#111") => <span className="inline-block h-3 w-3 rounded-full align-middle" style={{ background: bg, border: `2px solid ${border}` }} />;
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Dükkân haritası</h1>
        <div className="flex gap-1 text-sm">{tab(null, "Hepsi")}{tab("erkek", "Erkek")}{tab("kadin", "Kadın")}</div>
      </div>
      <p className="mt-1 text-sm text-muted">
        {points.length} dükkân. Boş kalan bölgeleri görün; <b>haritada bir yere tıklayıp &quot;Buraya dükkân ekle&quot;</b> deyin, adres kendiliğinden dolar.
      </p>
      <p className="mt-2 flex flex-wrap gap-4 text-sm">
        <span>{dot(COLORS.erkek)} Erkek</span><span>{dot(COLORS.kadin)} Kadın</span>
        <span>{dot("transparent", COLORS.pending)} Onay bekliyor</span><span>{dot("transparent", COLORS.review)} Kontrol bekliyor</span>
      </p>
      <div className="mt-3"><AdminMapLazy points={points} center={[40.0, 32.87]} /></div>
    </div>
  );
}
