"use client";

import Link from "next/link";
import { CalendarCheck, ChevronRight, Clock, Loader2, Scissors } from "lucide-react";
import type { Segment } from "@/lib/types";
import { useLocateAndGo } from "./FindNearby";

// Ana sayfadaki 3 kutu — her biri bir işe götürür
export function HowItWorks({ segment }: { segment: Segment }) {
  const { locate, busy, error, picker } = useLocateAndGo(segment);
  const card = "group flex h-full w-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md";
  const body = (Icon: typeof Scissors, title: string, text: string, spinning = false) => (
    <>
      {spinning ? <Loader2 className="h-6 w-6 shrink-0 animate-spin text-accent" aria-hidden /> : <Icon className="h-6 w-6 shrink-0 text-accent" aria-hidden />}
      <span className="flex-1">
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
    </>
  );
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="#hizmetler" className={card}>
          {body(Scissors, "Hizmetini seç", segment === "erkek" ? "Saç, sakal, damat traşı — fiyatlar önceden belli." : "Saç, boya, manikür, kaş-kirpik — fiyatlar önceden belli.")}
        </Link>
        <Link href={`/${segment}/sira`} className={card}>
          {body(Clock, "Sırayı gör", "Dükkânını ara, bugün kaç randevusu var gör.")}
        </Link>
        <button type="button" onClick={locate} disabled={busy} className={card}>
          {body(CalendarCheck, "Randevunu al", busy ? "Konumun alınıyor…" : "Yakınındakileri bul, boş saatlerden birini seç.", busy)}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-closed">{error}</p>}
      {picker}
    </section>
  );
}
