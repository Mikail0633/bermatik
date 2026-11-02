import { useCallback, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, errorText } from '@/lib/api';
import { useSegment } from '@/lib/segment';
import { OpenBadge, ShopThumb } from '@/components/ShopRow';
import { Dashed, Loading, Notice, Row, Screen, T, Title } from '@/components/ui';

type Fav = { id: string; name: string; district: string; province: string; phone: string | null; cover: string | null; isOpen: boolean; closesAt: string | null };

// Favorilerim — sitedeki /favorilerim sayfasının düzeni
export default function Favoriler() {
  const { theme: th } = useSegment();
  const [rows, setRows] = useState<Fav[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ shops: Fav[] }>('/api/m/favori').then((r) => setRows(r.shops)).catch((e) => setError(errorText(e)));
  }, []);
  useFocusEffect(load);

  const remove = async (id: string) => {
    try { await api(`/api/m/favori/${id}`, { method: 'POST' }); load(); } catch (e) { setError(errorText(e)); }
  };

  return (
    <Screen edges={[]}>
      <Title>Favorilerim</Title>
      {error ? <Notice kind="error" text={error} /> : null}
      {!rows && !error ? <Loading /> : null}
      {rows && rows.length === 0 ? (
        <Dashed title="Henüz favori dükkânınız yok." text={'Beğendiğiniz dükkânın sayfasında "Favorilere ekle"ye dokunun; burada hızlıca bulun.'} />
      ) : null}
      {rows?.map((f) => (
        <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, padding: 12 }}>
          <Pressable onPress={() => router.push(`/dukkan/${f.id}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <ShopThumb name={f.name} cover={f.cover} size={56} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <T bold numberOfLines={1}>{f.name}</T>
              <T size={14} muted>{f.district}/{f.province}</T>
              <OpenBadge shop={{ isOpen: f.isOpen, closesAt: f.closesAt, opensAt: null }} compact />
            </View>
          </Pressable>
          <Row gap={8}>
            {f.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${f.phone!.replace(/[^\d+]/g, '')}`)} accessibilityLabel="Ara" style={{ borderRadius: 10, borderWidth: 1, borderColor: th.line, padding: 8 }}>
                <Ionicons name="call-outline" size={20} color={th.text} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => remove(f.id)} accessibilityLabel="Favorilerden çıkar" style={{ borderRadius: 10, borderWidth: 1, borderColor: th.line, padding: 8 }}>
              <Ionicons name="heart" size={20} color={th.closed} />
            </Pressable>
          </Row>
        </View>
      ))}
    </Screen>
  );
}
