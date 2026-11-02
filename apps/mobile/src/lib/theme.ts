import type { Segment } from './types';

// Sitedeki renklerin birebir aynısı (apps/web/src/app/globals.css):
// erkek bölümü koyu (siyah + altın), kadın bölümü açık (pudra + bordo)
export type Theme = {
  dark: boolean;
  bg: string; surface: string; surface2: string; line: string;
  text: string; muted: string;
  primary: string; onPrimary: string;   // ana düğmeler
  accent: string; onAccent: string;     // vurgu (yıldız, simge, seçili)
  hero: string; onHero: string;         // ana sayfanın üst bölümü
  cta: string; onCta: string;           // üst bölümdeki "En yakını bul" düğmesi
  logoBg: string; logoFg: string;
  open: string; closed: string;
};

export const THEMES: Record<Segment, Theme> = {
  erkek: {
    dark: true,
    bg: '#0b0b0b', surface: '#1a1a1a', surface2: '#262626', line: '#333333',
    text: '#f5f5f5', muted: '#a3a3a3',
    primary: '#c9a227', onPrimary: '#111111', accent: '#c9a227', onAccent: '#111111',
    hero: '#141414', onHero: '#ffffff', cta: '#c9a227', onCta: '#111111',
    logoBg: '#c9a227', logoFg: '#111111',
    open: '#22a06b', closed: '#ef4444',
  },
  kadin: {
    dark: false,
    bg: '#fdf5f5', surface: '#ffffff', surface2: '#f6e1e1', line: '#f0d6d9',
    text: '#3a1622', muted: '#7a5a64',
    primary: '#8e2c48', onPrimary: '#ffffff', accent: '#8e2c48', onAccent: '#ffffff',
    hero: '#8e2c48', onHero: '#ffffff', cta: '#ffffff', onCta: '#8e2c48',
    logoBg: '#8e2c48', logoFg: '#f6e1e1',
    open: '#1f7a4d', closed: '#b42318',
  },
};

/** Saydamlık ekler: alpha('#22a06b', 0.1) → rgba(...) (sitedeki "bg-open/10" gibi) */
export function alpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const SEG_TEXT: Record<Segment, { label: string; shop: string; shops: string; Shops: string; shopAcc: string }> = {
  erkek: { label: 'Erkek', shop: 'berber', shops: 'berberler', Shops: 'Berberler', shopAcc: 'berberi' },
  kadin: { label: 'Kadın', shop: 'kuaför', shops: 'kuaförler', Shops: 'Kuaförler', shopAcc: 'kuaförü' },
};
