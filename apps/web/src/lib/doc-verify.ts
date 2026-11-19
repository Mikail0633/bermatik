import "server-only";
import { createHmac } from "node:crypto";
import { deletePrivateFile, savePrivateFile } from "./uploads";

// İşletme / sahiplik belgesi doğrulaması:
//  1) Belge numarası türüne göre kontrol edilir (T.C. kimlik ve vergi numarasında resmî kontrol haneleri).
//  2) Kimlikte T.C. no + ad + soyad + doğum yılı Nüfus ve Vatandaşlık İşleri (NVİ) servisine sorulur.
//  3) Numara AÇIK saklanmaz: gizli anahtarlı özeti (aynı belge iki hesapta kullanılmasın diye) + maskeli hali saklanır.
//  4) Dosyanın SHA-256 özeti de saklanır (aynı fotoğraf başka hesapta kullanılamaz).

export const DOC_KINDS = ["vergi_levhasi", "esnaf_kaydi", "ruhsat", "kimlik", "diger"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export type NviResult = "dogru" | "yanlis" | "hata";

/** T.C. kimlik numarası: 11 hane, ilk hane 0 değil, 10. ve 11. hane kontrol haneleri */
export function isValidTckn(s: string) {
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const d = [...s].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  if ((((odd * 7 - even) % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

/** Vergi kimlik numarası (tüzel kişi / şirket): 10 hane, son hane GİB kontrol hanesi */
export function isValidVkn(s: string) {
  if (!/^\d{10}$/.test(s)) return false;
  const d = [...s].map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const t = (d[i] + 9 - i) % 10;
    let v = (t * 2 ** (9 - i)) % 9;
    if (t !== 0 && v === 0) v = 9;
    sum += v;
  }
  return (10 - (sum % 10)) % 10 === d[9];
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");
const normCode = (s: string) => s.toLocaleUpperCase("tr-TR").replace(/[\s.\-_/]/g, "");

/** Türe göre belge numarasını kontrol eder; normal hali (özet için) ya da hata döner */
export function checkDocNumber(kind: DocKind, raw: string): { value?: string; error?: string } {
  const s = raw.trim();
  if (!s) return { error: "Belgedeki numarayı yazın." };
  switch (kind) {
    case "kimlik": {
      const n = onlyDigits(s);
      return isValidTckn(n) ? { value: n } : { error: "T.C. kimlik numarası geçersiz. 11 haneyi kontrol edin." };
    }
    case "vergi_levhasi": {
      // Şirketlerde 10 haneli vergi numarası, şahıs işletmelerinde 11 haneli T.C. kimlik numarası yazar
      const n = onlyDigits(s);
      if (n.length === 10) return isValidVkn(n) ? { value: n } : { error: "Vergi numarası geçersiz. Levhadaki 10 haneyi kontrol edin." };
      if (n.length === 11) return isValidTckn(n) ? { value: n } : { error: "Levhadaki T.C. kimlik numarası geçersiz." };
      return { error: "Vergi numarası 10 hane (şirket) ya da 11 hane (şahıs, T.C. no) olmalı." };
    }
    default: {
      const n = normCode(s);
      if (!/^[0-9A-ZÇĞİÖŞÜ]{3,30}$/.test(n)) return { error: "Belge numarası 3-30 harf/rakam olmalı." };
      return { value: n };
    }
  }
}

/** Gizli anahtarlı özet. DOC_HASH_SECRET ASLA değiştirilmemeli: değişirse eski belgelerle karşılaştırma bozulur. */
export function docNumberHash(kind: DocKind, value: string) {
  const secret = process.env.DOC_HASH_SECRET;
  if (!secret) throw new Error("DOC_HASH_SECRET tanımlı değil (.env.local)");
  // Vergi levhasındaki 11 haneli numara bir T.C. no'dur; kimlikle aynı grupta özetlenir
  const group = kind === "kimlik" || (kind === "vergi_levhasi" && value.length === 11) ? "tckn" : kind;
  return createHmac("sha256", secret).update(`${group}:${value}`).digest();
}

export function maskDocNumber(value: string) {
  if (value.length <= 4) return "*".repeat(value.length);
  const keep = value.length >= 10 ? 2 : 1;
  return value.slice(0, keep + 1) + "*".repeat(value.length - 2 * keep - 1) + value.slice(-keep);
}

const upperTr = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");

/** NVİ T.C. kimlik doğrulama (ücretsiz, herkese açık servis). Cevap gelmezse "hata". */
export async function nviVerify(tckn: string, firstName: string, lastName: string, birthYear: number): Promise<NviResult> {
  const esc = (s: string) => s.replace(/[<>&'"]/g, "");
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><TCKimlikNoDogrula xmlns="http://tckimlik.nvi.gov.tr/WS"><TCKimlikNo>${tckn}</TCKimlikNo><Ad>${esc(upperTr(firstName))}</Ad><Soyad>${esc(upperTr(lastName))}</Soyad><DogumYili>${birthYear}</DogumYili></TCKimlikNoDogrula></soap:Body></soap:Envelope>`;
  try {
    const r = await fetch("https://tckimlik.nvi.gov.tr/Service/KPSPublic.asmx", {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '"http://tckimlik.nvi.gov.tr/WS/TCKimlikNoDogrula"' },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const m = /<TCKimlikNoDogrulaResult>(true|false)<\/TCKimlikNoDogrulaResult>/.exec(await r.text());
    if (!m) return "hata";
    return m[1] === "true" ? "dogru" : "yanlis";
  } catch (e) {
    console.error("NVİ kimlik doğrulama servisine ulaşılamadı:", e instanceof Error ? e.message : e);
    return "hata";
  }
}

export type VerifiedDoc = {
  Kind: DocKind; FilePath: string; NumberHash: Buffer; NumberMasked: string; FileHash: Buffer; NviResult: NviResult | null;
};

/**
 * Formdaki belgeyi (kind, number, file) kontrol eder, dosyayı gizli klasöre kaydeder.
 * Hata olursa kaydedilen dosya silinir. Başarılıysa OwnerDocument_Add parametreleri döner;
 * çağıran veritabanı hatasında `discard()` ile dosyayı silmeli.
 */
export async function verifyDocumentForm(
  form: FormData,
  person: { firstName: string; lastName: string; birthYear: number | null },
): Promise<{ doc?: VerifiedDoc; error?: string; discard: () => Promise<void> }> {
  const none = async () => {};
  const kind = String(form.get("kind") ?? "") as DocKind;
  if (!DOC_KINDS.includes(kind)) return { error: "Belge türünü seçin.", discard: none };
  const num = checkDocNumber(kind, String(form.get("docNumber") ?? ""));
  if (num.error) return { error: num.error, discard: none };
  if (kind === "kimlik" && !person.birthYear) return { error: "Kimlik doğrulaması için doğum yılınızı yazın.", discard: none };

  const saved = await savePrivateFile(form.get("file") as File, "dogrulama");
  if (saved.error || !saved.path) return { error: saved.error ?? "Dosya kaydedilemedi.", discard: none };
  const discard = () => deletePrivateFile(saved.path);

  let nvi: NviResult | null = null;
  if (kind === "kimlik") {
    nvi = await nviVerify(num.value!, person.firstName, person.lastName, person.birthYear!);
    if (nvi === "yanlis") {
      await discard();
      return { error: "Kimlik bilgileri nüfus kayıtlarıyla eşleşmedi. Ad, soyad, doğum yılı ve T.C. numarasının kimliğinizdekiyle aynı olduğunu kontrol edin.", discard: none };
    }
  }
  return {
    doc: {
      Kind: kind, FilePath: saved.path, NumberHash: docNumberHash(kind, num.value!), NumberMasked: maskDocNumber(num.value!),
      FileHash: saved.hash!, NviResult: nvi,
    },
    discard,
  };
}
