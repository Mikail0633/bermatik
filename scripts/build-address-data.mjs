// Türkiye il/ilçe/mahalle verisini (siberfx/turkiye-il-ilce-mahalle, MIT lisansı)
// database/migrations/0002_address_data.sql dosyasına çevirir.
//
// Kullanım: node scripts/build-address-data.mjs <cities.sql/districts.sql/neighborhoods.sql klasörü>
import fs from 'node:fs';
import path from 'node:path';

const srcDir = process.argv[2];
if (!srcDir) {
  console.error('Kaynak klasörü verin: node scripts/build-address-data.mjs <klasör>');
  process.exit(1);
}
const outFile = path.resolve(import.meta.dirname, '..', 'database', 'migrations', '0002_address_data.sql');

const parse = (file, cols) => {
  const re = cols === 2 ? /^\('(\d+)','(.*)'\)[,;]?\s*$/ : /^\('(\d+)','(\d+)','(.*)'\)[,;]?\s*$/;
  return fs.readFileSync(path.join(srcDir, file), 'utf8').split(/\r?\n/)
    .filter((line) => line.startsWith("('"))
    .map((line) => {
      const m = line.match(re);
      if (!m) throw new Error(`Ayrıştırılamadı: ${file}: ${line}`);
      return cols === 2 ? [Number(m[1]), m[2]] : [Number(m[1]), Number(m[2]), m[3]];
    });
};

// "AHMET REMZİ YÜREĞİR MAHALLESİ" → "Ahmet Remzi Yüreğir Mahallesi"
const title = (s) =>
  s.replace(/\\(.)/g, '$1').trim().replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR')
    .replace(/(^|[\s(\-./,])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('tr-TR'));
const lit = (s) => `N'${s.replace(/'/g, "''")}'`;
// "Kadıköy" → "kadikoy" (Google için sayfa adresi)
const slug = (s) =>
  s.toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const cities = parse('cities.sql', 2).map(([id, n]) => [id, title(n)]);
const districts = parse('districts.sql', 3).map(([id, pid, n]) => [id, pid, title(n)]);
if (cities.length !== 81) throw new Error('81 il bekleniyordu');

const districtIds = new Set(districts.map((d) => d[0]));
const seen = new Set();
const hoods = [];
for (const [id, did, raw] of parse('neighborhoods.sql', 3)) {
  const name = title(raw);
  const key = `${did}|${name}`;
  if (!districtIds.has(did) || seen.has(key)) continue; // ilçesi olmayan veya tekrar eden kayıt
  seen.add(key);
  hoods.push([id, did, name]);
}

const batches = (table, cols, rows, fmt) => {
  let sql = '';
  for (let i = 0; i < rows.length; i += 1000) {
    sql += `INSERT INTO ${table} (${cols}) VALUES\n${rows.slice(i, i + 1000).map(fmt).join(',\n')};\nGO\n`;
  }
  return sql;
};

const out = `-- =====================================================================
-- Bermatik — Türkiye il / ilçe / mahalle verisi
-- Kaynak: github.com/siberfx/turkiye-il-ilce-mahalle (MIT lisansı)
-- ${cities.length} il, ${districts.length} ilçe, ${hoods.length} mahalle/köy
-- Bu dosya scripts/build-address-data.mjs ile üretilir, elle düzenlemeyin.
-- =====================================================================

${batches('data.Provinces', 'Id, Name, Slug', cities, ([id, n]) => `(${id},${lit(n)},'${slug(n)}')`)}
${batches('data.Districts', 'Id, ProvinceId, Name, Slug', districts, ([id, pid, n]) => `(${id},${pid},${lit(n)},'${slug(n)}')`)}
${batches('data.Neighborhoods', 'Id, DistrictId, Name', hoods, ([id, did, n]) => `(${id},${did},${lit(n)})`)}`;

fs.writeFileSync(outFile, out);
console.log(`${cities.length} il, ${districts.length} ilçe, ${hoods.length} mahalle/köy → ${outFile}`);
console.log('En uzun mahalle adı:', Math.max(...hoods.map((h) => h[2].length)), 'karakter');
