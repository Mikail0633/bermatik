import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Kullanım koşulları", description: "Bermatik kullanım koşulları." };

export default function Page() {
  return (
    <LegalPage title="Kullanım Koşulları">
      <p>
        Bu koşullar, Bermatik internet sitesini ve uygulamasını (&quot;Bermatik&quot;) kullanan herkes için geçerlidir. Bermatik&apos;i kullanarak
        ya da üye olarak bu koşulları kabul etmiş olursunuz. Bermatik&apos;i {LEGAL.controller} işletir.
      </p>

      <h2>1. Bermatik ne yapar?</h2>
      <p>
        Bermatik; berber, kuaför ve güzellik salonlarını bulmanızı, fiyatlarını ve çalışma saatlerini görmenizi, online randevu almanızı,
        dükkânın bugünkü randevu yoğunluğunu görmenizi ve dükkânların ürünlerini sipariş etmenizi sağlayan bir <b>aracı platformdur</b>. Hizmeti (traş, bakım vb.)
        ve ürünü dükkân sağlar; hizmetin kalitesinden, fiyatından ve ürünün kendisinden dükkân sorumludur. Ödemeler dükkânda yapılır;
        Bermatik ödeme almaz.
      </p>

      <h2>2. Üyelik</h2>
      <ul>
        <li>Üye olurken verdiğiniz bilgilerin doğru ve güncel olması gerekir. Bir e-posta adresi ve bir telefon numarasıyla yalnızca bir hesap açılabilir.</li>
        <li>13 yaşından küçükler üye olamaz. 18 yaşından küçükler veli veya vasilerinin onayıyla üye olmalıdır.</li>
        <li>Şifrenizi kimseyle paylaşmayın. Hesabınızdan yapılan işlemlerden siz sorumlusunuz. Hesabınıza yeni bir cihazdan girildiğinde sizi uyarırız; siz değilseniz hemen şifrenizi değiştirin.</li>
        <li>Hesabınızı istediğiniz an <Link href="/hesabim">Hesabım</Link> sayfasından silebilirsiniz.</li>
      </ul>

      <h2>3. Randevu ve siparişler</h2>
      <ul>
        <li>Randevunuz dükkân onayladığında kesinleşir. Gelemeyecekseniz lütfen randevunuzu iptal edin; boşalan saat başka birine verilebilir.</li>
        <li>Sürekli gelinmeyen randevular veya kötüye kullanım hâlinde hesabınız kısıtlanabilir.</li>
        <li>&quot;Sırayı gör&quot; sayfasında dükkânın o günkü randevu saatleri müşteri adı olmadan gösterilir; gerçek bekleme süresi dükkânın yoğunluğuna göre değişebilir.</li>
        <li>Siparişler dükkândan teslim alınır ve dükkânda ödenir; kargo yoktur. Siparişi dükkân hazırladığında size haber verilir.</li>
      </ul>

      <h2>4. &quot;Henüz Bermatik&apos;e katılmadı&quot; dükkânlar</h2>
      <p>
        Bu dükkânların bilgileri herkese açık veri kaynaklarından (OpenStreetMap, Overture Maps) alınmıştır ve güncel olmayabilir.
        Bu dükkânlar için bıraktığınız randevu talepleri, dükkânla telefonla görüşülerek ayarlanmaya çalışılır; kesinleşmesi garanti edilmez.
        Dükkân sahibiyseniz dükkânınızı <Link href="/isletme">sahiplenerek</Link> bilgilerini düzeltebilir ya da kaldırılmasını isteyebilirsiniz.
      </p>

      <h2>5. Yorumlar ve içerik</h2>
      <ul>
        <li>Yorumlar yalnızca o dükkândan hizmet almış müşteriler tarafından yazılabilir ve gerçek deneyime dayanmalıdır.</li>
        <li>Hakaret, küfür, nefret söylemi, kişisel bilgi, reklam, sahte yorum ve hukuka aykırı içerik yasaktır; bu içerikler uyarı yapılmadan kaldırılabilir.</li>
        <li>Yüklediğiniz fotoğraf ve içeriklerin size ait olduğunu veya paylaşma hakkınız bulunduğunu kabul edersiniz.</li>
        <li>Uygunsuz gördüğünüz içeriği &quot;Bildir&quot; düğmesiyle bize iletebilirsiniz.</li>
      </ul>

      <h2>6. İşletme hesapları</h2>
      <ul>
        <li>İşletme hesabıyla yalnızca size ait veya yönetme yetkiniz olan dükkânı ekleyebilir ya da sahiplenebilirsiniz. Sahiplik belgeyle doğrulanır.</li>
        <li>Fiyat, hizmet, çalışma saati ve personel bilgilerinin doğru olmasından işletme sorumludur.</li>
        <li>Ustalık belgesi rozeti yalnızca belge Bermatik tarafından doğrulandıktan sonra gösterilir.</li>
        <li>Müşterilere yalnızca Bermatik&apos;in hazır mesajlarıyla ve belirlenen sınırlar içinde mesaj gönderilebilir.</li>
      </ul>

      <h2>7. Yasak kullanımlar</h2>
      <ul>
        <li>Sitenin işleyişini bozmaya, güvenliğini aşmaya veya başkasının hesabına girmeye çalışmak,</li>
        <li>otomatik araçlarla (robot, tarayıcı betiği vb.) içerik toplamak veya toplu kayıt/işlem yapmak,</li>
        <li>sahte randevu, sipariş, yorum veya hesap oluşturmak</li>
      </ul>
      <p>yasaktır. Bu durumlarda hesap kapatılabilir ve yasal yollara başvurulabilir.</p>

      <h2>8. Sorumluluk</h2>
      <p>
        Bermatik&apos;in kesintisiz ve hatasız çalışması için gerekli özeni gösteririz; ancak bakım, teknik arıza veya bizden kaynaklanmayan
        nedenlerle yaşanan kesintilerden ve dükkânların verdiği hizmetten doğan zararlardan, kanunun izin verdiği ölçüde sorumlu değiliz.
      </p>

      <h2>9. Fikri mülkiyet</h2>
      <p>
        Bermatik&apos;in adı, logosu, tasarımı ve yazılımı {LEGAL.controller}&apos;a aittir. Harita ve henüz katılmamış dükkân bilgileri
        © OpenStreetMap katkıcıları (ODbL) ve Overture Maps Foundation (CDLA-Permissive-2.0) kaynaklıdır.
      </p>

      <h2>10. Kişisel veriler</h2>
      <p>Kişisel verilerinizin nasıl işlendiği <Link href="/kvkk">KVKK Aydınlatma Metni</Link>&apos;nde açıklanmıştır.</p>

      <h2>11. Değişiklikler</h2>
      <p>
        Bu koşullar gerektiğinde güncellenebilir. Önemli değişikliklerde sitede duyuru yapılır. Güncellemeden sonra Bermatik&apos;i kullanmaya
        devam etmeniz yeni koşulları kabul ettiğiniz anlamına gelir.
      </p>

      <h2>12. Uygulanacak hukuk ve iletişim</h2>
      <p>
        Bu koşullara Türkiye Cumhuriyeti kanunları uygulanır. Uyuşmazlıklarda {LEGAL.courtCity} mahkemeleri ve icra daireleri yetkilidir;
        tüketiciler, kanunda belirtilen değerlere göre Tüketici Hakem Heyetlerine veya Tüketici Mahkemelerine de başvurabilir.
        Bize {LEGAL.email} adresinden ulaşabilirsiniz.
      </p>
    </LegalPage>
  );
}
