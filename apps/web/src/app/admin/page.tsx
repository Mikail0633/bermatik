import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { callOne } from "@/lib/db";

type Dashboard = {
  UserCount: number; ApprovedShops: number; PendingShops: number; PendingCertificates: number;
  AppointmentsToday: number; QueueEntriesToday: number; OrdersToday: number; ReviewsToday: number;
  OpenClaims: number; OpenSuggestions: number; OpenReports: number; NeedsReviewShops: number;
};

export const metadata = { title: "Özet" };

export default async function Page() {
  const admin = await requireAdmin();
  const d = (await callOne<Dashboard>("api.Admin_Dashboard", { ActorId: admin.Id }))!;
  const cards = [
    { label: "Yayındaki dükkân", value: d.ApprovedShops, href: "/admin/dukkanlar" },
    { label: "Onay bekleyen dükkân", value: d.PendingShops, href: "/admin/dukkanlar?durum=pending", alert: d.PendingShops > 0 },
    { label: "Sahiplenme talebi", value: d.OpenClaims, href: "/admin/talepler", alert: d.OpenClaims > 0 },
    { label: "Eksik dükkân bildirimi", value: d.OpenSuggestions, href: "/admin/talepler", alert: d.OpenSuggestions > 0 },
    { label: "Kontrol bekleyen dükkân", value: d.NeedsReviewShops, href: "/admin/dukkanlar?kontrol=1", alert: d.NeedsReviewShops > 0 },
    { label: "Açık şikayet", value: d.OpenReports, href: "/admin/sikayetler", alert: d.OpenReports > 0 },
    { label: "Onay bekleyen belge", value: d.PendingCertificates, href: "/admin/belgeler", alert: d.PendingCertificates > 0 },
    { label: "Kullanıcı", value: d.UserCount, href: "/admin/kullanicilar" },
    { label: "Bugünkü randevu", value: d.AppointmentsToday },
    { label: "Bugünkü sipariş", value: d.OrdersToday },
    { label: "Bugünkü yorum", value: d.ReviewsToday, href: "/admin/yorumlar" },
  ];
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-extrabold">Merhaba {admin.FirstName} 👋</h1>
      <p className="text-muted">Bermatik&apos;in bugünkü durumu.</p>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => {
          const body = (
            <div className={`h-full rounded-2xl border bg-surface p-4 ${c.alert ? "border-accent" : "border-line"}`}>
              <p className="text-3xl font-extrabold">{c.value}</p>
              <p className="text-sm text-muted">{c.label}</p>
            </div>
          );
          return c.href ? <Link key={c.label} href={c.href} className="hover:opacity-90">{body}</Link> : <div key={c.label}>{body}</div>;
        })}
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/dukkanlar/yeni" className="rounded-2xl bg-primary p-5 font-bold text-primary-ink hover:opacity-90">
          + Yeni dükkân ekle
          <p className="mt-1 text-sm font-normal opacity-80">Pursaklar, Saray, Çubuk gibi eksik bölgelerdeki berberleri haritadan işaretleyerek ekleyin.</p>
        </Link>
        <Link href="/admin/dukkanlar?kontrol=1" className="rounded-2xl border border-line bg-surface p-5 font-bold hover:bg-surface-2">
          Kontrol bekleyen dükkânlar
          <p className="mt-1 text-sm font-normal text-muted">OpenStreetMap&apos;ten gelen ve erkek/kadın veya mahallesi belirsiz kayıtlar.</p>
        </Link>
      </div>
    </div>
  );
}
