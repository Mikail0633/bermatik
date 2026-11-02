import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Şifremi unuttum", robots: { index: false } };

export default function Page() {
  return (
    <AuthCard
      title="Şifremi unuttum"
      subtitle="E-posta adresinize bir kod gönderelim, yeni şifrenizi belirleyin."
      footer={<Link href="/giris" className="font-semibold text-ink underline">Girişe dön</Link>}
    >
      <ResetForm />
    </AuthCard>
  );
}
