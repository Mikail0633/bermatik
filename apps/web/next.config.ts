import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// Güvenlik başlıkları: tarayıcıya sitenin nasıl korunacağını söyler.
// Dışarıdan yalnızca harita resimleri (OpenStreetMap) ve adres arama (Nominatim) kullanılır.
const csp = [
  "default-src 'self'",
  // Next.js sayfa verisini satır içi betikle taşır; geliştirmede hızlı yenileme eval kullanır
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'", // site başka bir sitenin içine gömülemez (sahte site tuzağı)
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Konum: yakınımdaki berberler ve sahada ekleme için yalnızca bu site; kamera/mikrofon kapalı
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Yalnızca güvenli bağlantı (HTTPS ile yayındayken geçerli olur; tarayıcı HTTP'de yok sayar)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Derleme klasörü: geliştirme sunucusunu yayındakiyle aynı anda çalıştırırken NEXT_DIST_DIR=.next-dev verin
  // (aynı klasörü paylaşırlarsa geliştirme sunucusu yayındaki sitenin dosyalarını bozar).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // SQL Server sürücüsü ve şifreleme modülü paketlenmeden Node'dan yüklenir
  // (paketlenince sürücünün tür kontrolleri bozuluyor)
  serverExternalPackages: ["mssql", "tedious", "@node-rs/argon2", "web-push", "nodemailer", "sharp"],
  poweredByHeader: false,
  // Doğrulama belgesi yüklemesi için (en fazla 8 MB dosya)
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
