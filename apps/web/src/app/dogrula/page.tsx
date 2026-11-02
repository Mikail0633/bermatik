import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser, safeNext } from "@/lib/auth";
import { AuthCard } from "@/components/AuthCard";
import { VerifyForm } from "./VerifyForm";

export const metadata: Metadata = { title: "E-postanızı doğrulayın", robots: { index: false } };
export const dynamic = "force-dynamic";

// İşletme hesapları dükkân eklemeden / sahiplenmeden önce e-postalarını doğrular
export default async function Page({ searchParams }: { searchParams: Promise<{ sonra?: string }> }) {
  const user = await requireUser("/dogrula");
  const next = safeNext((await searchParams).sonra);
  if (user.EmailVerified) redirect(next === "/" ? "/panel" : next);
  return (
    <AuthCard title="E-postanızı doğrulayın" subtitle={`Dükkân eklemeden önce ${user.Email} adresinin size ait olduğunu doğrulayalım.`}>
      <VerifyForm next={next} />
    </AuthCard>
  );
}
