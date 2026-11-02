import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";

// Inter yazı tipi siteyle birlikte paketlenir (derleme Google'a bağlanmak zorunda kalmaz; bu bilgisayarda bağlantı sık kopuyor).
// @fontsource-variable/inter (SIL Open Font License): Türkçe harfler dahil, her dosya yalnızca gerektiğinde iner.

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: "Bermatik — En yakın berber ve kuaförden randevu al", template: "%s | Bermatik" },
  description:
    "Türkiye'nin her yerinde en yakın berber ve kuaförü bul, sırayı gör, online randevu al. Fiyatlar, yorumlar ve çalışma saatleri tek yerde.",
  applicationName: "Bermatik",
  openGraph: { siteName: "Bermatik", locale: "tr_TR", type: "website" },
  // iPhone: "Ana Ekrana Ekle" ile uygulama gibi açılır
  appleWebApp: { capable: true, title: "Bermatik", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// Kadın bölümü açık, erkek bölümü koyu renklidir (globals.css, color-scheme bölüm bazında)
export const viewport: Viewport = { themeColor: "#0b0b0b", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="antialiased">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
