"use client";

import { useTransition } from "react";
import { setPanelView } from "../gorunum-actions";

// Yalnızca admin görür: paneli sahip ya da personel gözüyle göster
export function ViewSwitch({ view }: { view: "sahip" | "personel" }) {
  const [pending, start] = useTransition();
  const btn = (v: "sahip" | "personel", label: string) => (
    <button type="button" disabled={pending} onClick={() => start(() => setPanelView(v))}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${view === v ? "bg-primary text-primary-ink" : "hover:bg-surface-2"}`}>
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
      <span className="px-2 text-xs font-semibold text-muted">Görünüm:</span>
      {btn("sahip", "Dükkân sahibi")}
      {btn("personel", "Personel")}
    </div>
  );
}
