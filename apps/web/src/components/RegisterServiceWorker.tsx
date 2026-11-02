"use client";

import { useEffect } from "react";

// Uygulama gibi kurulum (PWA) ve bildirimler için arka plan çalışanını (public/sw.js) her sayfada kaydeder
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
