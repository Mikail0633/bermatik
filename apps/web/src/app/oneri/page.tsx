import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { SiteShell } from "@/components/SiteShell";
import { SuggestionForm } from "./SuggestionForm";

export const metadata: Metadata = { title: "Eksik dükkân bildir", robots: { index: false } };

// Listede olmayan bir berber/kuaförü bildir; admin inceleyip ekler
export default async function Page() {
  const user = await getUser();
  return (
    <SiteShell segment="erkek">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-extrabold">Listede olmayan bir dükkân mı var?</h1>
        <p className="mt-2 text-muted">Bildiğiniz bir berber veya kuaför Bermatik&apos;te yoksa bize bildirin; inceleyip ekleyelim.</p>
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
          {user ? (
            <SuggestionForm />
          ) : (
            <p className="text-center">
              Bildirim için <Link href="/giris?sonra=/oneri" className="font-semibold underline">giriş yapın</Link> veya{" "}
              <Link href="/kayit?sonra=/oneri" className="font-semibold underline">kayıt olun</Link>.
            </p>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
