import { notFound } from "next/navigation";
import { call } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { StaffPhotoUpload } from "@/components/PhotoUpload";
import { removeDayOff } from "@/app/panel/actions";
import { loadPanelShop } from "../data";
import { BreakForm, DayOffForm, InviteButton, StaffForm } from "./client";

export const metadata = { title: "Personel" };

type Row = {
  Id: string; DisplayName: string; Title: string | null; PhotoPath: string | null; Phone: string | null; ShowPhone: boolean; IsActive: boolean;
  HasAccount: boolean; BreaksJson: string | null; DaysOffJson: string | null;
};
type Break = { start: string; end: string; weekday: number | null };
type DayOff = { id: string; weekday: number | null; startDate: string | null; endDate: string | null; note: string | null };

const WEEKDAYS = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const d = (x: string) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(x));

export default async function Page({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const { user, shop } = await loadPanelShop(shopId);
  if (!shop.IsOwner && user.Role !== "admin") notFound();
  const rows = await call<Row>("api.Staff_ListForPanel", { ActorId: user.Id, ShopId: shopId });
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 text-lg font-bold">Personel ekle</h2>
        <p className="mb-3 text-sm text-muted">Siz de koltukta çalışıyorsanız kendinizi de ekleyin; müşteriler randevuyu kişiye göre alır.</p>
        <StaffForm shopId={shopId} />
      </section>

      {rows.map((s) => {
        const breaks: Break[] = s.BreaksJson ? JSON.parse(s.BreaksJson) : [];
        const daysOff: DayOff[] = s.DaysOffJson ? JSON.parse(s.DaysOffJson) : [];
        return (
          <section key={s.Id} className={`rounded-2xl border border-line bg-surface p-5 ${s.IsActive ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{s.DisplayName} {!s.IsActive && <span className="text-sm font-normal text-muted">(pasif)</span>}</h2>
                <p className="text-sm text-muted">{s.Title ?? "Personel"}{s.Phone ? ` · ${s.Phone}` : ""} · {s.HasAccount ? "Bermatik hesabı bağlı" : "Hesabı bağlı değil"}</p>
              </div>
              {!s.HasAccount && <InviteButton staffId={s.Id} />}
            </div>

            <div className="mt-3"><StaffPhotoUpload staffId={s.Id} current={s.PhotoPath} /></div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold underline">Bilgileri düzenle</summary>
              <div className="mt-3"><StaffForm shopId={shopId} initial={s} /></div>
            </details>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-surface-2 p-3">
                <h3 className="mb-2 font-semibold">Günlük mola</h3>
                <BreakForm staffId={s.Id} initial={breaks[0]} />
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <h3 className="mb-2 font-semibold">İzinler</h3>
                {daysOff.length > 0 && (
                  <ul className="mb-3 space-y-1 text-sm">
                    {daysOff.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2">
                        <span>
                          {o.weekday ? `Her ${WEEKDAYS[o.weekday]}` : o.startDate === o.endDate ? d(o.startDate!) : `${d(o.startDate!)} – ${d(o.endDate!)}`}
                          {o.note && <span className="text-muted"> · {o.note}</span>}
                        </span>
                        <ActionButton variant="danger" action={removeDayOff.bind(null, o.id)}>Sil</ActionButton>
                      </li>
                    ))}
                  </ul>
                )}
                <DayOffForm staffId={s.Id} />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
