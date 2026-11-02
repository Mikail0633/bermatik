// Türkçe biçimler. Sunucudan gelen randevu saatleri "2026-11-02T10:30" (Türkiye saati) biçimindedir.

export const tl = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} ₺`;

/** "140 m", "1,4 km" */
export function distanceLabel(km: number) {
  const m = Math.max(10, Math.round(km * 100) * 10);
  return m < 1000 ? `${m} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const SHORT_DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** "2026-11-02T10:30" → "2 Kasım Pazartesi 10:30" */
export function localLabel(iso: string, withTime = true) {
  const [d, t] = iso.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const wd = (new Date(Date.UTC(y, m - 1, day)).getUTCDay() + 6) % 7;
  return `${day} ${MONTHS[m - 1]} ${DAYS[wd]}${withTime && t ? ` ${t.slice(0, 5)}` : ''}`;
}

/** Türkiye saatine göre bugünden başlayarak n gün: { date: "2026-11-02", label: "Bugün" | "Yarın" | "Pzt 3", ... } */
export function nextDays(n: number) {
  const now = new Date(Date.now() + 3 * 3_600_000); // Türkiye UTC+3
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    const wd = (d.getUTCDay() + 6) % 7;
    return {
      date: d.toISOString().slice(0, 10),
      top: i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : SHORT_DAYS[wd],
      bottom: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`,
    };
  });
}

/** Türkiye saatiyle şu an "2026-11-02T10:30" */
export const nowLocalIso = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 16);

/** Fotoğrafı olmayan dükkân/personel için baş harfler (emoji vb. atlanır) */
export function initials(name: string, count = 2) {
  const out: string[] = [];
  for (const word of name.replace(/['’]/g, '').split(/\s+/)) {
    const ch = word.match(/[\p{L}\p{N}]/u)?.[0];
    if (ch) out.push(ch);
    if (out.length >= count) break;
  }
  return (out.join('') || '?').toLocaleUpperCase('tr-TR');
}
