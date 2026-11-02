import { SiteShell } from "./SiteShell";
import { LEGAL } from "@/lib/legal";

// KVKK ve kullanım koşulları gibi uzun metinler için sade, okunaklı sayfa
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SiteShell segment="erkek">
      <article className="legal mx-auto max-w-3xl px-4 py-8 leading-relaxed">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <p className="mt-1 text-sm text-muted">Son güncelleme: {LEGAL.updated} · Sürüm {LEGAL.version}</p>
        <div className="mt-6 space-y-4 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_li]:mt-1 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-line [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:border-line [&_th]:bg-surface-2 [&_th]:p-2 [&_th]:text-left">
          {children}
        </div>
      </article>
    </SiteShell>
  );
}
