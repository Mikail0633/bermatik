import "server-only";
import { sendMail } from "./mail";

// Kayıttan sonra giden hoş geldin e-postası
export function sendWelcomeMail(email: string, firstName: string, isBusiness: boolean) {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  const text = isBusiness
    ? `Merhaba ${firstName},

Bermatik'e hoş geldiniz! İşletme hesabınız oluşturuldu.

Şimdi neler yapabilirsiniz:
• Dükkânınızı ekleyin ya da listede olan dükkânınızı sahiplenin
• Hizmetlerinizi, fiyatlarınızı ve çalışma saatlerinizi girin
• Personelinizi davet kodu ile ekleyin
• Online randevularınızı tek ekrandan yönetin

İşletme panelinize gitmek için: ${site}/panel

Sorunuz olursa bu e-postayı yanıtlayabilirsiniz.

Bermatik ekibi`
    : `Merhaba ${firstName},

Bermatik'e hoş geldiniz! Hesabınız oluşturuldu.

Artık şunları yapabilirsiniz:
• Size en yakın berber ve kuaförleri bulun
• Sıra beklemeden online randevu alın, dükkânın bugünkü sırasını görün
• Beğendiğiniz dükkânları favorilerinize ekleyin

Hemen başlamak için: ${site}

Sorunuz olursa bu e-postayı yanıtlayabilirsiniz.

Bermatik ekibi`;
  return sendMail({ email, name: firstName }, "Bermatik'e hoş geldiniz! ✂️", text);
}

// Hesaba tanımadığımız bir cihazdan girildiğinde
export function sendNewDeviceMail(email: string, firstName: string, device: string) {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  const when = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "long", timeStyle: "short" }).format(new Date());
  return sendMail(
    { email, name: firstName },
    "Bermatik hesabınıza yeni bir cihazdan giriş yapıldı",
    `Merhaba ${firstName},

Bermatik hesabınıza yeni bir cihazdan giriş yapıldı:
• Cihaz: ${device}
• Zaman: ${when}

Bu siz iseniz bir şey yapmanıza gerek yok.

Siz değilseniz hemen şifrenizi değiştirin: ${site}/hesabim
Şifrenizi değiştirince diğer bütün cihazlardaki oturumlar kapanır.

Bermatik`,
  );
}
