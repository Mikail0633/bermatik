import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { call } from "@/lib/db";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = { title: "Bildirimler", robots: { index: false } };
export const dynamic = "force-dynamic";

type Note = { Id: number; Kind: string; Title: string; Body: string; Url: string | null; CreatedAtLocal: Date; IsRead: boolean };
const when = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(d));

export default async function Page() {
  const user = await requireUser("/bildirimler");
  const rows = await call<Note>("api.Notification_ListMine", { ActorId: user.Id, Top: 50 });
  // Sayfa açılınca hepsi okundu sayılır (yeni olanlar bu seferlik vurgulu görünür)
  if (rows.some((r) => !r.IsRead)) await call("api.Notification_MarkRead", { ActorId: user.Id });
  return (
    <SiteShell segment="erkek">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-extrabold">Bildirimler</h1>
        {rows.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-muted">Henüz bildiriminiz yok.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {rows.map((n) => {
              const inner = (
                <>
                  <p className="font-semibold">{!n.IsRead && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent align-middle" aria-label="Yeni" />}{n.Title}</p>
                  <p className="text-sm text-muted">{n.Body}</p>
                  <p className="mt-1 text-xs text-muted">{when(n.CreatedAtLocal)}</p>
                </>
              );
              const cls = `block rounded-2xl border p-4 ${n.IsRead ? "border-line bg-surface" : "border-accent bg-accent/10"}`;
              return (
                <li key={n.Id}>
                  {n.Url?.startsWith("/") ? <Link href={n.Url} className={`${cls} hover:bg-surface-2`}>{inner}</Link> : <div className={cls}>{inner}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SiteShell>
  );
}
