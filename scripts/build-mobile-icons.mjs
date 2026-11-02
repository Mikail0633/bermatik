// Bermatik telefon uygulaması simgeleri — sitedeki simgenin aynısı (siyah zemin + altın makas).
// Kullanım: node scripts/build-mobile-icons.mjs   → apps/mobile/assets/*.png
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const sharp = createRequire(path.join(root, 'apps', 'web', 'package.json'))('sharp');
const out = path.join(root, 'apps', 'mobile', 'assets');
const BG = '#0b0b0b', GOLD = '#C9A227';

// pad: kenar boşluğu (32'lik çizimde). bg: zemin rengi ya da null (saydam). color: makas rengi
const svg = (pad, bg, color = GOLD) => {
  const s = 32 - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  ${bg ? `<rect width="32" height="32" fill="${bg}"/>` : ''}
  <g transform="translate(${pad} ${pad}) scale(${s / 32})" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round">
    <circle cx="10" cy="22" r="3.2"/><circle cx="22" cy="22" r="3.2"/>
    <path d="M12.4 19.8 23 7.5M19.6 19.8 9 7.5"/>
  </g></svg>`;
};
const make = (file, size, s) => sharp(Buffer.from(s), { density: 2400 }).resize(size, size).png().toFile(path.join(out, file));

await make('icon.png', 1024, svg(4, BG));                               // iPhone + genel simge (köşeleri sistem yuvarlar)
await make('android-icon-foreground.png', 1024, svg(9, null));          // Android: kenarlar kırpılır, makas güvenli alanda
await make('android-icon-background.png', 1024, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="${BG}"/></svg>`);
await make('android-icon-monochrome.png', 1024, svg(9, null, '#ffffff')); // Android 13+ temalı simge
await make('splash-icon.png', 1024, svg(6, null));                      // açılış ekranı (siyah zemin üstünde)
await make('favicon.png', 48, svg(1, BG));
console.log('Simgeler hazır:', out);
