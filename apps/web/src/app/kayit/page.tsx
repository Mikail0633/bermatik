import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, safeNext } from "@/lib/auth";
import { callOne } from "@/lib/db";
import { AuthCard } from "@/components/AuthCard";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Kayıt ol", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ sonra?: string; tur?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.sonra);
  const business = sp.tur === "isletme";
  if (await getUser()) redirect(next);
  const settings = await callOne<{ CommercialConsentEnabled: boolean }>("api.Settings_Get");
  return (
    <AuthCard
      title="Kayıt ol"
      subtitle={business ? "İşletme hesabınızı açın, dükkânınızı ücretsiz ekleyin." : "Bir dakikada hesabınızı açın, hemen randevu alın."}
      footer={
        <>
          Zaten hesabınız var mı?{" "}
          <Link href={`/giris${next !== "/" ? `?sonra=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink underline">
            Giriş yapın
          </Link>
        </>
      }
    >
      <RegisterForm next={next} business={business} consentEnabled={Boolean(settings?.CommercialConsentEnabled)} />
    </AuthCard>
  );
}
