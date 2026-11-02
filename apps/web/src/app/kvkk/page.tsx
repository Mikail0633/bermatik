import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "KVKK aydınlatma metni", description: "Bermatik kişisel verilerin korunması aydınlatma metni." };

// 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) md. 10 aydınlatma metni.
// Metin sitenin gerçekte işlediği verilere göre yazılmıştır; yeni bir veri işlendiğinde güncellenmelidir.
export default function Page() {
  return (
    <LegalPage title="Kişisel Verilerin Korunması Aydınlatma Metni">
      <p>
        Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca, Bermatik internet sitesini ve uygulamasını
        (&quot;Bermatik&quot;) kullanan müşteri, işletme sahibi ve personelin kişisel verilerinin nasıl işlendiğini açıklar.
      </p>

      <h2>1. Veri sorumlusu</h2>
      <p>
        Kişisel verileriniz, veri sorumlusu sıfatıyla <b>{LEGAL.controller}</b> (adres: {LEGAL.address}, e-posta: {LEGAL.email})
        tarafından işlenir.
      </p>

      <h2>2. Hangi verileri işliyoruz?</h2>
      <table>
        <thead><tr><th>Veri</th><th>Örnek</th><th>Kimden</th></tr></thead>
        <tbody>
          <tr><td>Kimlik</td><td>Ad, soyad, doğum yılı (isteğe bağlı)</td><td>Tüm üyeler</td></tr>
          <tr><td>İletişim</td><td>E-posta adresi, telefon numarası</td><td>Tüm üyeler</td></tr>
          <tr><td>Müşteri işlemleri</td><td>Randevular, randevu talepleri, siparişler, favoriler, yorumlar, şikayetler</td><td>Müşteriler</td></tr>
          <tr><td>İşlem güvenliği</td><td>Şifrenin geri çözülemez özeti, oturum bilgisi, IP adresi, tarayıcı/cihaz bilgisi, cihaz tanıma kimliği, giriş denemeleri</td><td>Tüm üyeler ve ziyaretçiler</td></tr>
          <tr><td>Konum</td><td>&quot;En yakın berberi bul&quot; dediğinizde tarayıcınızın verdiği anlık konum</td><td>İzin veren ziyaretçiler</td></tr>
          <tr><td>Görsel</td><td>Dükkân, personel, çalışma ve ürün fotoğrafları</td><td>İşletmeler ve personel</td></tr>
          <tr><td>Belge</td><td>Vergi levhası / esnaf kaydı, ustalık veya kalfalık belgesi ve seri numarası</td><td>İşletme sahibi ve personel</td></tr>
          <tr><td>Bildirim</td><td>Bildirim izni verdiğiniz cihazın bildirim adresi, bildirim tercihleri</td><td>İzin veren üyeler</td></tr>
          <tr><td>Kampanya izni</td><td>Kampanya e-postası / SMS onayınız veya reddiniz, tarihi ve o anki e-posta adresiniz / telefonunuz</td><td>Onay kutusunu işaretleyen üyeler</td></tr>
          <tr><td>İşletme bilgisi</td><td>Dükkân adı, adresi, telefonu, konumu, çalışma saatleri, fiyatlar</td><td>İşletmeler ve açık veri kaynakları</td></tr>
        </tbody>
      </table>
      <p>
        <b>Konum hakkında:</b> &quot;En yakın berberi bul&quot; özelliğinde konumunuz yalnızca o aramayı yapmak için kullanılır,
        sunucularımızda saklanmaz. Haritadan seçtiğiniz son konum, bir dahaki aramada kolaylık için yalnızca kendi tarayıcınızda tutulur.
        Yüklenen fotoğraflardaki konum (GPS) ve cihaz bilgileri yükleme sırasında otomatik olarak silinir.
      </p>

      <h2>3. Hangi amaçlarla ve hangi hukuki sebeplere dayanarak?</h2>
      <ul>
        <li><b>Üyelik, randevu ve siparişlerin yürütülmesi</b> (randevuyu dükkâna iletmek, size onay ve hatırlatma göndermek): sözleşmenin kurulması ve ifası için zorunlu olması (KVKK md. 5/2-c).</li>
        <li><b>Hesap güvenliği</b> (şifre koruması, çok fazla hatalı denemeyi engelleme, yeni bir cihazdan girişte sizi uyarma, robot kayıtlarını engelleme): meşru menfaat (md. 5/2-f) ve veri güvenliği yükümlülüğü (md. 12).</li>
        <li><b>İşletme ve belge doğrulama</b> (dükkân sahipliğinin ve ustalık belgesinin doğrulanması): sözleşmenin ifası (md. 5/2-c) ve meşru menfaat (md. 5/2-f).</li>
        <li><b>Hukuki yükümlülükler</b> (yetkili kurumların talepleri, kayıtların saklanması): kanunlarda açıkça öngörülmesi ve hukuki yükümlülük (md. 5/2-a, ç).</li>
        <li><b>Şikayet ve uyuşmazlıkların çözümü</b>: bir hakkın tesisi, kullanılması veya korunması (md. 5/2-e).</li>
        <li><b>Kampanya e-postası ve SMS</b>: yalnızca kayıtta ya da Hesabım sayfasında onay kutusunu işaretlediyseniz, onayınıza dayanarak (KVKK md. 5/1 ve 6563 sayılı Kanun md. 6). Onayınız ve reddiniz, kanunen tutulan İleti Yönetim Sistemi&apos;ne (İYS) kaydedilir. Vazgeçmek için Hesabım sayfasındaki anahtarı kapatmanız ya da iletideki &quot;İletiden çık&quot; bağlantısına basmanız yeterlidir. Randevu, hatırlatma ve şifre gibi bilgilendirme iletileri kampanya sayılmaz.</li>
        <li><b>Kampanya ve &quot;boşalan randevu&quot; bildirimleri</b>: yalnızca hesap ayarlarınızdan açtıysanız, açık rızanıza dayanarak (md. 5/1). Rızanızı aynı yerden istediğiniz an geri alabilirsiniz.</li>
      </ul>

      <h2>4. Kimlere aktarıyoruz?</h2>
      <ul>
        <li><b>Randevu aldığınız veya sipariş verdiğiniz dükkân:</b> adınız, telefonunuz ve randevu/sipariş bilgisi; hizmetin verilebilmesi için.</li>
        <li><b>Hizmet aldığımız altyapı sağlayıcıları:</b> e-posta gönderimi (Google — Gmail) ve tarayıcı bildirimleri (kullandığınız tarayıcının bildirim servisi: Google, Mozilla, Apple veya Microsoft). Bu sağlayıcıların sunucuları yurt dışında bulunabilir; aktarım KVKK md. 9&apos;daki şartlara uygun olarak yapılır.</li>
        <li><b>İleti Yönetim Sistemi (İYS):</b> kampanya e-posta/SMS onayı verdiyseniz; onay veya ret bilginiz, e-posta adresiniz / telefonunuz ve tarihi, kanun gereği.</li>
        <li><b>Yetkili kamu kurum ve kuruluşları:</b> kanunen zorunlu olduğunda.</li>
      </ul>
      <p>Kişisel verileriniz satılmaz, reklam amacıyla üçüncü kişilerle paylaşılmaz.</p>

      <h2>5. Ne kadar süre saklıyoruz?</h2>
      <ul>
        <li>Hesap bilgileri: hesabınız açık kaldığı sürece. Hesabınızı sildiğinizde ad, telefon, e-posta, yorum ve favorileriniz silinir; geçmiş randevu kayıtları kimliğinizi göstermeyecek şekilde anonim hâle getirilir.</li>
        <li>Oturum: en fazla 30 gün. Şifre sıfırlama kodları: 1 gün.</li>
        <li>Bildirimler: okunmuşlar 90 gün, okunmamışlar 180 gün.</li>
        <li>Bildirim cihazları ve tanınan cihazlar: 1 yıl kullanılmazsa silinir. Robot engelleme kayıtları: 90 gün.</li>
        <li>Kampanya onay ve ret kayıtları: onayın sona ermesinden itibaren 3 yıl (ticari ileti mevzuatı gereği). Hesabınızı silerseniz kampanya onayınız da geri alınmış sayılır.</li>
        <li>Eski sıra kayıtları ve sonuçlanan şikayetler: 2 yıl. Yönetim işlem kayıtları: 3 yıl.</li>
        <li>Kanunen daha uzun saklanması gereken kayıtlar, ilgili kanundaki süre boyunca saklanır.</li>
      </ul>

      <h2>6. Henüz Bermatik&apos;e katılmamış dükkânlar</h2>
      <p>
        Sitede &quot;Henüz Bermatik&apos;e katılmadı&quot; olarak görünen dükkânların adı, adresi, konumu ve (varsa) telefonu, herkese açık
        veri kaynaklarından (OpenStreetMap, Overture Maps) alınmıştır. Dükkân sahibi iseniz <Link href="/isletme">dükkânınızı sahiplenebilir</Link>,
        bilgilerini düzeltebilir veya {LEGAL.email} adresine yazarak kaldırılmasını isteyebilirsiniz.
      </p>

      <h2>7. Haklarınız (KVKK md. 11)</h2>
      <p>Bize başvurarak:</p>
      <ul>
        <li>kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme,</li>
        <li>işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
        <li>yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
        <li>eksik veya yanlış işlenmişse düzeltilmesini, KVKK md. 7 şartlarıyla silinmesini veya yok edilmesini isteme ve bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme,</li>
        <li>yalnızca otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme,</li>
        <li>kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
      </ul>
      <p>haklarına sahipsiniz. Hesabınızı istediğiniz an <Link href="/hesabim">Hesabım</Link> sayfasından kendiniz de silebilirsiniz.</p>

      <h2>8. Nasıl başvurabilirsiniz?</h2>
      <p>
        Taleplerinizi {LEGAL.email} adresine, kayıtlı e-posta adresinizden; ya da {LEGAL.address} adresine yazılı olarak iletebilirsiniz.
        Başvurunuz en geç 30 gün içinde ücretsiz olarak sonuçlandırılır. Başvurunuz reddedilirse veya yanıtı yeterli bulmazsanız
        Kişisel Verileri Koruma Kurulu&apos;na şikayette bulunabilirsiniz.
      </p>
    </LegalPage>
  );
}
