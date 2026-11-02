import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarCheck, Clock, Store, Users } from "lucide-react";
import { getUser } from "@/lib/auth";
import { AppError, callOne } from "@/lib/db";
import type { ShopDetail } from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";
import { ClaimForm } from "./ClaimForm";

export const metadata: Metadata = {
  title: "Dükkânınızı Bermatik'e ekleyin — ücretsiz",
  description: "Berber ve kuaförler için ücretsiz online randevu, bugünkü sıra, fiyat listesi ve müşteri hatırlatmaları.",
};

// Berberler için: "Dükkânını ekle" tanıtımı ve "Bu dükkân sizin mi?" sahiplenme formu
export default async function Page({ searchParams }: { searchParams: Promise<{ sahiplen?: string }> }) {
  const { sahiplen } = await searchParams;
  const user = await getUser();
  const isCustomer = user?.Role === "customer";
  // Müşteri hesabıyla girildiyse: işletme işlemleri kapalı
  const customerNote = (
    <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink">
      Şu an <b>müşteri hesabıyla</b> giriş yaptınız. Dükkân eklemek veya sahiplenmek için <b>işletme hesabı</b> gerekir:
      çıkış yapıp &quot;İşletme&quot; seçeneğiyle yeni bir hesap açın ya da bizimle iletişime geçin.
    </p>
  );

  if (sahiplen && /^[0-9a-f-]{36}$/i.test(sahiplen)) {
    let shop: ShopDetail | undefined;
    try { shop = await callOne<ShopDetail>("api.Shop_Get", { ShopId: sahiplen }); } catch (e) { if (!(e instanceof AppError)) throw e; }
    if (shop && (!shop.IsClaimed || shop.OwnerIsAdmin)) {
      return (
        <SiteShell segment={shop.Segment}>
          <div className="mx-auto max-w-xl px-4 py-10">
            <h1 className="text-3xl font-extrabold">Bu dükkân sizin mi?</h1>
            <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
              <p className="text-lg font-bold">{shop.Name}</p>
              <p className="text-sm text-muted">{shop.Street}, {shop.Neighborhood}, {shop.District}/{shop.Province}</p>
            </div>
            <p className="mt-4 text-muted">Sahiplendiğinizde dükkân sayfanız sizin olur: hizmet ve fiyatlarınızı, personelinizi ve çalışma saatlerinizi girersiniz; müşteriler online randevu alır ve bugünkü sıranızı görür. <b>Ücretsizdir.</b></p>
            <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
              {isCustomer ? customerNote : user && !user.EmailVerified ? (
                <div className="text-center">
                  <p>Sahiplenmeden önce e-posta adresinizi doğrulayın.</p>
                  <Link href={`/dogrula?sonra=${encodeURIComponent(`/isletme?sahiplen=${shop.Id}`)}`} className="mt-3 inline-block rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-ink">E-postamı doğrula</Link>
                </div>
              ) : user ? (
                <ClaimForm shopId={shop.Id} phone={user.Phone} />
              ) : (
                <div className="text-center">
                  <p>Devam etmek için giriş yapın veya ücretsiz kayıt olun.</p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Link href={`/giris?sonra=${encodeURIComponent(`/isletme?sahiplen=${shop.Id}`)}`} className="rounded-xl border border-line px-5 py-2.5 font-semibold">Giriş yap</Link>
                    <Link href={`/kayit?tur=isletme&sonra=${encodeURIComponent(`/isletme?sahiplen=${shop.Id}`)}`} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-ink">Kayıt ol</Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SiteShell>
      );
    }
  }

  const features = [
    { icon: CalendarCheck, title: "Online randevu", text: "Müşteriler 7/24 boş saatlerinizden randevu alır; siz onaylarsınız." },
    { icon: Users, title: "Sırayı gör", text: "Müşteriler bugün kaç randevunuz olduğunu ve dolu saatleri telefondan görür." },
    { icon: Clock, title: "Hatırlatma", text: "Randevudan 1 gün ve 2 saat önce otomatik hatırlatma; gelmeyen azalır." },
    { icon: BadgeCheck, title: "Belgeli usta rozeti", text: "Ustalık belgenizi yükleyin, sayfanızda onaylı rozet çıksın." },
  ];
  return (
    <SiteShell segment="erkek">
      <section className="bg-hero text-hero-ink">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <Store className="h-12 w-12 text-cta" aria-hidden />
          <h1 className="mt-3 text-3xl font-extrabold sm:text-5xl">Dükkânınızı Bermatik&apos;e ekleyin</h1>
          <p className="mt-3 max-w-2xl text-lg opacity-85">Berber ve kuaförler için ücretsiz: online randevu, bugünkü sıra, fiyat listesi ve müşteri hatırlatmaları.</p>
          {isCustomer ? <div className="mt-8 max-w-2xl">{customerNote}</div> : <div className="mt-8 flex flex-wrap gap-3">
            <Link href={user ? "/panel/yeni" : "/kayit?tur=isletme&sonra=/panel/yeni"} className="rounded-2xl bg-cta px-6 py-4 text-lg font-bold text-cta-ink shadow-lg">Dükkânımı ekle (ilan ver)</Link>
            {user && <Link href="/panel" className="rounded-2xl border border-white/40 px-6 py-4 text-lg font-semibold">İşletme paneline git</Link>}
          </div>}
          <p className="mt-4 text-sm opacity-80">Dükkânınız sitede &quot;Bermatik&apos;te değil&quot; olarak görünüyorsa, dükkân sayfasındaki <b>&quot;Dükkânı sahiplen&quot;</b> butonunu kullanın.</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-10 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-3 rounded-2xl border border-line bg-surface p-5">
            <Icon className="h-7 w-7 shrink-0 text-accent" aria-hidden />
            <div><h2 className="font-bold">{title}</h2><p className="text-sm text-muted">{text}</p></div>
          </div>
        ))}
      </section>
    </SiteShell>
  );
}
