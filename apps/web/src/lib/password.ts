// Şifre gücü: hem tarayıcıda (renkli çubuk) hem sunucuda (kabul/ret) aynı kural kullanılır.
// Kabul için: en az 8 karakter, çok bilinen bir şifre değil, kişinin adı/e-postası/telefonu değil,
// ve en az iki çeşit karakter (harf + rakam gibi) ya da en az 12 karakter.

// Türkiye'de ve dünyada en çok kullanılan şifrelerden (küçük harfe çevrilmiş, Türkçe harfler sadeleştirilmiş hâlde karşılaştırılır)
const COMMON = new Set([
  "12345678", "123456789", "1234567890", "12341234", "11111111", "00000000", "87654321", "11223344", "12121212", "123123123",
  "password", "password1", "password123", "passw0rd", "qwerty123", "qwertyui", "qwertyuiop", "asdfghjk", "zxcvbnm1", "1q2w3e4r",
  "1q2w3e4r5t", "q1w2e3r4", "abc12345", "abcd1234", "iloveyou", "sunshine", "princess", "football", "baseball", "superman",
  "sifre123", "sifre1234", "sifresifre", "parola123", "parola1234", "bermatik", "bermatik1", "bermatik123", "berber123", "kuafor123",
  "galatasaray", "fenerbahce", "besiktas", "trabzonspor", "galatasaray1905", "fenerbahce1907", "besiktas1903", "trabzon61", "cimbom1905", "gs1905",
  "fb1907", "bjk1903", "ts1967", "turkiye", "turkiye1923", "ataturk", "ataturk1881", "istanbul", "istanbul34", "ankara06",
  "izmir35", "bursa16", "antalya07", "allahbir", "bismillah", "asdasdasd", "qweqweqwe", "aaaaaaaa", "asdf1234", "deneme123",
]);

const fold = (s: string) =>
  s.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");

export type PasswordCtx = { email?: string; firstName?: string; lastName?: string; phone?: string };
export type PasswordCheck = { score: 0 | 1 | 2 | 3 | 4; label: string; error: string | null };

export function checkPassword(pw: string, ctx: PasswordCtx = {}): PasswordCheck {
  const p = fold(pw);
  const kinds = [/[a-zçğıöşü]/.test(pw), /[A-ZÇĞİÖŞÜ]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/.test(pw)].filter(Boolean).length;
  const personal = [
    ctx.email?.split("@")[0], ctx.firstName, ctx.lastName, ctx.phone?.replace(/\D/g, "").slice(-7),
  ].map((x) => fold(x ?? "")).filter((x) => x.length >= 4);

  let error: string | null = null;
  if (pw.length < 8) error = "Şifre en az 8 karakter olmalı.";
  else if (pw.length > 128) error = "Şifre en fazla 128 karakter olabilir.";
  else if (COMMON.has(p) || /^(.)\1+$/.test(p) || /^(0123456789|1234567890|abcdefgh)/.test(p)) error = "Bu şifre çok bilinen bir şifre; tahmin edilmesi kolay. Başka bir şifre seçin.";
  else if (personal.some((x) => p.includes(x))) error = "Şifrenizde adınız, e-postanız ya da telefon numaranız olmasın.";
  else if (kinds < 2 && pw.length < 12) error = "Şifrede harf ve rakam birlikte olsun (ya da en az 12 karakter yazın).";

  if (error) return { score: pw.length === 0 ? 0 : 1, label: pw.length === 0 ? "" : "Zayıf", error };
  const score = (pw.length >= 14 && kinds >= 3) || (pw.length >= 12 && kinds >= 4) ? 4 : pw.length >= 12 || kinds >= 3 ? 3 : 2;
  return { score, label: score === 4 ? "Çok güçlü" : score === 3 ? "Güçlü" : "Orta", error: null };
}
