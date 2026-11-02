import "server-only";
import { call } from "./db";
import { pushConfigured, sendPush } from "./push";

// Sitenin arka planında dakikada bir çalışır (src/instrumentation.ts başlatır):
//   1) Zamanı gelen randevu hatırlatmalarını kuyruğa ekler (1 gün ve 2 saat kala)
//   2) Kuyruktaki bildirimleri kişinin kayıtlı cihazlarına gönderir
// Bildirimler her durumda sitedeki zil listesine de düşer; burası yalnızca telefona/tarayıcıya gönderimdir.

type Row = { NotificationId: number; Title: string; Body: string; Url: string | null; Endpoint: string; P256dh: string | null; AuthKey: string | null; Platform: string };

let running = false;

async function tick() {
  if (running) return; // önceki tur bitmeden yenisi başlamasın
  running = true;
  try {
    await call("api.Worker_EnqueueReminders");
    if (!pushConfigured()) return;
    for (let round = 0; round < 20; round++) {
      const rows = await call<Row>("api.Worker_NextPush", { Top: 50 });
      if (rows.length === 0) break;
      // Bir bildirim kişinin birden çok cihazına gidebilir: biri bile ulaşırsa gönderildi sayılır
      const byId = new Map<number, Row[]>();
      for (const r of rows) byId.set(r.NotificationId, [...(byId.get(r.NotificationId) ?? []), r]);
      await Promise.all([...byId].map(async ([id, targets]) => {
        let sent = false, error = "";
        for (const t of targets) {
          const res = await sendPush(t, { title: t.Title, body: t.Body, url: t.Url, tag: `bildirim-${id}` });
          if (res === "ok") sent = true;
          else if (res === "gone") await call("api.Push_Unsubscribe", { Endpoint: t.Endpoint });
          else error = res;
        }
        await call("api.Worker_PushResult", { NotificationId: id, Success: sent, Error: sent ? null : error || "Cihaz aboneliği geçersiz" });
      }));
    }
  } catch (e) {
    console.error("[bildirim görevi]", e);
  } finally {
    running = false;
  }
}

export function startPushWorker() {
  const g = globalThis as { __bermatikWorker?: NodeJS.Timeout };
  if (g.__bermatikWorker) return;
  g.__bermatikWorker = setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
  console.log(`[bildirim görevi] başladı (${pushConfigured() ? "telefon bildirimi açık" : "VAPID anahtarı yok: yalnızca hatırlatmalar zile düşer"})`);
}
