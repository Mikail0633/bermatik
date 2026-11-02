import type { MetadataRoute } from "next";

// Telefona "uygulama gibi" kurulum (PWA): ana ekranda Bermatik simgesi, tarayıcı çubuğu olmadan açılır.
// Simgeler: node scripts/build-icons.mjs
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bermatik — Berber ve kuaför randevusu",
    short_name: "Bermatik",
    description: "En yakın berber ve kuaförü bul, sırayı gör, online randevu al.",
    lang: "tr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    categories: ["lifestyle", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "En yakın berber", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "En yakın kuaför", url: "/kadin", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Randevularım", url: "/randevularim", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
