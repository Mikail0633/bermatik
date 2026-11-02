import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL } from '@/lib/api';
import { useSegment } from '@/lib/segment';
import { alpha } from '@/lib/theme';
import { Loading, Notice, Row, Screen, T } from '@/components/ui';
import { useLoad } from '@/components/panel/common';
import { Today } from '@/components/panel/Today';
import { Appointments } from '@/components/panel/Appointments';
import { Services } from '@/components/panel/Services';
import { Staff } from '@/components/panel/Staff';
import { InfoTab } from '@/components/panel/Info';
import { Closures } from '@/components/panel/Closures';

type Head = { shop: { id: string; code: string; name: string; segment: string; status: string; statusReason: string | null; isOwner: boolean; canManage: boolean; isAdmin: boolean } };

// Sitedeki sekmeler. owner: yalnızca dükkân sahibi (ve admin) görür. web: şimdilik sitede açılır.
const TABS = [
  { key: 'bugun', label: 'Bugün', owner: false },
  { key: 'randevular', label: 'Randevular', owner: false },
  { key: 'bilgiler', label: 'Bilgiler ve saatler', owner: true },
  { key: 'hizmetler', label: 'Hizmetler ve fiyatlar', owner: true },
  { key: 'personel', label: 'Personel', owner: true },
  { key: 'galeri', label: 'Fotoğraflar', owner: false, web: 'galeri' },
  { key: 'magaza', label: 'Mağaza', owner: false, web: 'magaza' },
  { key: 'mesajlar', label: 'Müşterilere mesaj', owner: true, web: 'mesajlar' },
  { key: 'kapali', label: 'Kapalı günler', owner: true },
] as const;
type TabKey = (typeof TABS)[number]['key'];

// İşletme paneli — sitedeki /panel/[dükkân] ile aynı sekmeler
export default function Panel() {
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const { theme: th } = useSegment();
  const { data, error } = useLoad<Head>(`/api/m/panel/${shopId}`);
  const [tab, setTab] = useState<TabKey>('bugun');

  if (error && !data) return <Screen edges={[]}><Notice kind="error" text={error} /></Screen>;
  if (!data) return <Screen edges={[]}><Loading /></Screen>;
  const s = data.shop;
  const tabs = TABS.filter((t) => s.canManage || !t.owner);

  return (
    <Screen edges={['bottom']}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <T size={24} style={{ fontWeight: '800' }}>{s.name}</T>
          <T size={14} muted>{s.code} · {s.segment === 'erkek' ? 'Erkek berberi' : 'Kadın kuaförü'} · {s.isAdmin ? 'Admin (dükkân sahibi gözüyle)' : s.isOwner ? 'Sahibi' : 'Personel'}</T>
        </View>
        {s.status === 'approved' && (
          <Pressable onPress={() => router.push(`/dukkan/${s.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, borderWidth: 1, borderColor: th.line, paddingHorizontal: 10, paddingVertical: 7 }}>
            <T size={14}>Sayfamı gör</T><Ionicons name="open-outline" size={15} color={th.text} />
          </Pressable>
        )}
      </Row>

      {s.status === 'pending' && (
        <View style={{ borderRadius: 12, backgroundColor: alpha(th.accent, 0.15), paddingHorizontal: 12, paddingVertical: 10 }}>
          <T size={14}>⏳ Dükkânınız <T size={14} bold>Bermatik ekibinin onayını bekliyor</T>. Bu sırada hizmetlerinizi, fiyatlarınızı, personelinizi ve saatlerinizi girebilirsiniz; onaylanınca sitede yayınlanır.</T>
          {s.isOwner && !s.isAdmin ? (
            <Pressable onPress={() => Linking.openURL(`${API_URL}/panel/${s.id}`)} style={{ marginTop: 6 }}>
              <T size={14} bold color={th.accent}>Dükkân sahipliği belgenizi sitede yükleyin →</T>
            </Pressable>
          ) : null}
        </View>
      )}
      {(s.status === 'suspended' || s.status === 'rejected') && (
        <View style={{ borderRadius: 12, backgroundColor: alpha(th.closed, 0.12), paddingHorizontal: 12, paddingVertical: 10 }}>
          <T size={14} color={th.closed}>Dükkânınız şu an yayında değil{s.statusReason ? `: ${s.statusReason}` : ''}. Bilgi için bizimle iletişime geçin.</T>
        </View>
      )}

      {/* Sekmeler */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: th.line }} contentContainerStyle={{ gap: 4 }}>
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => ('web' in t ? Linking.openURL(`${API_URL}/panel/${s.id}/${t.web}`) : setTab(t.key))}
              style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: on ? th.primary : 'transparent' }}
            >
              <T size={14} bold color={on ? th.text : th.muted}>{t.label}{'web' in t ? ' ↗' : ''}</T>
            </Pressable>
          );
        })}
      </ScrollView>

      {tab === 'bugun' && <Today shopId={s.id} />}
      {tab === 'randevular' && <Appointments shopId={s.id} />}
      {tab === 'bilgiler' && <InfoTab shopId={s.id} />}
      {tab === 'hizmetler' && <Services shopId={s.id} />}
      {tab === 'personel' && <Staff shopId={s.id} />}
      {tab === 'kapali' && <Closures shopId={s.id} />}
    </Screen>
  );
}
