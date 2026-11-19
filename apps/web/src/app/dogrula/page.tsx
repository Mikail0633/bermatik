import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser, safeNext } from "@/lib/auth";
import { call } from "@/lib/db";
import { AuthCard } from "@/components/AuthCard";
import { AccountDocumentUpload } from "@/components/DocumentUpload";
import { VerifyForm } from "./VerifyForm";

export const metadata: Metadata = { title: "E-postanızı doğrulayın", robots: { index: false } };
export const dynamic = "force-dynamic";

// İşletme hesapları dükkân eklemeden / sahiplenmeden önce e-postalarını doğrular
export default async function Page({ searchParams }: { searchParams: Promise<{ sonra?: string }> }) {
  const user = await requireUser("/dogrula");
  const next = safeNext((await searchParams).sonra);
  if (user.EmailVerified) redirect(next === "/" ? "/panel" : next);
  // Kayıtta belge yüklenmediyse (ör. telefon uygulamasından kayıt) burada istenir
  const business = user.Role === "shop_owner" || user.Role === "staff";
  const docs = business ? await call<{ Status: string }>("api.OwnerDocument_List", { ActorId: user.Id, Account: true }) : [];
  const needsDoc = business && !docs.some((d) => d.Status !== "rejected");
  return (
    <AuthCard title="E-postanızı doğrulayın" subtitle={`Dükkân eklemeden önce ${user.Email} adresinin size ait olduğunu doğrulayalım.`}>
      {business && !needsDoc && (
        <p className="mb-4 rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">
          {user.BusinessVerified ? "✓ İşletme hesabınız doğrulandı." : "✓ Doğrulama belgeniz alındı. Bermatik ekibi inceleyecek."}
        </p>
      )}
      {needsDoc && (
        <div className="mb-6 rounded-xl border border-line p-3">
          <p className="text-sm font-semibold">İşletme doğrulama belgesi</p>
          <p className="mb-3 text-xs text-muted">Kimlik kartı (nüfus kayıtlarından anında doğrulanır), işyeri açma ruhsatı, vergi levhası veya esnaf odası kaydı. Belgenizi yalnızca Bermatik ekibi görür.</p>
          <AccountDocumentUpload askBirthYear={!user.BirthYear} />
        </div>
      )}
      <VerifyForm next={next} />
    </AuthCard>
  );
}
