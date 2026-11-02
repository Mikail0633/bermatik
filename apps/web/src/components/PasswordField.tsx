"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { checkPassword, type PasswordCtx } from "@/lib/password";

const COLORS = ["bg-line", "bg-closed", "bg-accent", "bg-open", "bg-open"];

// Yeni şifre alanı: yazarken renkli güç çubuğu ve neden zayıf olduğu gösterilir
export function PasswordField({ label = "Şifre", name = "password", ctx }: { label?: string; name?: string; ctx?: PasswordCtx }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const c = checkPassword(pw, ctx);
  return (
    <div className="block">
      <label htmlFor={name} className="mb-1 block text-sm font-semibold">{label}</label>
      <div className="relative">
        <input id={name} name={name} type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128}
          value={pw} onChange={(e) => setPw(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-3 py-3 pr-11 text-ink" />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 px-3 text-muted" aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}>
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${c.score >= i ? COLORS[c.score] : "bg-line"}`} />)}
      </div>
      <p className={`mt-1 text-xs ${pw && c.error ? "text-closed" : "text-muted"}`} aria-live="polite">
        {!pw ? "En az 8 karakter; harf ve rakam birlikte olsun." : c.error ?? `Şifre gücü: ${c.label}`}
      </p>
    </div>
  );
}
