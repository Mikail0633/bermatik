import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getItem, setItem } from './storage';
import { THEMES, SEG_TEXT, type Theme } from './theme';
import type { Segment } from './types';

// Erkek / Kadın bölümü (tek düğmeyle değişir, seçim telefonda hatırlanır)
type SegCtx = { segment: Segment; setSegment: (s: Segment) => void; theme: Theme; t: (typeof SEG_TEXT)[Segment]; chosen: boolean };
const Ctx = createContext<SegCtx | null>(null);

export function SegmentProvider({ children }: { children: ReactNode }) {
  const [segment, setSeg] = useState<Segment>('erkek');
  const [chosen, setChosen] = useState(true);

  useEffect(() => {
    getItem('bm_bolum').then((v) => {
      if (v === 'erkek' || v === 'kadin') setSeg(v);
      else setChosen(false); // ilk açılış: "Erkek mi, kadın mı?" sorulur
    });
  }, []);

  const value = useMemo(() => ({
    segment, theme: THEMES[segment], t: SEG_TEXT[segment], chosen,
    setSegment: (s: Segment) => { setSeg(s); setChosen(true); void setItem('bm_bolum', s); },
  }), [segment, chosen]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSegment() {
  const c = useContext(Ctx);
  if (!c) throw new Error('SegmentProvider eksik');
  return c;
}
export const useTheme = () => useSegment().theme;
