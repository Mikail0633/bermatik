// Bermatik — Türkiye geneli açık veriden berber/kuaför aktarımı ("henüz katılmadı" dükkânlar)
//
// Kaynaklar (scripts/.cache/acik-veri/ altında):
//   osm-*.json          OpenStreetMap (Overpass) shop=hairdresser|beauty     — ODbL, © OpenStreetMap katkıcıları
//   overture-tr.json    Overture Maps places (berber/kuaför/güzellik)       — CDLA-Permissive-2.0
//   tur-ADM1/ADM2.geojson  il/ilçe sınırları (geoBoundaries, CC BY 4.0)    — hangi il/ilçede olduğunu bulmak için
//   tr-places.json      OpenStreetMap mahalle/köy noktaları                 — mahalleyi bulmak için
//
// Kullanım:
//   node scripts/import-places.mjs                    → BermatikDev
//   node scripts/import-places.mjs --db Bermatik      → asıl veritabanı
//   node scripts/import-places.mjs --dry              → veritabanına yazmadan say
//
// Tekrar çalıştırılabilir: aynı kayıt (ExternalRef) ikinci kez eklenmez, sahiplenilmemişse güncellenir.
// Aynı dükkân iki kaynakta da varsa (60 m içinde, benzer ad) yalnızca biri eklenir; sitede zaten olan
// (berberin kendi eklediği / admin'in eklediği) dükkânların yanına kopya eklenmez.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const db = opt('--db', 'BermatikDev');
const dry = args.includes('--dry');
const dir = path.resolve(import.meta.dirname, '.cache', 'acik-veri');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const sqlcmd = (a) => execFileSync('sqlcmd', ['-S', 'localhost', '-E', '-C', '-b', '-I', '-f', '65001', '-d', db, ...a], { encoding: 'utf8', maxBuffer: 256 << 20 });

// ---------- Yardımcılar ----------
const norm = (s) => (s ?? '').toLocaleLowerCase('tr-TR').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
  .replace(/\s+(mahallesi|mah\.?|mh\.?|köyü|beldesi)$/u, '').replace(/[^a-zçğıöşü0-9]/gu, '');
const nameKey = (s) => norm(s).replace(/(berber|kuafor|kuaför|salonu|salon|barber|erkek|bayan|guzellik|güzellik|merkezi|studio|stüdyo|hair|beauty)/g, '');
const similar = (a, b) => { const x = nameKey(a), y = nameKey(b); return !x || !y || x === y || x.includes(y) || y.includes(x); };
const distM = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
};
// Yakındaki noktaları hızlı bulmak için ~1 km'lik ızgara
const grid = () => {
  const m = new Map(), k = (lat, lng) => `${Math.floor(lat * 100)}:${Math.floor(lng * 100)}`;
  return {
    add: (p) => { const key = k(p.lat, p.lng); (m.get(key) ?? m.set(key, []).get(key)).push(p); },
    near: (p) => { const out = []; const a = Math.floor(p.lat * 100), b = Math.floor(p.lng * 100);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(m.get(`${a + i}:${b + j}`) ?? [])); return out; },
  };
};

// ---------- İl / ilçe sınırları ----------
const inRing = (x, y, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const polys = (f) => {
  const g = f.geometry, list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const pts = list.flatMap((p) => p[0]);
  return { name: f.properties.shapeName, list, minx: Math.min(...pts.map((p) => p[0])), maxx: Math.max(...pts.map((p) => p[0])),
           miny: Math.min(...pts.map((p) => p[1])), maxy: Math.max(...pts.map((p) => p[1])) };
};
const contains = (b, x, y) => x >= b.minx && x <= b.maxx && y >= b.miny && y <= b.maxy && b.list.some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)));
const adm1 = readJson('tur-ADM1.geojson').features.map(polys);
const adm2 = readJson('tur-ADM2.geojson').features.map(polys);
const provinceAt = (lat, lng) => adm1.find((b) => contains(b, lng, lat))?.name;
const districtsAt = (lat, lng) => adm2.filter((b) => contains(b, lng, lat)).map((b) => b.name);

// ---------- Veritabanındaki il / ilçe / mahalle listesi ----------
const areaFile = path.join(os.tmpdir(), `bermatik-areas-${process.pid}.json`);
execFileSync('sqlcmd', ['-S', 'localhost', '-E', '-C', '-b', '-d', db, '-u', '-y', '0', '-o', areaFile, '-Q',
  `SET NOCOUNT ON; SELECT p.Id AS pid, p.Name AS pname, d.Id AS did, d.Name AS dname,
     (SELECT n.Id AS id, n.Name AS name FROM data.Neighborhoods n WHERE n.DistrictId = d.Id FOR JSON PATH) AS hoods
   FROM data.Provinces p JOIN data.Districts d ON d.ProvinceId = p.Id FOR JSON PATH`]);
const areaRaw = fs.readFileSync(areaFile, 'utf16le').replace(/\r?\n/g, '');
fs.rmSync(areaFile, { force: true });
const districts = JSON.parse(areaRaw.slice(areaRaw.indexOf('['), areaRaw.lastIndexOf(']') + 1))
  .map((d) => ({ ...d, hoods: Array.isArray(d.hoods) ? d.hoods : JSON.parse(d.hoods ?? '[]') }));
const byProv = new Map();
for (const d of districts) (byProv.get(norm(d.pname)) ?? byProv.set(norm(d.pname), []).get(norm(d.pname))).push(d);

// Sınır dosyasındaki ilçe adı → veritabanındaki ad.
// Merkez ilçeler orada "Adıyaman merkez", "Kilis (merkez)", "Giresun District" gibi yazılmış; bizde "Merkez".
const ALIAS = { imbros: 'Gökçeada', princeislands: 'Adalar', ayvacik: 'Ayvacık', ulukisla: 'Ulukışla', karakeçeli: 'Karakeçili', ibradi: 'İbradı', ılıç: 'İliç', gedizmerkez: 'Gediz' };
function dbDistrictName(adm2, province) {
  const a = ALIAS[norm(adm2)];
  if (a) return a;
  const k = norm(adm2.replace(/\((merkez[^)]*)\)|\bmerkezi?\b|\bdistrict\b|merkez ilçe/giu, ''));
  return !k || k === norm(province) ? 'Merkez' : adm2;
}
function findDistrict(lat, lng) {
  const pName = provinceAt(lat, lng);
  if (!pName) return null;
  const list = byProv.get(norm(pName));
  if (!list) return null;
  for (const dn of districtsAt(lat, lng)) {
    const k = norm(dbDistrictName(dn, pName));
    const d = list.find((x) => norm(x.dname) === k);
    if (d) return d;
  }
  return null;
}

// ---------- Mahalle noktaları (ilçeye göre, adı veritabanındaki bir mahalleyle eşleşenler) ----------
const placePts = readJson('tr-places.json').elements.filter((e) => e.tags?.name);
const hoodPts = new Map();   // did → [{lat,lng,hid}]
for (const e of placePts) {
  const d = findDistrict(e.lat, e.lon);
  if (!d) continue;
  const k = norm(e.tags.name);
  const h = d.hoods.find((x) => norm(x.name) === k);
  if (h) (hoodPts.get(d.did) ?? hoodPts.set(d.did, []).get(d.did)).push({ lat: e.lat, lng: e.lon, hid: h.id });
}
function findHood(d, p) {
  const pts = hoodPts.get(d.did) ?? [];
  let best = null, bd = Infinity;
  for (const q of pts) { const x = distM(p, q); if (x < bd) { bd = x; best = q; } }
  if (best && bd < 6000) return { hid: best.hid, sure: bd < 2500 };
  return { hid: [...d.hoods].sort((a, b) => a.name.localeCompare(b.name, 'tr'))[0]?.id, sure: false };
}

// ---------- Erkek mi kadın mı? ----------
function segmentOf(name, kind) {
  const s = (name ?? '').toLocaleLowerCase('tr-TR');
  if (/berber|barber|erkek|\bbay\b|men'?s|gentle|\bmen\b|tıraş|traş|tiras|tras|beard|sakal/.test(s)) return { seg: 'erkek', sure: true };
  if (/bayan|kadın|kadin|güzellik|guzellik|beauty|nail|tırnak|lady|women|gelin|makyaj|estetik|kirpik|epilasyon|ağda|cilt|spa\b|manikür|protez/.test(s)) return { seg: 'kadin', sure: true };
  if (kind === 'barber' || kind === 'male') return { seg: 'erkek', sure: true };
  if (kind === 'female' || (kind && !['hair_salon', 'hair_stylist', 'hairdresser'].includes(kind))) return { seg: 'kadin', sure: true };
  return { seg: /kuaf[öo]r|coiffure|hair|saç/.test(s) ? 'kadin' : 'erkek', sure: false };   // "X Kuaför" → büyük ihtimalle kadın
}

// ---------- Kaynakları ortak biçime çevir ----------
const OVT_KEEP = new Set(['barber', 'hair_salon', 'hair_stylist', 'beauty_salon', 'nail_salon', 'waxing', 'hair_removal', 'laser_hair_removal', 'makeup_artist', 'skin_care_and_makeup']);
const osm = fs.readdirSync(dir).filter((f) => /^osm-\d+\.json$/.test(f)).flatMap((f) => readJson(f).elements)
  .filter((e) => e.tags?.name && (e.lat ?? e.center?.lat) != null)
  .map((e) => ({
    ref: `osm:${e.type}/${e.id}`, source: 'osm', name: e.tags.name, lat: e.lat ?? e.center.lat, lng: e.lon ?? e.center.lon,
    phone: e.tags.phone ?? e.tags['contact:phone'] ?? null, street: e.tags['addr:street'] ?? null, no: e.tags['addr:housenumber'] ?? null,
    kind: e.tags.shop === 'beauty' ? 'beauty_salon' : e.tags.hairdresser ?? 'hairdresser',
  }));
const overture = readJson('overture-tr.json')
  .filter((r) => OVT_KEEP.has(r.primary) && r.status !== 'permanently_closed' && r.name)
  .map((r) => {
    const free = r.address?.freeform ?? null;
    const m = free?.match(/^(.*?)(?:,?\s*(?:no|numara)\s*:?\s*([0-9]+[a-z]?(?:\/[0-9a-z]+)?))?\s*$/i);
    return { ref: `ovt:${r.id}`, source: 'overture', name: r.name, lat: r.lat, lng: r.lng, phone: r.phone, street: m?.[1] || free, no: m?.[2] ?? null, kind: r.primary };
  });

// ---------- Sitede zaten olan dükkânlar (kopya eklememek için) ----------
const exFile = path.join(os.tmpdir(), `bermatik-shops-${process.pid}.json`);
execFileSync('sqlcmd', ['-S', 'localhost', '-E', '-C', '-b', '-d', db, '-u', '-y', '0', '-o', exFile, '-Q',
  'SET NOCOUNT ON; SELECT Name AS name, CAST(Latitude AS float) AS lat, CAST(Longitude AS float) AS lng, ExternalRef AS ref FROM data.Shops FOR JSON PATH']);
const exRaw = fs.readFileSync(exFile, 'utf16le').replace(/\r?\n/g, '');
fs.rmSync(exFile, { force: true });
const existing = exRaw.includes('[') ? JSON.parse(exRaw.slice(exRaw.indexOf('['), exRaw.lastIndexOf(']') + 1)) : [];
const existingRefs = new Set(existing.map((e) => e.ref).filter(Boolean));
const seen = grid();
for (const e of existing) if (!e.ref) seen.add(e);   // berber/admin eklemesi: yanına kopya eklenmez

// ---------- Eşleştir, ayıkla, SQL hazırla ----------
const q = (v, n = 120, min = 1) => { const t = v == null ? '' : String(v).trim().slice(0, n); return t.length < min ? 'NULL' : `N'${t.replace(/'/g, "''")}'`; };
const lines = ['SET NOCOUNT ON;', 'IF OBJECT_ID(\'tempdb..#r\') IS NOT NULL DROP TABLE #r;', 'CREATE TABLE #r (Result varchar(10), Seg varchar(5));', 'GO'];
const stat = { osm: 0, overture: 0, kopya: 0, ilceYok: 0, yurtdisi: 0, kontrol: 0, erkek: 0, kadin: 0 };
let n = 0;
for (const s of [...osm, ...overture]) {   // önce OpenStreetMap: ortak dükkânda OSM kaydı kalır
  if (s.name.trim().length < 2 || s.lat < 35.5 || s.lat > 42.5 || s.lng < 25.5 || s.lng > 45) continue;
  if (!existingRefs.has(s.ref) && seen.near(s).some((o) => distM(o, s) < 60 && similar(o.name, s.name))) { stat.kopya++; continue; }
  const d = findDistrict(s.lat, s.lng);
  if (!d || !d.hoods.length) { if (provinceAt(s.lat, s.lng)) { stat.ilceYok++; stat.ornek ??= []; if (stat.ornek.length < 8) stat.ornek.push(`${provinceAt(s.lat, s.lng)}/${districtsAt(s.lat, s.lng).join("|") || "?"}`); } else stat.yurtdisi++; continue; }
  seen.add(s);
  const h = findHood(d, s);
  const { seg, sure } = segmentOf(s.name, s.kind);
  const review = !sure || !h.sure;
  stat[s.source]++; stat[seg]++; if (review) stat.kontrol++;
  lines.push(`BEGIN TRY INSERT #r (Result) EXEC data.usp_ImportOsmShop '${s.ref}', '${seg}', ${q(s.name, 100)}, ${q(s.phone, 40)}, ${d.pid}, ${d.did}, ${h.hid}, ` +
    `${q(s.street, 120, 2)}, ${q(s.no, 20)}, ${s.lat.toFixed(6)}, ${s.lng.toFixed(6)}, ${review ? 1 : 0}, '${s.source}'; END TRY BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r (Result) VALUES ('hata'); END CATCH`);
  if (++n % 500 === 0) lines.push('GO');
}
lines.push('GO', 'SELECT Result, COUNT(*) AS Adet FROM #r GROUP BY Result;');
console.log(`Hazır: OpenStreetMap ${stat.osm} + Overture ${stat.overture} = ${stat.osm + stat.overture} dükkân (erkek ${stat.erkek}, kadın ${stat.kadin}).`);
console.log(`Ayıklanan kopya: ${stat.kopya}. Türkiye dışı (komşu ülke): ${stat.yurtdisi}. Türkiye içinde ilçesi bulunamayan: ${stat.ilceYok}${stat.ornek ? " (ör. " + stat.ornek.join(", ") + ")" : ""}. Admin kontrolüne düşecek (bölüm/mahalle tahmini): ${stat.kontrol}.`);
if (dry) process.exit(0);

const tmp = path.join(os.tmpdir(), `bermatik-places-${process.pid}.sql`);
fs.writeFileSync(tmp, lines.join('\n'), 'utf8');
try {
  console.log(`"${db}" veritabanına yazılıyor (birkaç dakika sürebilir)…`);
  console.log(sqlcmd(['-W', '-i', tmp]).trim());
} finally {
  fs.rmSync(tmp, { force: true });
}
console.log('Tamam.');
