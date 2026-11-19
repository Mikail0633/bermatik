import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { call } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { AccountDocumentUpload } from "@/components/DocumentUpload";

type Doc = { Id: string; Kind: string; Status: string; ReviewNote: string | null; NumberMasked: string | null; NviResult: string | null };
const KIND: Record<string, string> = {
  kimlik: "Kimlik kartı", ruhsat: "İşyeri açma ruhsatı", vergi_levhasi: "Vergi levhası", esnaf_kaydi: "Esnaf odası kaydı", diger: "Belge",
};

// İşletme hesabı doğrulanana kadar panelin yerine bu ekran görünür
export async function BusinessLock({ user }: { user: SessionUser }) {
  const docs = await call<Doc>("api.OwnerDocument_List", { ActorId: user.Id, Account: true });
  const pending = docs.filter((d) => d.Status === "pending");
  return (
    <div data-segment="erkek" className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-xl px-4 py-10">
        <Link href="/" aria-label="Bermatik ana sayfa"><Logo /></Link>
        <div className="mt-6 rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold">İşletme hesabınız doğrulanıyor</h1>
          <p className="mt-1 text-muted">
            Sahte işletme hesaplarını önlemek için işletme paneli, doğrulama belgeniz onaylanınca açılır.
            Kimlik kartıyla doğrulamada bilgileriniz nüfus kayıtlarıyla eşleşirse panel hemen açılır.
          </p>
          {user.Role === "staff" && (
            <p className="mt-3 rounded-xl border border-line bg-bg px-3 py-2 text-sm">
              Bir dükkâna davet koduyla katıldıysanız belge yüklemeniz gerekmez: dükkân sahibinin hesabı onaylanınca
              paneliniz kendiliğinden açılır. Dükkândan çıkarıldıysanız panele girmek için kendi belgenizi yükleyin.
            </p>
          )}
          {docs.length > 0 && (
            <ul className="mt-5 space-y-2 text-sm">
              {docs.map((d) => (
                <li key={d.Id} className="rounded-xl border border-line px-3 py-2">
                  <b>{KIND[d.Kind] ?? d.Kind}</b>{d.NumberMasked ? ` · ${d.NumberMasked}` : ""}
                  <span className="ml-1">
                    {d.Status === "pending" && (d.NviResult === "hata"
                      ? "— nüfus servisine şu an ulaşılamadı; Bermatik ekibi elle inceleyecek."
                      : "— inceleniyor. Onaylanınca bildirim alacaksınız.")}
                    {d.Status === "approved" && "— ✓ uygun bulundu"}
                    {d.Status === "rejected" && <span className="text-closed">— ✗ uygun bulunmadı{d.ReviewNote ? `: ${d.ReviewNote}` : ""}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6">
              <h2 className="mb-2 font-bold">
                {pending.length ? "Beklemek istemiyorsanız kimlik kartınızla hemen doğrulayın" : docs.length ? "Yeni belge yükleyin" : "Doğrulama belgenizi yükleyin"}
              </h2>
              <AccountDocumentUpload askBirthYear={!user.BirthYear} />
          </div>
          <p className="mt-6 text-sm text-muted">
            Hesap adınız ({user.FirstName} {user.LastName}) belgedeki adla aynı olmalı. Yanlışsa{" "}
            <Link href="/hesabim" className="font-semibold underline">Hesabım</Link> sayfasından düzeltin.
          </p>
        </div>
      </div>
    </div>
  );
}
