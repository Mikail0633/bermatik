import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSegment } from '@/lib/segment';
import { alpha } from '@/lib/theme';
import type { Notification } from '@/lib/types';
import { Dashed, Loading, Notice, Screen, T, Title } from '@/components/ui';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
/** "1 Kasım 14:30" (sitedeki gibi) */
const when = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(11, 16)}`;

// Bildirimler — sitedeki /bildirimler sayfasının düzeni (yeni olanlar vurgulu)
export default function Bildirimler() {
  const { refresh } = useAuth();
  const { theme: th } = useSegment();
  const [rows, setRows] = useState<Notification[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await api<{ notifications: Notification[] }>('/api/m/bildirimler');
      setRows(r.notifications);
      void refresh(); // zil sayısı sıfırlansın
    } catch (e) {
      setError(errorText(e));
    }
  }, [refresh]);
  useEffect(() => { void load(); }, [load]);

  // Bildirimdeki site adresinin uygulamada karşılığı varsa oraya git
  const target = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('/randevularim')) return () => router.push('/randevular');
    if (url.startsWith('/favorilerim')) return () => router.push('/favoriler');
    return null;
  };

  return (
    <Screen edges={[]} refresh={<RefreshControl refreshing={refreshing} tintColor={th.accent} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Title>Bildirimler</Title>
      {error ? <Notice kind="error" text={error} /> : null}
      {!rows && !error ? <Loading /> : null}
      {rows && rows.length === 0 ? <Dashed text="Henüz bildiriminiz yok." /> : null}
      <View style={{ gap: 8 }}>
        {rows?.map((n) => {
          const go = target(n.url);
          return (
            <Pressable
              key={n.id} disabled={!go} onPress={go ?? undefined}
              style={({ pressed }) => ({ borderRadius: 16, borderWidth: 1, padding: 16, borderColor: n.isRead ? th.line : th.accent, backgroundColor: pressed ? th.surface2 : n.isRead ? th.surface : alpha(th.accent, 0.1) })}
            >
              <T bold>
                {!n.isRead ? <T color={th.accent}>● </T> : null}
                {n.title}
              </T>
              <T size={14} muted>{n.body}</T>
              <T size={12} muted style={{ marginTop: 4 }}>{when(n.createdAt)}</T>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
