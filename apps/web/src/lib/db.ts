import "server-only";
import sql from "mssql";

// Site veritabanına yalnızca "bermatik_app" kullanıcısıyla bağlanır; bu kullanıcı
// sadece api.* işlemlerini çalıştırabilir (tablolara doğrudan erişimi yoktur).
const config: sql.config = {
  server: process.env.DB_SERVER ?? "localhost",
  port: Number(process.env.DB_PORT ?? 1433),
  database: process.env.DB_NAME ?? "Bermatik",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Yerel SQL Server kendi imzalı sertifika kullanır: geliştirmede ya da DB_TRUST_SERVER_CERT=true ise kabul edilir
  options: { encrypt: true, trustServerCertificate: process.env.NODE_ENV !== "production" || process.env.DB_TRUST_SERVER_CERT === "true" },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
};

// Geliştirmede sayfa her yenilendiğinde yeni bağlantı havuzu açılmasın
const globalForDb = globalThis as unknown as { bermatikPool?: Promise<sql.ConnectionPool> };
function pool() {
  globalForDb.bermatikPool ??= new sql.ConnectionPool(config).connect().catch((e) => {
    globalForDb.bermatikPool = undefined;
    throw e;
  });
  return globalForDb.bermatikPool;
}

/** Veritabanındaki işlemlerin attığı Türkçe hata (50400 → 400, 50403 → 403 ...). */
export class AppError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Param = string | number | boolean | Date | Buffer | null | undefined;

function bind(req: sql.Request, name: string, value: Param) {
  if (value === undefined) return;
  if (value === null) req.input(name, sql.NVarChar, null);
  else if (Buffer.isBuffer(value)) req.input(name, sql.VarBinary, value);
  else if (typeof value === "number") req.input(name, Number.isInteger(value) ? sql.Int : sql.Float, value);
  else if (typeof value === "boolean") req.input(name, sql.Bit, value);
  else if (value instanceof Date) req.input(name, sql.DateTime2, value);
  else req.input(name, sql.NVarChar, value);
}

/** api.* işlemini çalıştırır, ilk sonuç tablosunu döner. */
export async function call<T = Record<string, unknown>>(proc: `api.${string}`, params: Record<string, Param> = {}): Promise<T[]> {
  const req = (await pool()).request();
  for (const [k, v] of Object.entries(params)) bind(req, k, v);
  try {
    const res = await req.execute<T>(proc);
    return (res.recordset ?? []) as T[];
  } catch (e) {
    const err = e as { number?: number; message: string };
    if (err.number && err.number >= 50400 && err.number < 50500) throw new AppError(err.message, err.number - 50000);
    throw e;
  }
}

/** Tek satır dönen işlemler için. */
export async function callOne<T = Record<string, unknown>>(proc: `api.${string}`, params: Record<string, Param> = {}) {
  return (await call<T>(proc, params))[0] as T | undefined;
}
