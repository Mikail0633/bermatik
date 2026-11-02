import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Gizli dosyalar (doğrulama belgeleri) herkese açık klasörde DEĞİL, apps/web/storage altında durur;
// yalnızca yetkili kişiye /api/belge/... üzerinden gösterilir.
const ROOT = path.join(process.cwd(), "storage");
const MAX_BYTES = 8 * 1024 * 1024;

// Dosyanın gerçek türü ilk baytlarından anlaşılır (uzantıya güvenilmez)
function sniff(b: Buffer): { ext: string; type: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", type: "image/png" };
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return { ext: "webp", type: "image/webp" };
  if (b.subarray(0, 5).toString() === "%PDF-") return { ext: "pdf", type: "application/pdf" };
  return null;
}

export async function savePrivateFile(file: File, folder: "dogrulama" | "ustalik"): Promise<{ path?: string; error?: string }> {
  if (!file || file.size === 0) return { error: "Bir dosya seçin." };
  if (file.size > MAX_BYTES) return { error: "Dosya en fazla 8 MB olabilir." };
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) return { error: "Yalnızca fotoğraf (JPG, PNG, WEBP) veya PDF yükleyebilirsiniz." };
  const rel = `${folder}/${randomUUID()}.${kind.ext}`;
  await mkdir(path.join(ROOT, folder), { recursive: true });
  await writeFile(path.join(ROOT, rel), buf);
  return { path: rel };
}

// ---------------------------------------------------------------------
// Herkese açık fotoğraflar (kapak, galeri, personel): storage/foto altında,
// /uploads/foto/... adresinden sunulur. Her fotoğraf en fazla 1600 px'e küçültülür,
// WEBP'ye çevrilir; içindeki konum (GPS) ve cihaz bilgileri silinir.
// ---------------------------------------------------------------------
const PHOTO_DIR = "foto";

export async function savePublicPhoto(file: File | null): Promise<{ path?: string; error?: string }> {
  if (!file || file.size === 0) return { error: "Bir fotoğraf seçin." };
  if (file.size > MAX_BYTES) return { error: "Fotoğraf en fazla 8 MB olabilir." };
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind || kind.ext === "pdf") return { error: "Yalnızca fotoğraf (JPG, PNG, WEBP) yükleyebilirsiniz." };
  let out: Buffer;
  try {
    const sharp = (await import("sharp")).default;
    out = await sharp(buf, { limitInputPixels: 40_000_000 })
      .rotate() // telefonun çevirme bilgisine göre düzelt (sonra bilgi silinir)
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { error: "Fotoğraf okunamadı. Başka bir fotoğraf deneyin." };
  }
  const rel = `${PHOTO_DIR}/${randomUUID()}.webp`;
  await mkdir(path.join(ROOT, PHOTO_DIR), { recursive: true });
  await writeFile(path.join(ROOT, rel), out);
  return { path: rel };
}

const PHOTO_RE = /^foto\/[0-9a-f-]{36}\.webp$/;

export async function readPublicPhoto(rel: string): Promise<Buffer | null> {
  if (!PHOTO_RE.test(rel)) return null;
  try {
    return await readFile(path.join(ROOT, rel));
  } catch {
    return null;
  }
}

/** Artık kullanılmayan fotoğrafı diskten siler (yoksa sessizce geçer). */
export async function deletePublicPhoto(rel: string | null | undefined) {
  if (!rel || !PHOTO_RE.test(rel)) return;
  await unlink(path.join(ROOT, rel)).catch(() => {});
}

export async function readPrivateFile(rel: string): Promise<{ data: Buffer; type: string } | null> {
  // Yol kaçışını engelle: yalnızca storage altındaki dosyalar
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT + path.sep)) return null;
  try {
    const data = await readFile(full);
    const kind = sniff(data);
    return kind ? { data, type: kind.type } : null;
  } catch {
    return null;
  }
}

/** Kaydedilmiş gizli dosyayı siler (ör. veritabanı kaydı reddedildiyse). */
export async function deletePrivateFile(rel: string | null | undefined) {
  if (!rel || !/^(dogrulama|ustalik)\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(rel)) return;
  await unlink(path.join(ROOT, rel)).catch(() => {});
}
