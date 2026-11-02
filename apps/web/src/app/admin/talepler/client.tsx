"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dismissSuggestion, resolveClaim, type ActionState } from "../dukkanlar/actions";

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionState>();
  const act = (fn: () => Promise<ActionState>) => start(async () => { const r = await fn(); setRes(r); if (!r?.error) router.refresh(); });
  return { pending, res, act };
}

export function ClaimButtons({ id }: { id: string }) {
  const { pending, res, act } = useAct();
  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        <button disabled={pending} onClick={() => window.confirm("Telefonla doğruladınız mı? Dükkân bu kişiye devredilecek.") && act(() => resolveClaim(id, true, "Telefonla doğrulandı"))}
          className="rounded-lg bg-open px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Onayla</button>
        <button disabled={pending} onClick={() => { const n = window.prompt("Red nedeni (kullanıcıya görünmez):", "Doğrulanamadı"); if (n !== null) act(() => resolveClaim(id, false, n)); }}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold disabled:opacity-50">Reddet</button>
      </div>
      {res?.error && <p className="text-sm text-closed">{res.error}</p>}
    </div>
  );
}

export function DismissSuggestion({ id }: { id: string }) {
  const { pending, res, act } = useAct();
  return (
    <>
      <button disabled={pending} onClick={() => act(() => dismissSuggestion(id))} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold disabled:opacity-50">Kapat (eklenmeyecek)</button>
      {res?.error && <p className="w-full text-sm text-closed">{res.error}</p>}
    </>
  );
}
