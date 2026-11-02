import { SiteShell } from "./SiteShell";

// Giriş / kayıt / şifre sayfalarının ortak kutusu
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <SiteShell segment="erkek">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
      </div>
    </SiteShell>
  );
}
