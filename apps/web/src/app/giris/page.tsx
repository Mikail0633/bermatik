import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, safeNext } from "@/lib/auth";
import { AuthCard } from "@/components/AuthCard";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Giriş yap", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ sonra?: string; neden?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.sonra);
  const ended = sp.neden === "oturum";
  if (await getUser()) redirect(next);
  return (
    <AuthCard
      title="Giriş yap"
      subtitle="Randevu almak için giriş yapın."
      footer={
        <>
          Hesabınız yok mu?{" "}
          <Link href={`/kayit${next !== "/" ? `?sonra=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink underline">
            Kayıt olun
          </Link>
        </>
      }
    >
      {sp.neden === "sifre" && (
        <p className="mb-4 rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">Şifreniz yenilendi. Yeni şifrenizle giriş yapabilirsiniz.</p>
      )}
      {ended && (
        <p className="mb-4 rounded-xl bg-accent/15 px-3 py-2 text-sm">Hesabınıza <b>başka bir cihazdan giriş yapıldığı</b> için bu cihazdaki oturumunuz kapandı. Siz değilseniz giriş yaptıktan sonra şifrenizi değiştirin.</p>
      )}
      <LoginForm next={next} />
    </AuthCard>
  );
}
