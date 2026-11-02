// Site açılırken bir kez çalışır: arka plan bildirim görevini başlatır.
// Geliştirme modunda (npm run dev) BERMATIK_WORKER=0 ile kapatılabilir.
// Not: koşul bu biçimde yazılmalı; Next.js böylece bildirim kodunu (web-push, Node modülleri)
// yalnızca sunucu (nodejs) derlemesine koyar, aksi hâlde geliştirme modu "Can't resolve 'http'" ile çöker.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.BERMATIK_WORKER === "0") return;
    const { startPushWorker } = await import("./lib/push-worker");
    startPushWorker();
  }
}
