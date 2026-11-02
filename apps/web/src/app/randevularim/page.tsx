import type { Metadata } from "next";
import Link from "next/link";
import { Phone, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { call } from "@/lib/db";
import { localLabel, tl, type Segment } from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";
import { CancelButton, ReviewForm } from "./client";
import { ActionButton } from "@/components/ActionButton";
import { cancelRequest } from "@/app/talep-randevu-actions";

export const metadata: Metadata = { title: "Randevularım", robots: { index: false } };
export const dynamic = "force-dynamic";

type Row = {
  Id: string; Status: string; StartsAtLocal: Date; EndsAtLocal: Date; TotalPrice: number; Note: string | null;
  ShopId: string; ShopName: string; ShopPhone: string | null; StaffName: string; StaffId: string; Services: string; CanReview: boolean;
  Segment: Segment; ShopSlug: string; ProvinceSlug: string; DistrictSlug: string;
};

type Req = {
  Id: string; Kind: "randevu" | "sira"; Status: string; PreferredAtLocal: Date; ConfirmedAtLocal: Date | null; Note: string | null; AdminNote: string | null;
  CategoryName: string | null; ShopName: string; ShopPhone: string | null; Segment: Segment; ShopSlug: string; ProvinceSlug: string; DistrictSlug: string; District: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Onay bekliyor", cls: "bg-accent/20 text-ink" },
  accepted: { label: "Onaylandı", cls: "bg-open/10 text-open" },
  completed: { label: "Tamamlandı", cls: "bg-surface-2 text-muted" },
  cancelled: { label: "İptal edildi", cls: "bg-closed/10 text-closed" },
  rejected: { label: "Kabul edilmedi", cls: "bg-closed/10 text-closed" },
  no_show: { label: "Gelinmedi", cls: "bg-closed/10 text-closed" },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ yeni?: string }> }) {
  const user = await requireUser("/randevularim");
  const [rows, requests] = await Promise.all([
    call<Row>("api.Appointment_ListMine", { ActorId: user.Id }),
    call<Req>("api.Request_ListMine", { ActorId: user.Id }),
  ]);
  const activeReq = requests.filter((q) => q.Status === "open" || q.Status === "confirmed");
  const now = Date.now() + 3 * 3_600_000; // StartsAtLocal Türkiye saati (UTC+3)
  const upcoming = rows.filter((r) => ["pending", "accepted"].includes(r.Status) && new Date(r.StartsAtLocal).getTime() > now).reverse();
  const past = rows.filter((r) => !upcoming.includes(r));
  const isNew = (await searchParams).yeni === "1";

  const card = (r: Row, active: boolean) => {
    const url = `/${r.Segment}/${r.ProvinceSlug}/${r.DistrictSlug}/${r.ShopSlug}`;
    return (
      <li key={r.Id} className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Link href={url} className="text-lg font-bold hover:underline">{r.ShopName}</Link>
            <p className="text-sm text-muted">{r.Services} · {r.StaffName}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[r.Status]?.cls}`}>{STATUS[r.Status]?.label ?? r.Status}</span>
        </div>
        <p className="mt-2 font-semibold">{localLabel(r.StartsAtLocal)}</p>
        <p className="text-sm text-muted">{tl(Number(r.TotalPrice))} · ödeme dükkânda</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {r.ShopPhone && (
            <a href={`tel:${r.ShopPhone}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2">
              <Phone className="h-4 w-4" aria-hidden /> Ara
            </a>
          )}
          {active && <CancelButton id={r.Id} />}
          {!active && (
            <Link href={`${url}/randevu?personel=${r.StaffId}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2">
              <RotateCcw className="h-4 w-4" aria-hidden /> Tekrar randevu al
            </Link>
          )}
        </div>
        {r.CanReview && <ReviewForm appointmentId={r.Id} />}
      </li>
    );
  };

  return (
    <SiteShell segment="erkek">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-3xl font-extrabold">Randevularım</h1>
        {isNew && <p className="mt-3 rounded-xl bg-open/10 px-3 py-2 font-medium text-open">Randevu talebiniz gönderildi! Dükkân onaylayınca bildirim alacaksınız.</p>}
        {activeReq.length > 0 && (
          <>
            <h2 className="mt-6 text-xl font-bold">Taleplerim</h2>
            <p className="text-sm text-muted">Bermatik&apos;e henüz katılmamış dükkânlar için bıraktığınız talepler; dükkânı arayıp ayarlıyoruz.</p>
            <ul className="mt-3 space-y-3">
              {activeReq.map((q) => (
                <li key={q.Id} className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/${q.Segment}/${q.ProvinceSlug}/${q.DistrictSlug}/${q.ShopSlug}`} className="text-lg font-bold hover:underline">{q.ShopName}</Link>
                      <p className="text-sm text-muted">{q.Kind === "sira" ? "Sıra talebi" : "Randevu talebi"}{q.CategoryName ? ` · ${q.CategoryName}` : ""} · {q.District}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${q.Status === "confirmed" ? "bg-open/10 text-open" : "bg-accent/20 text-ink"}`}>
                      {q.Status === "confirmed" ? "Ayarlandı" : "Ayarlanıyor"}
                    </span>
                  </div>
                  <p className="mt-2 font-semibold">{localLabel(q.ConfirmedAtLocal ?? q.PreferredAtLocal)}{q.Status === "open" && <span className="font-normal text-muted"> (istediğiniz saat)</span>}</p>
                  {q.AdminNote && <p className="text-sm text-muted">{q.AdminNote}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {q.ShopPhone && <a href={`tel:${q.ShopPhone}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2"><Phone className="h-4 w-4" aria-hidden /> Ara</a>}
                    <ActionButton variant="danger" confirm="Talep iptal edilsin mi?" action={cancelRequest.bind(null, q.Id)}>İptal et</ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <h2 className="mt-6 text-xl font-bold">Yaklaşan</h2>
        {upcoming.length ? <ul className="mt-3 space-y-3">{upcoming.map((r) => card(r, true))}</ul> : <p className="mt-2 text-muted">Yaklaşan randevunuz yok.</p>}
        {past.length > 0 && (
          <>
            <h2 className="mt-8 text-xl font-bold">Geçmiş</h2>
            <ul className="mt-3 space-y-3">{past.map((r) => card(r, false))}</ul>
          </>
        )}
      </div>
    </SiteShell>
  );
}
