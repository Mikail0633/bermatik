// Bermatik uygulama simgeleri (PWA, iPhone ana ekran, tarayıcı sekmesi)
// Siyah zemin + altın makas — sitedeki logo ile aynı çizim (components/Logo.tsx).
// Kullanım: node scripts/build-icons.mjs   → apps/web/public/icons/*.png ve apps/web/src/app/icon.png
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const web = path.resolve(import.meta.dirname, '..', 'apps', 'web');
const sharp = createRequire(path.join(web, 'package.json'))('sharp');
const BG = '#0b0b0b', GOLD = '#C9A227';

// pad: simgenin kenarında bırakılacak boşluk (Android "maskable" simgede kenarlar kırpılır)
const svg = (pad, rounded) => {
  const s = 32 - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${rounded ? 7 : 0}" fill="${BG}"/>
  <g transform="translate(${pad} ${pad}) scale(${s / 32})" fill="none" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round">
    <circle cx="10" cy="22" r="3.2"/><circle cx="22" cy="22" r="3.2"/>
    <path d="M12.4 19.8 23 7.5M19.6 19.8 9 7.5"/>
  </g></svg>`;
};

const out = path.join(web, 'public', 'icons');
fs.mkdirSync(out, { recursive: true });
const make = (file, size, pad, rounded) => sharp(Buffer.from(svg(pad, rounded)), { density: 1200 }).resize(size, size).png().toFile(file);

await make(path.join(out, 'icon-192.png'), 192, 3, false);
await make(path.join(out, 'icon-512.png'), 512, 3, false);
await make(path.join(out, 'maskable-512.png'), 512, 7, false);   // kenarlar kırpılınca makas tam görünsün
await make(path.join(out, 'apple-touch-icon.png'), 180, 4, false); // iPhone kendisi yuvarlar
await make(path.join(web, 'src', 'app', 'icon.png'), 64, 1, true); // tarayıcı sekmesi

// favicon.ico: tarayıcılar bunu her siteden kendiliğinden ister (yoksa 404 olur).
// ICO dosyası, içine 32 ve 16 piksellik PNG gömülü basit bir kapsayıcıdır.
const pngs = await Promise.all([32, 16].map((s) => sharp(Buffer.from(svg(1, true)), { density: 1200 }).resize(s, s).png().toBuffer().then((b) => ({ s, b }))));
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach(({ s, b }, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s, e); header.writeUInt8(s, e + 1); header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(b.length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += b.length;
});
fs.writeFileSync(path.join(web, 'src', 'app', 'favicon.ico'), Buffer.concat([header, ...pngs.map((p) => p.b)]));
console.log('Simgeler hazır:', fs.readdirSync(out).join(', '), '+ src/app/icon.png, src/app/favicon.ico');
