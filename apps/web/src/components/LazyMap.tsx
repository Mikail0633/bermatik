"use client";

import dynamic from "next/dynamic";

// Harita yalnızca tarayıcıda çalışır; sayfa açılışını yavaşlatmasın diye sonradan yüklenir
export const LazyMap = dynamic(() => import("./ShopMap"), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-2xl bg-surface-2" aria-label="Harita yükleniyor" />,
});
