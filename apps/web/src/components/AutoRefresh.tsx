"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Sayfayı belirli aralıklarla sessizce yeniler (yeni randevu talepleri, bugünkü sıra)
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
