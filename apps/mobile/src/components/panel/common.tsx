import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { api, errorText } from '@/lib/api';
import { nextDays } from '@/lib/format';
import { useSegment } from '@/lib/segment';
import { alpha } from '@/lib/theme';
import { T } from '../ui';

// İşletme paneli ekranlarının ortak parçaları (sitedeki /panel ile aynı görünüm)

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
/** "2026-11-05" → "5 Kasım" (yıl istenirse "5 Kasım 2026") */
export const dateLabel = (d: string, year = false) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}${year ? ` ${d.slice(0, 4)}` : ''}`;
export const hm = (iso: string) => iso.slice(11, 16);

/** Sitedeki kutu: rounded-2xl border bg-surface p-4 */
export function Box({ children, style }: { children: ReactNode; style?: object }) {
  const { theme: th } = useSegment();
  return <View style={[{ borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, padding: 16, gap: 12 }, style]}>{children}</View>;
}

export function BoxTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T size={17} bold>{children}</T>
      {sub ? <T size={14} muted>{sub}</T> : null}
    </View>
  );
}

/** Başarı / hata kutusu (sitedeki yeşil "bg-open/10" ve kırmızı hata) */
export function Result({ ok, error }: { ok?: string; error?: string }) {
  const { theme: th } = useSegment();
  if (!ok && !error) return null;
  const c = ok ? th.open : th.closed;
  return (
    <View style={{ borderRadius: 12, backgroundColor: alpha(c, 0.12), paddingHorizontal: 12, paddingVertical: 8 }}>
      <T size={14} bold color={c}>{ok ?? error}</T>
    </View>
  );
}

/** Küçük düğme: başarı (yeşil), tehlike (kırmızı) ya da çerçeveli */
export function SmallButton({ title, onPress, variant = 'outline', disabled }: { title: string; onPress: () => void; variant?: 'success' | 'danger' | 'outline' | 'primary'; disabled?: boolean }) {
  const { theme: th } = useSegment();
  const bg = variant === 'success' ? th.open : variant === 'primary' ? th.primary : 'transparent';
  const fg = variant === 'success' ? '#fff' : variant === 'primary' ? th.onPrimary : variant === 'danger' ? th.closed : th.text;
  return (
    <Pressable
      onPress={onPress} disabled={disabled}
      style={({ pressed }) => ({ borderRadius: 10, borderWidth: variant === 'outline' || variant === 'danger' ? 1 : 0, borderColor: th.line, backgroundColor: bg, paddingHorizontal: 12, paddingVertical: 8, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 })}
    >
      <T size={14} bold color={fg}>{title}</T>
    </Pressable>
  );
}

/** Onay sorup işlem yapan küçük düğme */
export function confirmThen(question: string, run: () => void) {
  Alert.alert(question, undefined, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Evet', style: 'destructive', onPress: run }]);
}

/** Sunucuya yazma işlemi + sonuç mesajı */
export function useAction(onDone?: () => void) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok?: string; error?: string }>({});
  const run = useCallback(async (path: string, method: 'POST' | 'DELETE', body?: unknown) => {
    setBusy(true); setRes({});
    try {
      const r = await api<{ ok?: string }>(path, { method, body: body ?? {} });
      setRes({ ok: r.ok ?? 'Kaydedildi.' });
      onDone?.();
      return true;
    } catch (e) {
      setRes({ error: errorText(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }, [onDone]);
  return { busy, res, setRes, run };
}

/** Veri yükleme: { data, error, reload } */
export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!path) return;
    try { setData(await api<T>(path)); setError(''); } catch (e) { setError(errorText(e)); }
  }, [path]);
  useEffect(() => { setData(null); void reload(); }, [reload]);
  return { data, error, reload };
}

/** Saat kutusu: rakam yazdıkça "09:30" biçimine getirir */
export function TimeField({ label, value, onChange, placeholder = '09:00' }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { theme: th } = useSegment();
  return (
    <View style={{ gap: 4, minWidth: 84 }}>
      {label ? <T size={13}>{label}</T> : null}
      <TextInput
        value={value}
        onChangeText={(v) => {
          const d = v.replace(/\D/g, '').slice(0, 4);
          onChange(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d);
        }}
        placeholder={placeholder} placeholderTextColor={th.muted} keyboardType="number-pad" maxLength={5}
        style={{ minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, color: th.text, paddingHorizontal: 10, fontSize: 16, textAlign: 'center' }}
      />
    </View>
  );
}

/** Gün şeridi: bugünden başlayarak n gün ("Bugün", "Yarın", "Pzt 3 Kas") — seçili olan dolu renkli */
export function DayStrip({ value, onChange, days = 60, from = 0 }: { value: string; onChange: (d: string) => void; days?: number; from?: number }) {
  const { theme: th } = useSegment();
  const list = useMemo(() => {
    const all = nextDays(days + Math.max(0, -from));
    if (from >= 0) return all.slice(from);
    // dün: bugünden bir gün önce
    const y = new Date(Date.parse(`${all[0].date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    return [{ date: y, top: 'Dün', bottom: '' }, ...all];
  }, [days, from]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {list.map((d) => {
        const on = d.date === value;
        return (
          <Pressable key={d.date} onPress={() => onChange(d.date)} style={{ borderRadius: 12, borderWidth: 1, borderColor: on ? th.primary : th.line, backgroundColor: on ? th.primary : th.surface, paddingHorizontal: 12, paddingVertical: 9 }}>
            <T size={14} bold color={on ? th.onPrimary : th.text}>{['Dün', 'Bugün', 'Yarın'].includes(d.top) ? d.top : `${d.top} ${d.bottom}`}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Açık / kapalı anahtarı (onay kutusu görünümünde) */
export function Check({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { theme: th } = useSegment();
  return (
    <Pressable onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityRole="checkbox" accessibilityState={{ checked: value }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: value ? th.primary : th.muted, backgroundColor: value ? th.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {value ? <T size={14} bold color={th.onPrimary}>✓</T> : null}
      </View>
      <T size={14} style={{ flex: 1 }}>{label}</T>
    </Pressable>
  );
}
