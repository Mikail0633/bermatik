"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserRole } from "../actions";

export function RoleSelect({ userId, role, roles }: { userId: string; role: string; roles: Record<string, string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex flex-col">
      <select
        defaultValue={role}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          if (!window.confirm(`Rol "${roles[next]}" yapılsın mı?`)) { e.target.value = role; return; }
          start(async () => { const r = await setUserRole(userId, next); setError(r?.error); router.refresh(); });
        }}
        className="rounded-lg border border-line bg-surface px-2 py-1.5"
      >
        {Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {error && <span className="text-xs text-closed">{error}</span>}
    </span>
  );
}
