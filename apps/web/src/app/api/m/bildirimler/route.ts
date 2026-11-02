import { call } from "@/lib/db";
import { authed, ok } from "@/lib/mobile";

type Note = { Id: number; Kind: string; Title: string; Body: string; Url: string | null; CreatedAtLocal: Date; IsRead: boolean };

// Bildirimlerim (son 50). Liste açılınca hepsi okundu sayılır (sitedeki gibi).
export const GET = authed(async (user) => {
  const rows = await call<Note>("api.Notification_ListMine", { ActorId: user.Id, Top: 50 });
  if (rows.some((r) => !r.IsRead)) await call("api.Notification_MarkRead", { ActorId: user.Id });
  return ok({
    notifications: rows.map((r) => ({
      id: r.Id, kind: r.Kind, title: r.Title, body: r.Body, url: r.Url,
      createdAt: new Date(r.CreatedAtLocal).toISOString().slice(0, 16), isRead: Boolean(r.IsRead),
    })),
  });
});
