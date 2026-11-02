// Bermatik — SQL Server veritabanı kurulumu / güncellemesi
//   database/migrations/*.sql  → tablolar ve veri; her dosya bir kez yüklenir (dbo.SchemaMigrations'a kaydedilir)
//   database/procedures/*.sql  → işlemler; her çalıştırmada yeniden yüklenir (CREATE OR ALTER)
//   database/security.sql      → yetkiler; her çalıştırmada yeniden uygulanır
//   database/settings.sql      → veritabanı ayarları (kurtarma modu, kilitlenme); her çalıştırmada
//
// Kullanım:
//   npm run db:setup                       → Bermatik veritabanını kur/güncelle
//   npm run db:setup -- --db BermatikTest  → başka bir veritabanı
//   npm run db:setup -- --db BermatikTest --reset  → önce sil, sonra sıfırdan kur (yalnızca *Test adlı veritabanlarında)
//
// Windows oturumunuzla (sqlcmd -E) localhost'taki SQL Server'a bağlanır.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const db = opt('--db', 'Bermatik');
const server = opt('--server', 'localhost');
const reset = args.includes('--reset');
if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(db)) throw new Error(`Geçersiz veritabanı adı: ${db}`);
if (reset && !db.endsWith('Test')) {
  console.error('--reset yalnızca adı "Test" ile biten veritabanlarında kullanılabilir.');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '..', 'database');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bermatik-db-'));

// -b: hatada dur, -I: QUOTED_IDENTIFIER ON, -f 65001: UTF-8 (Türkçe karakterler), -C: yerel sertifikaya güven
const sqlcmd = (database, input, { file = false, quiet = false } = {}) => {
  const a = ['-S', server, '-E', '-C', '-b', '-I', '-f', '65001', '-d', database, '-h', '-1', '-W'];
  a.push(file ? '-i' : '-Q', input);
  try {
    return execFileSync('sqlcmd', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    if (!quiet) console.error((e.stdout || '') + (e.stderr || ''));
    throw new Error('sqlcmd başarısız oldu');
  }
};
const runFile = (database, content, name) => {
  const f = path.join(tmpDir, name.replace(/[\\/]/g, '_'));
  fs.writeFileSync(f, content, 'utf8');
  return sqlcmd(database, f, { file: true });
};

try {
  if (reset) {
    console.log(`"${db}" siliniyor...`);
    sqlcmd('master', `IF DB_ID('${db}') IS NOT NULL BEGIN ALTER DATABASE [${db}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${db}]; END`);
  }
  sqlcmd('master', `IF DB_ID('${db}') IS NULL CREATE DATABASE [${db}] COLLATE Turkish_CI_AS`);
  runFile(db, fs.readFileSync(path.join(root, 'settings.sql'), 'utf8'), 'settings.sql');
  sqlcmd(db, `IF OBJECT_ID('dbo.SchemaMigrations') IS NULL
    CREATE TABLE dbo.SchemaMigrations (Version varchar(20) NOT NULL PRIMARY KEY, Name nvarchar(200) NOT NULL,
      AppliedAt datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME())`);
  const applied = new Set(sqlcmd(db, 'SET NOCOUNT ON; SELECT Version FROM dbo.SchemaMigrations').split(/\r?\n/).map((s) => s.trim()).filter(Boolean));

  console.log(`Veritabanı: ${db} (${server})`);
  const migDir = path.join(root, 'migrations');
  for (const f of fs.readdirSync(migDir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort()) {
    const [version, ...rest] = f.replace(/\.sql$/, '').split('_');
    if (applied.has(version)) { console.log(`  ✓ ${f} (zaten yüklü)`); continue; }
    process.stdout.write(`  … ${f} `);
    // Dosyanın tamamı tek işlem: hata olursa hiçbir değişiklik kalmaz
    const body = fs.readFileSync(path.join(migDir, f), 'utf8');
    runFile(db, `SET XACT_ABORT ON;\nBEGIN TRAN;\nGO\n${body}\nGO\nINSERT INTO dbo.SchemaMigrations (Version, Name) VALUES ('${version}', N'${rest.join('_')}');\nCOMMIT;\nGO\n`, f);
    console.log('yüklendi');
  }

  const procDir = path.join(root, 'procedures');
  for (const f of fs.readdirSync(procDir).filter((f) => f.endsWith('.sql')).sort()) {
    runFile(db, fs.readFileSync(path.join(procDir, f), 'utf8'), f);
    console.log(`  ✓ procedures/${f}`);
  }
  runFile(db, fs.readFileSync(path.join(root, 'security.sql'), 'utf8'), 'security.sql');
  console.log('  ✓ security.sql');

  if (args.includes('--test')) {
    if (!db.endsWith('Test')) throw new Error('Testler yalnızca adı "Test" ile biten veritabanında çalışır.');
    console.log('\nTestler:');
    try {
      console.log(runFile(db, fs.readFileSync(path.join(root, 'tests', 'run-tests.sql'), 'utf8'), 'run-tests.sql').trimEnd());
    } catch (e) {
      throw new Error('Testler başarısız');
    }
  }
  console.log('\nTamam.');
} catch (e) {
  console.error(`\nKurulum durdu: ${e.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
