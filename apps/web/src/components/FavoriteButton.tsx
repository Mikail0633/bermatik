"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/app/hesap-actions";

// Dükkânı favorilere ekle / çıkar
export function FavoriteButton({ shopId, initial }: { shopId: string; initial: boolean }) {
  const [fav, setFav] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const path = usePathname();
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled={pending}
        aria-pressed={fav}
        onClick={() => start(async () => {
          const r = await toggleFavorite(shopId, path);
          if (r?.error) setError(r.error); else { setError(undefined); setFav(Boolean(r?.isFavorite)); }
        })}
        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60"
      >
        <Heart className={`h-5 w-5 ${fav ? "fill-closed text-closed" : ""}`} aria-hidden />
        {fav ? "Favorilerimde" : "Favorilere ekle"}
      </button>
      {error && <span className="mt-1 text-xs text-closed">{error}</span>}
    </span>
  );
}
