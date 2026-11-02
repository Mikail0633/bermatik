// Bermatik bildirim çalışanı (service worker): site kapalıyken gelen bildirimleri gösterir,
// tıklanınca ilgili sayfayı açar.

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "Bermatik", {
      body: data.body || "",
      data: { url: data.url || "/bildirimler" },
      tag: data.tag,
      lang: "tr",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Yalnızca kendi sitemizdeki adreslere gidilir
  const url = new URL(event.notification.data?.url || "/bildirimler", self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const tab = tabs.find((c) => new URL(c.url).origin === url.origin);
    if (tab) { await tab.navigate(url.href); return tab.focus(); }
    return self.clients.openWindow(url.href);
  })());
});
