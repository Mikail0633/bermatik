"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { SEGMENTS, shopUrl, type Segment, type ShopCard } from "@/lib/types";
import { OpenBadge } from "./ShopCard";

type Row = Pick<ShopCard, "Id" | "Name" | "Segment" | "Slug" | "ProvinceSlug" | "DistrictSlug" | "Neighborhood" | "District" | "Province" | "IsOpen" | "OpensAt" | "ClosesAt" | "IsClaimed" | "TodayAppointments">;

const PAGE = 50;

// Sırayı gör: tüm dükkânlar listelenir, yazdıkça süzülür; dükkâna basınca o dükkânın bugünkü sırası açılır
export function QueueFinder({ segment }: { segment: Segment }) {
  const seg = SEGMENTS[segment];
  const [q, setQ] = useState("");
  const [count, setCount] = useState(PAGE);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const req = useRef(0);

  useEffect(() => {
    const id = ++req.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/sira-ara?bolum=${segment}&q=${encodeURIComponent(q.trim())}&adet=${count}`, { cache: "no-store" });
        const data = await r.json();
        if (id !== req.current) return; // daha yeni bir arama başladıysa bu cevabı yok say
        setRows(data.shops ?? []);
        setMore(!!data.more);
      } finally {
        if (id === req.current) setLoading(false);
      }
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, count, segment]);

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">{seg.Shops} içinde ara</span>
        <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted" aria-hidden />
        <input
          type="search" value={q} autoFocus
          onChange={(e) => { setQ(e.target.value); setCount(PAGE); }}
          placeholder={`${seg.shop[0].toUpperCase()}${seg.shop.slice(1)} adı, ilçe veya il yazın`}
          className="w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-10 text-lg"
        />
        {loading && <Loader2 className="absolute right-3 top-3.5 h-5 w-5 animate-spin text-muted" aria-hidden />}
      </label>

      {rows && rows.length === 0 && !loading && (
        <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-center text-muted">
          &quot;{q}&quot; ile eşleşen {seg.shop} bulunamadı.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((s) => {
            const url = shopUrl(s);
            return (
              <li key={s.Id}>
                <Link href={s.IsClaimed ? `${url}/sira` : url} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{s.Name}</span>
                    <span className="block truncate text-sm text-muted">{s.Neighborhood.replace(/ Mahallesi$/, "")}, {s.District} / {s.Province}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {s.IsClaimed
                        ? (s.TodayAppointments === 0 ? "Bugün randevu yok" : `Bugün ${s.TodayAppointments} randevu`)
                        : "Henüz Bermatik'e katılmadı · sıra bilgisi yok"}
                    </span>
                  </span>
                  {s.IsClaimed && <OpenBadge shop={s} compact />}
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {more && (
        <button type="button" disabled={loading} onClick={() => setCount((c) => c + PAGE)}
          className="mt-4 w-full rounded-xl border border-line bg-surface px-5 py-3 font-semibold hover:bg-surface-2 disabled:opacity-60">
          Daha fazla göster
        </button>
      )}
    </div>
  );
}
