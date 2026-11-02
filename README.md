# Bermatik ✂️

**Türkiye geneli berber ve kuaför randevu platformu** — web sitesi, işletme paneli, yönetim paneli ve Android/iPhone uygulaması.

🔗 **Canlı deneme:** [mikail0633.github.io/bermatik](https://mikail0633.github.io/bermatik/) *(her zaman sitenin güncel adresine yönlendirir)*

> Proje beta aşamasındadır. 81 ilden ~40.000 berber/kuaför açık harita verilerinden (OpenStreetMap, Overture) aktarılmıştır; dükkân sahipleri "Bu dükkân sizin mi?" ile işletmelerini sahiplenebilir.

---

## Ne yapıyor?

| Kim | Neler yapabilir |
|---|---|
| **Müşteri** | Erkek / kadın bölümü arasında tek tuşla geçiş · yakınımdaki dükkânlar (GPS) · il → ilçe listeleri · dükkân sayfası, hizmetler, fiyatlar, personel · personel seçerek randevu · "Sırayı gör" (bugünkü dolu saatler) · favoriler · yorum · bildirimler · dükkân ürünlerini sipariş edip salonda ödeme |
| **İşletme (berber / kuaför)** | Bugün ekranı · randevu onaylama, telefonla gelen randevuyu ekleme · çalışma saatleri, kapalı günler · hizmet ve fiyatlar · personel (davet kodu, mola, izin) · fotoğraflar · mağaza ve siparişler · ustalık/kalfalık belgesi yükleme · müşterilere hazır şablonla mesaj |
| **Yönetici** | Dükkân onayı/askıya alma · harita üzerinden dükkân ekleme (sahada telefonla GPS'li ekleme) · kullanıcılar · yorum ve şikâyetler · belge doğrulama · sahiplenme talepleri · istatistik · işlem kayıtları · özellik anahtarları |

## Teknolojiler

- **Web:** Next.js 15 (App Router, sunucu tarafı oluşturma), TypeScript, Tailwind CSS 4
- **Mobil:** Expo SDK 58 (React Native, expo-router) — tamamen yerel (native) uygulama, Android + iPhone
- **Veritabanı:** Microsoft SQL Server 2025 — iş kuralları saklı yordamlarda (`api.*`), uygulama tablolara doğrudan erişmez
- **Harita:** OpenStreetMap + Leaflet (ücretsiz), yol tarifi için Google Haritalar bağlantısı
- **Bildirim:** Web Push (VAPID) + Expo Push, hatırlatıcılar için arka plan işçisi
- **E-posta:** Nodemailer (Gmail SMTP)
- **Fotoğraflar:** sharp ile WebP'ye çevirme, EXIF/GPS konum bilgisini silme
- **Yayın (deneme):** Cloudflare Tüneli + GitHub Pages yönlendirmesi

## Klasör yapısı

```
apps/
  web/        Next.js sitesi + işletme paneli (/panel) + yönetim paneli (/admin) + mobil uygulamanın API'si (/api/m/*)
  mobile/     Expo mobil uygulaması (müşteri + işletme ekranları)
database/
  migrations/ Tablo yapısı, sırayla çalışan 25 değişiklik dosyası (0001 → 0025)
  procedures/ Saklı yordamlar: giriş, dükkân, randevu, bildirim, yönetim...
  tests/      Veritabanı testleri (220+ test)
  dev/        Geliştirme için örnek veriler
scripts/      Kurulum, veri aktarma, ikon üretme, gece yedeği, siteyi başlatma betikleri
```

---

## Adım adım nasıl yapıldı?

Proje, her adımda bir karar verilip uygulanarak ve test edilerek geliştirildi.

### 1. Planlama ve kararlar
- Tek platformda **erkek berberleri** (koyu tema: siyah + altın) ve **kadın kuaförleri** (açık tema: pudra + bordo), tek bir geçiş butonu.
- Önce web, sonra mobil. Telefon randevuları için "tıkla-ara" + berberin panele elle girmesi.
- Ödeme altyapısı yerine **online sipariş, salonda ödeme**.

### 2. Veritabanı
- Supabase denendi, sonra yönetimi daha anlaşılır olduğu için **yerel SQL Server**'a geçildi.
- `database/migrations/0001_schema.sql`: kullanıcılar, dükkânlar, personel, hizmetler, randevular...
- `0002_address_data.sql`: **Türkiye'nin tüm il → ilçe → mahalle** listesi.
- Her iş kuralı bir saklı yordam: ör. `api.Auth_Register`, `api.Shop_Search`, `api.Appointment_Create`. Testler `database/tests/run-tests.sql` içinde.

### 3. Web sitesi (müşteri tarafı)
- Ana sayfa (`/` erkek, `/kadin` kadın), "Yakınımda", il/ilçe sayfaları, dükkân sayfası.
- **SEO:** `/erkek/ankara/yenimahalle/dukkan-adi` gibi okunaklı adresler, site haritası, schema.org (HairSalon) bilgileri.

### 4. Üyelik ve güvenlik
- E-posta + şifre ile kayıt/giriş, şifremi unuttum (kodlu), hoş geldin e-postası.
- Hesap başına tek oturum, yeni cihazdan girişte uyarı, şifre gücü ölçer.
- Güvenlik başlıkları (CSP, HSTS), bot koruması (gizli alan + doldurma süresi), kalıcı istek sınırlama.
- KVKK onayı ve İYS'ye hazır ticari ileti izin kaydı.

### 5. İşletme paneli
- "Bu dükkân sizin mi?" sahiplenme akışı, yeni ilan verme.
- Bugün ekranı, randevular, saatler, hizmetler, personel (davet kodu, mola, izin), kapalı günler.

### 6. Yönetim paneli
- Dükkân ekleme/düzenleme (haritadan tıklayınca il/ilçe/mahalle otomatik dolar), onay durumları, kullanıcılar, yorumlar, şikâyetler, belgeler, ayarlar, istatistik.
- Otomatik dükkân kodu: `BRM-E-00001` (erkek), `BRM-K-00001` (kadın).

### 7. Hesap, favoriler, bildirimler
- Hesabım (profil, şifre, bildirim tercihleri, hesap silme), favoriler, bildirim zili.

### 8. Fotoğraflar, mağaza, bildirimler, PWA
- Kapak/galeri/personel fotoğrafı yükleme (WebP, konum bilgisi silinir) — **sahte/örnek fotoğraf kullanılmaz**.
- Dükkân mağazası ve sipariş takibi.
- Telefona bildirim (Web Push) ve randevudan 24 saat / 2 saat önce hatırlatma.
- Sitenin telefona uygulama gibi kurulabilmesi (PWA).
- Paylaş butonu (WhatsApp, Telegram, Facebook, X, e-posta).

### 9. Türkiye geneli veri aktarımı
- `scripts/import-places.mjs`: OpenStreetMap ve Overture açık verilerinden **81 il, ~40.000 dükkân**; konumdan il/ilçe/mahalle bulma, mükerrer kayıt ayıklama.

### 10. Yayına alma (deneme)
- `scripts/site-baslat.ps1`: Bilgisayar açılınca site derlenir, Cloudflare Tüneli ile internete açılır, yeni adres e-postayla gönderilir ve **GitHub Pages yönlendirmesi** (`scripts/github-link.ps1`) güncellenir.
- `scripts/db-nightly.ps1`: Her gece veritabanı ve dosya yedeği.

### 11. Mobil uygulama
- **Aşama 1 (müşteri):** Keşfet, Yakınımda, Randevularım, Hesabım; dükkân sayfası, randevu sihirbazı, harita ile konum seçme — sitenin görünümüyle birebir aynı.
- **Aşama 2 (işletme):** İşletmem sekmesi; bugün, randevular, saatler, hizmetler, personel, kapalı günler.
- Uygulama veritabanına **asla doğrudan bağlanmaz**; yalnızca sitenin `/api/m/*` uç noktalarını (Bearer token) kullanır.

---

## Kendi bilgisayarında çalıştırma

Gerekenler: Node.js 22+, Microsoft SQL Server (Developer sürümü ücretsiz).

```bash
# 1) Veritabanını kur ve örnek verileri yükle
npm run db:dev

# 2) Web ayarları
cd apps/web
cp .env.example .env.local   # içini doldurun
npm install
npm run dev                  # http://localhost:3000

# 3) Mobil uygulama
cd ../mobile
npm install
npx expo start               # Expo Go ile QR kodu okutun
```

Örnek hesaplar yalnızca geliştirme veritabanında (`BermatikDev`) bulunur.

## Lisans

Tüm hakları saklıdır. Kod incelemek için paylaşılmıştır; izinsiz ticari kullanımı yasaktır.
