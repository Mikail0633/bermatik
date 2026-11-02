import Link from "next/link";
import { Hammer } from "lucide-react";
import type { Segment } from "@/lib/types";
import { SiteShell } from "./SiteShell";

// Henüz yapılmamış sayfalar için geçici ekran
export function ComingSoon({ title, segment = "erkek", back = "/" }: { title: string; segment?: Segment; back?: string }) {
  return (
    <SiteShell segment={segment}>
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
        <Hammer className="h-12 w-12 text-accent" aria-hidden />
        <h1 className="mt-4 text-3xl font-extrabold">{title}</h1>
        <p className="mt-2 text-muted">Bu sayfa hazırlanıyor. Çok yakında burada!</p>
        <Link href={back} className="mt-6 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-ink">Geri dön</Link>
      </div>
    </SiteShell>
  );
}
