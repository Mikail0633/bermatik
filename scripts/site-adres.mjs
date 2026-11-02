// Bermatik — sitenin herkese açık adresiyle ilgili yardımcı (site-baslat.ps1 kullanır)
//   node scripts/site-adres.mjs ayarla <adres>  → apps/web/.env.local içindeki SITE_URL'i günceller
//   node scripts/site-adres.mjs gonder <adres>  → yeni adresi Gmail'den site sahibine e-postayla yollar
// .env.local UTF-8'dir; PowerShell 5 ile düzenlenirse Türkçe açıklamalar bozulur, bu yüzden Node ile.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const envPath = path.join(root, 'apps', 'web', '.env.local');
const [cmd, url] = process.argv.slice(2);
if (!/^https:\/\/[a-z0-9.-]+$/i.test(url ?? '')) {
  console.error('Geçersiz adres:', url);
  process.exit(1);
}

let env = fs.readFileSync(envPath, 'utf8');
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? '';

if (cmd === 'ayarla') {
  env = /^SITE_URL=/m.test(env)
    ? env.replace(/^SITE_URL=.*$/m, `SITE_URL=${url}`)
    : `${env.replace(/\s*$/, '\n')}\n# Sitenin herkese açık adresi\nSITE_URL=${url}\n`;
  fs.writeFileSync(envPath, env, 'utf8');
  console.log('SITE_URL =', url);
} else if (cmd === 'gonder') {
  const user = get('GMAIL_USER');
  const pass = get('GMAIL_APP_PASSWORD').replace(/\s/g, '');
  if (!user || !pass) {
    console.log('Gmail ayarı yok, e-posta gönderilmedi.');
    process.exit(0);
  }
  const require = createRequire(path.join(root, 'apps', 'web', 'package.json'));
  const nodemailer = require('nodemailer');
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } });
  await t.sendMail({
    from: { name: 'Bermatik', address: user },
    to: user,
    subject: 'Bermatik açıldı — yeni site adresi',
    text: `Merhaba,\n\nBermatik yeniden başladı. Sitenin bugünkü adresi:\n\n${url}\n\nGeçici adres her yeniden başlatmada değişir; paylaştığınız eski bağlantılar artık açılmaz.\n\nBermatik`,
  });
  console.log('Adres e-postayla gönderildi:', user);
} else {
  console.error('Kullanım: node scripts/site-adres.mjs ayarla|gonder <adres>');
  process.exit(1);
}
