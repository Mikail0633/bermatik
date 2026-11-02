import { callOne } from "@/lib/db";
import { authed, ok, publicUser } from "@/lib/mobile";

// Uygulama açılışında: oturum hâlâ geçerli mi + okunmamış bildirim sayısı
export const GET = authed(async (user) => {
  const n = await callOne<{ UnreadCount: number }>("api.Notification_UnreadCount", { ActorId: user.Id });
  return ok({ user: publicUser(user), unread: n?.UnreadCount ?? 0 });
});
