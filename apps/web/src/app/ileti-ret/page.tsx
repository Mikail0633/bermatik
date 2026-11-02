import type { Metadata } from "next";
import Link from "next/link";
import { verifyUnsubscribe } from "@/lib/ileti";
import { AuthCard } from "@/components/AuthCard";
import { UnsubscribeButton } from "./UnsubscribeButton";

export const metadata: Metadata = { title: "İletiden çık", robots: { index: false } };
export const dynamic = "force-dynamic";

// Kampanya e-postası / SMS'indeki "İletiden çık" bağlantısı.
// Sayfayı açmak tek başına bir şey değiştirmez (e-posta programları bağlantıları önceden açabilir); düğmeye basmak gerekir.
export default async function Page({ searchParams }: { searchParams: Promise<{ u?: string; k?: string; i?: string }> }) {
  const sp = await searchParams;
  const ok = verifyUnsubscribe(sp.u ?? "", sp.k ?? "", sp.i ?? "");
  const kanal = ok?.channel === "MESAJ" ? "SMS" : "e-posta";
  return (
    <AuthCard title="İletiden çık" subtitle={ok ? `Bermatik kampanya ${kanal} iletilerini artık almak istemiyor musunuz?` : "Bağlantı geçersiz."}>
      {ok ? (
        <UnsubscribeButton u={sp.u!} k={ok.channel} i={sp.i!} kanal={kanal} />
      ) : (
        <p className="text-sm text-muted">
          Bağlantı eksik ya da hatalı. Giriş yapıp <Link href="/hesabim" className="font-semibold underline">Hesabım</Link> sayfasından
          ticari ileti izinlerinizi kapatabilirsiniz.
        </p>
      )}
    </AuthCard>
  );
}
