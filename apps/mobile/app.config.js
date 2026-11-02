// Bermatik telefon uygulaması ayarları.
// Sitenin adresi: EXPO_PUBLIC_API_URL verilirse o, verilmezse sitenin kendi ayarındaki SITE_URL
// (apps/web/.env.local — tünel adresi her açılışta değişir; uygulama paketlenirken güncel adresi okur).
// Not: Uygulama yalnızca bu adresteki /api/m uç noktalarıyla konuşur; veritabanı bilgisi uygulamada YOKTUR.
const fs = require('node:fs');
const path = require('node:path');

function siteUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', 'web', '.env.local'), 'utf8');
    const m = /^SITE_URL=(.+)$/m.exec(env);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch {}
  return 'http://localhost:3000';
}

const BLACK = '#0b0b0b';
const GOLD = '#C9A227';

module.exports = {
  expo: {
    name: 'Bermatik',
    slug: 'bermatik',
    scheme: 'bermatik',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    backgroundColor: BLACK,
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.bermatik.app',
    },
    android: {
      package: 'com.bermatik.app',
      adaptiveIcon: {
        backgroundColor: BLACK,
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: { favicon: './assets/favicon.png' },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-image',
      ['expo-splash-screen', { backgroundColor: BLACK, image: './assets/splash-icon.png', imageWidth: 160 }],
      ['expo-location', { locationWhenInUsePermission: 'Yakınınızdaki berber ve kuaförleri gösterebilmek için konumunuz kullanılır.' }],
      ['expo-notifications', { color: GOLD }],
    ],
    experiments: { typedRoutes: false },
    extra: { apiUrl: siteUrl() },
  },
};
