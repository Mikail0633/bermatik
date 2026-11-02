// Bermatik — Geliştirme veritabanını (BermatikDev) sıfırdan kurar ve örnek veriyle doldurur.
// Gerçek "Bermatik" veritabanına dokunmaz.
//   npm run db:dev
// Örnek hesaplar: admin@bermatik.test, ahmet@bermatik.test ... şifre: Deneme123!
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'apps', 'web', 'package.json'));
const { hash } = require('@node-rs/argon2');

const run = (args) => execFileSync('node', [path.join(root, 'scripts', 'db-setup.mjs'), ...args], { stdio: 'inherit' });
const sqlcmd = (db, args) =>
  execFileSync('sqlcmd', ['-S', 'localhost', '-E', '-C', '-b', '-I', '-f', '65001', '-d', db, ...args], { encoding: 'utf8' });

// 1) Şema + işlemler + yetkiler (DevTest değil, o yüzden --reset yerine elle siliyoruz)
sqlcmd('master', ['-Q', "IF DB_ID('BermatikDev') IS NOT NULL BEGIN ALTER DATABASE BermatikDev SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE BermatikDev; END"]);
run(['--db', 'BermatikDev']);

// 2) Sitenin kullanıcısını bu veritabanına da bağla
sqlcmd('BermatikDev', ['-Q', `IF DATABASE_PRINCIPAL_ID('bermatik_app_user') IS NULL CREATE USER bermatik_app_user FOR LOGIN bermatik_app;
  ALTER ROLE bermatik_app ADD MEMBER bermatik_app_user;`]);

// 3) Örnek veri (şifre özeti burada üretilir)
const pwHash = await hash('Deneme123!');
const sql = fs.readFileSync(path.join(root, 'database', 'dev', 'demo-data.sql'), 'utf8').replace('$(PW_HASH)', pwHash.replace(/'/g, "''"));
const tmp = path.join(os.tmpdir(), `bermatik-demo-${process.pid}.sql`);
fs.writeFileSync(tmp, sql, 'utf8');
try {
  process.stdout.write(sqlcmd('BermatikDev', ['-i', tmp]));
} finally {
  fs.rmSync(tmp, { force: true });
}

// 4) Gizli test dükkânına saat, personel, hizmet
process.stdout.write(sqlcmd('BermatikDev', ['-i', path.join(root, 'database', 'dev', 'test-shop.sql')]));
