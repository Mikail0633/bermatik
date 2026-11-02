import * as Location from 'expo-location';
import { getItem, setItem } from './storage';

export type Point = { lat: number; lng: number; label?: string };

/**
 * Telefonun konumu. İzin verilmezse ya da bulunamazsa null döner (o zaman kullanıcı haritadan seçer).
 * Önce son bilinen konum (hızlı), yoksa yeni ölçüm (en fazla 15 sn).
 */
export async function currentLocation(): Promise<{ point: Point | null; denied: boolean }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { point: null, denied: true };
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 500 });
    const pos = last ?? (await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
    ]));
    if (!pos) return { point: null, denied: false };
    const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    void setItem('bm_son_konum', JSON.stringify(point));
    return { point, denied: false };
  } catch {
    return { point: null, denied: false };
  }
}

/** En son kullanılan konum (haritadan seçilen dahil) */
export async function lastLocation(): Promise<Point | null> {
  const v = await getItem('bm_son_konum');
  try {
    const p = v ? JSON.parse(v) : null;
    return p && typeof p.lat === 'number' && typeof p.lng === 'number' ? p : null;
  } catch {
    return null;
  }
}

export const rememberLocation = (p: Point) => setItem('bm_son_konum', JSON.stringify(p));

// Haritadan seçilen konumu bekleyen ekrana iletmek için basit bir kanal
let pending: ((p: Point) => void) | null = null;
export const onPickedLocation = (fn: ((p: Point) => void) | null) => { pending = fn; };
export const deliverPickedLocation = (p: Point) => { void rememberLocation(p); pending?.(p); };
