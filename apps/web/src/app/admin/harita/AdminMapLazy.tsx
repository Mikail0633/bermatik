"use client";

import dynamic from "next/dynamic";

// Harita yalnızca tarayıcıda çalışır
export const AdminMapLazy = dynamic(() => import("@/components/admin/AdminMap"), {
  ssr: false,
  loading: () => <div className="h-[70vh] min-h-[420px] animate-pulse rounded-2xl bg-surface-2" aria-label="Harita yükleniyor" />,
});
