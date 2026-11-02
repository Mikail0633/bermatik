import { BadgeCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { call } from "@/lib/db";
import { CertificateForm } from "./CertificateForm";

export const metadata = { title: "Ustalık belgem" };
export const dynamic = "force-dynamic";

type Cert = { Id: string; Type: string; SerialNo: string; IssuedBy: string | null; Status: string; ReviewNote: string | null; CreatedAt: Date };

const CERT_TYPES: Record<string, string> = {
  ustalik: "Ustalık belgesi", kalfalik: "Kalfalık belgesi", usta_ogreticilik: "Usta öğreticilik belgesi", ciraklik: "Çıraklık belgesi", diger: "Diğer belge",
};
const STATUS: Record<string, [string, string]> = {
  pending: ["⏳ İnceleniyor", "text-muted"],
  verified: ["✓ Onaylandı", "text-open"],
  rejected: ["✗ Reddedildi", "text-closed"],
};

// Belge isteğe bağlı: yüklemeyen dükkânlar sitede "Belgesiz" görünür
export default async function Page() {
  const user = await requireUser("/panel/belgelerim");
  const certs = await call<Cert>("api.Certificate_ListMine", { ActorId: user.Id });
  const verified = certs.some((c) => c.Status === "verified");
  const box = "rounded-2xl border border-line bg-surface p-5";
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Ustalık belgem</h1>
        <p className="text-sm text-muted">
          Ustalık veya kalfalık belgenizi yükleyin. Bermatik ekibi kontrol edip onaylayınca dükkân sayfanızda
          <BadgeCheck className="mx-1 inline h-4 w-4 text-accent" aria-hidden /><b>Belgeli usta</b> rozeti çıkar ve müşteriler size daha çok güvenir.
          Belge isteğe bağlıdır; yüklemezseniz dükkânınız &quot;Belgesiz&quot; görünür.
        </p>
      </div>

      {verified && (
        <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">✓ Belgeniz onaylı. Dükkân sayfanızda &quot;Belgeli usta&quot; rozeti görünüyor.</p>
      )}

      {certs.length > 0 && (
        <section className={box}>
          <h2 className="mb-3 text-lg font-bold">Yüklediğim belgeler</h2>
          <ul className="divide-y divide-line">
            {certs.map((c) => (
              <li key={c.Id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <b>{CERT_TYPES[c.Type] ?? c.Type}</b> · Seri no: {c.SerialNo}{c.IssuedBy ? ` · ${c.IssuedBy}` : ""}
                  {c.Status === "rejected" && c.ReviewNote && <span className="block text-closed">Neden: {c.ReviewNote}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <a href={`/api/ustalik/${c.Id}`} target="_blank" className="underline">Gör</a>
                  <span className={`font-semibold ${STATUS[c.Status]?.[1] ?? ""}`}>{STATUS[c.Status]?.[0] ?? c.Status}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={box}>
        <h2 className="mb-3 text-lg font-bold">Belge yükle</h2>
        <CertificateForm types={Object.entries(CERT_TYPES)} />
        <p className="mt-3 text-xs text-muted">Belgeniz yalnızca Bermatik ekibi tarafından görülür, sitede yayınlanmaz. Belgedeki ad ile hesabınızdaki ad aynı olmalıdır.</p>
      </section>
    </div>
  );
}
