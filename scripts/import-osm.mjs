// Bermatik — OpenStreetMap'teki gerçek berber/kuaförleri "henüz katılmadı" olarak içe aktarır.
// Veri lisansı: ODbL (© OpenStreetMap katkıcıları) — sitede kaynak gösterilir.
//
//   npm run import:osm                         → BermatikDev, Kuzey Ankara (Pursaklar, Keçiören, Çubuk, Akyurt...)
//   npm run import:osm -- --db Bermatik        → asıl veritabanı
//   npm run import:osm -- --bbox 39.8,32.6,40.0,32.95   → başka bölge (güney,batı,kuzey,doğu)
//
// İlçe/mahalle, konumdan OpenStreetMap Nominatim ile bulunur (saniyede 1 sorgu, önbellekli).
// Emin olunamayan kayıtlar admin panelinde "kontrol bekliyor" olarak işaretlenir.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const db = opt('--db', 'BermatikDev');
const bbox = opt('--bbox', '39.90,32.75,40.30,33.15');
const UA = 'Bermatik-import/0.1 (berber randevu platformu, gelistirme)';
const root = path.resolve(import.meta.dirname, '..');
const cacheFile = path.join(root, 'scripts', '.cache', 'nominatim.json');
fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sqlcmd = (args2) => execFileSync('sqlcmd', ['-S', 'localhost', '-E', '-C', '-b', '-I', '-f', '65001', '-d', db, ...args2], { encoding: 'utf8', maxBuffer: 64 << 20 });

// 1) OpenStreetMap'ten berber/kuaför kayıtları
async function overpass() {
  const q = `[out:json][timeout:90];nwr["shop"~"^(hairdresser|beauty)$"](${bbox});out center tags;`;
  for (const srv of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(srv, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
        if (res.ok) return (await res.json()).elements;
      } catch { /* sıradaki sunucu */ }
      await sleep(3000);
    }
  }
  throw new Error('OpenStreetMap sunucularına ulaşılamadı, biraz sonra tekrar deneyin.');
}

// 2) Konumdan adres (önbellekli, saniyede en fazla 1 sorgu)
async function reverse(lat, lon) {
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (cache[key]) return cache[key];
  await sleep(1100);
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=tr`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const a = res.ok ? (await res.json()).address ?? {} : {};
  cache[key] = a;
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
  return a;
}

// 3) Veritabanındaki il/ilçe/mahalle listesi
const norm = (s) => (s ?? '').toLocaleLowerCase('tr-TR').replace(/\s+mahallesi$|\s+mah\.?$/u, '').replace(/[^a-zçğıöşü0-9]/gu, '');
// Türkçe harfler bozulmasın diye sonuç ekrana değil, Unicode (-u) bir dosyaya yazdırılır
const areaFile = path.join(path.dirname(cacheFile), 'areas.json');
execFileSync('sqlcmd', ['-S', 'localhost', '-E', '-C', '-b', '-d', db, '-u', '-y', '0', '-o', areaFile, '-Q',
  `SET NOCOUNT ON; SELECT p.Id AS pid, p.Name AS pname, d.Id AS did, d.Name AS dname,
     (SELECT n.Id AS id, n.Name AS name FROM data.Neighborhoods n WHERE n.DistrictId = d.Id FOR JSON PATH) AS hoods
   FROM data.Provinces p JOIN data.Districts d ON d.ProvinceId = p.Id FOR JSON PATH`]);
const areaRaw = fs.readFileSync(areaFile, 'utf16le').replace(/\r?\n/g, '');
const areaJson = areaRaw.slice(areaRaw.indexOf('['), areaRaw.lastIndexOf(']') + 1); // başlık satırlarını at
const districts = JSON.parse(areaJson).map((d) => ({ ...d, hoods: Array.isArray(d.hoods) ? d.hoods : JSON.parse(d.hoods ?? '[]'), key: norm(d.dname), pkey: norm(d.pname) }));

function match(addr) {
  const province = norm(addr.province ?? addr.state);
  const dName = addr.town ?? addr.city_district ?? addr.county ?? addr.municipality ?? addr.city;
  const inProvince = districts.filter((d) => d.pkey === province);
  let d = inProvince.find((x) => x.key === norm(dName));
  let review = false;
  if (!d) return null;
  const hoodName = norm(addr.suburb ?? addr.quarter ?? addr.neighbourhood ?? addr.village);
  let h = d.hoods.find((x) => norm(x.name) === hoodName)
       ?? d.hoods.find((x) => hoodName && (norm(x.name).includes(hoodName) || hoodName.includes(norm(x.name))));
  if (!h) { h = [...d.hoods].sort((a, b) => a.name.localeCompare(b.name, 'tr'))[0]; review = true; }
  return { pid: d.pid, did: d.did, hid: h.id, review };
}

// Erkek mi kadın mı? Belirsizse "erkek" + kontrol bekliyor
// Türkiye'de tabelada yalnızca "Kuaför" yazıyorsa genellikle kadın kuaförüdür.
function segmentOf(t) {
  const s = `${t.name ?? ''} ${t.hairdresser ?? ''} ${t.description ?? ''}`.toLocaleLowerCase('tr-TR');
  if (t.hairdresser === 'male' || /berber|barber|erkek|\bbay\b|men'?s|gentle|\bmen\b/.test(s)) return { seg: 'erkek', sure: true };
  if (t.shop === 'beauty' || t.hairdresser === 'female' || /bayan|kadın|kadin|güzellik|guzellik|beauty|nail|tırnak|lady|women|gelin|makyaj|estetik/.test(s))
    return { seg: 'kadin', sure: true };
  if (/kuaf[öo]r|coiffure|hair/.test(s)) return { seg: 'kadin', sure: false };   // "X Kuaför" → büyük ihtimalle kadın
  return { seg: 'erkek', sure: false };
}

const q = (v) => (v == null ? 'NULL' : `N'${String(v).replace(/'/g, "''").slice(0, 120)}'`);

const els = (await overpass()).filter((e) => e.tags?.name);
console.log(`OpenStreetMap: ${els.length} isimli berber/kuaför bulundu (${bbox}). Adresler çözülüyor…`);
const lines = ['SET NOCOUNT ON;', 'DECLARE @r TABLE (Result varchar(10));'];
let skipped = 0, review = 0, i = 0;
for (const e of els) {
  i++;
  const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
  if (lat == null || lon == null || lat < 35.5 || lat > 42.5 || lon < 25.5 || lon > 45) { skipped++; continue; }
  const a = await reverse(lat, lon);
  const m = match(a);
  if (!m) { skipped++; continue; }
  const { seg, sure } = segmentOf(e.tags);
  const needsReview = m.review || !sure;
  if (needsReview) review++;
  const t = e.tags;
  lines.push(`INSERT @r EXEC data.usp_ImportOsmShop '${`osm:${e.type}/${e.id}`}', '${seg}', ${q(t.name.trim())}, ${q(t.phone ?? t['contact:phone'] ?? null)}, ` +
    `${m.pid}, ${m.did}, ${m.hid}, ${q(t['addr:street'] ?? a.road ?? null)}, ${q(t['addr:housenumber'] ?? a.house_number ?? null)}, ` +
    `${lat.toFixed(6)}, ${lon.toFixed(6)}, ${needsReview ? 1 : 0};`);
  if (i % 20 === 0) process.stdout.write(`  ${i}/${els.length}\n`);
}
lines.push(`SELECT Result, COUNT(*) AS Adet FROM @r GROUP BY Result;`);
const tmp = path.join(os.tmpdir(), `bermatik-osm-${process.pid}.sql`);
fs.writeFileSync(tmp, lines.join('\n'), 'utf8');
try {
  console.log(sqlcmd(['-W', '-i', tmp]).trim());
} finally {
  fs.rmSync(tmp, { force: true });
}
console.log(`Tamam. Atlanan (adres bulunamadı): ${skipped}. Admin'in kontrol etmesi gereken: ${review}.`);
