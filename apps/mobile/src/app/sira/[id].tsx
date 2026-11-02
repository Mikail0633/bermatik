import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, errorText } from '@/lib/api';
import { useSegment } from '@/lib/segment';
import { alpha } from '@/lib/theme';
import type { ShopPage } from '@/lib/types';
import { OpenBadge } from '@/components/ShopRow';
import { Button, Dashed, Loading, Notice, Row, Screen, T, Title } from '@/components/ui';

// Sırayı gör: dükkânın bugünkü randevuları saat sırasıyla (müşteri adı yok); 30 saniyede bir yenilenir
export default function Sira() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme: th } = useSegment();
  const [data, setData] = useState<ShopPage | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setData(await api<ShopPage>(`/api/m/dukkan/${id}`)); setError(''); } catch (e) { setError(errorText(e)); }
  }, [id]);
  useEffect(() => {
    void load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (error && !data) return <Screen edges={[]}><Notice kind="error" text={error} /></Screen>;
  if (!data) return <Screen edges={[]}><Loading /></Screen>;
  const s = data.shop;
  const slots = data.today;
  const nextIdx = slots.findIndex((x) => !x.isPast);
  const waiting = slots.filter((x) => !x.isPast).length;

  const stat = (label: string, value: string) => (
    <View style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, padding: 16, alignItems: 'center' }}>
      <T size={14} muted>{label}</T>
      <T size={34} style={{ fontWeight: '800' }}>{value}</T>
    </View>
  );

  return (
    <Screen edges={['bottom']}>
      <Pressable onPress={() => router.back()}><T size={14} muted style={{ textDecorationLine: 'underline' }}>← {s.name}</T></Pressable>
      <View style={{ gap: 6 }}>
        <Title>Sırayı gör</Title>
        <Row gap={8} style={{ flexWrap: 'wrap' }}><T muted>{s.name}</T><OpenBadge shop={s} /></Row>
      </View>
      <Row gap={12}>
        {stat('Bugünkü randevu', String(slots.length))}
        {stat('Sıradaki', nextIdx >= 0 ? slots[nextIdx].start.slice(11, 16) : '—')}
      </Row>

      {slots.length === 0 ? <Dashed text="Bugün henüz randevu yok." /> : (
        <View style={{ gap: 8 }}>
          <T size={14} muted>{waiting === 0 ? 'Bugünkü randevuların hepsi geçti.' : `${waiting} randevu bekliyor.`}</T>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, overflow: 'hidden' }}>
            {slots.map((x, i) => (
              <Row key={i} gap={12} style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: th.line, backgroundColor: i === nextIdx ? alpha(th.accent, 0.15) : 'transparent' }}>
                <T size={18} bold muted={x.isPast} style={{ width: 58, fontVariant: ['tabular-nums'] }}>{x.start.slice(11, 16)}</T>
                <T muted={x.isPast} style={{ flex: 1 }}>{x.staff}</T>
                {x.isPast ? (
                  <Row gap={3}><Ionicons name="checkmark" size={16} color={th.muted} /><T size={14} muted>geçti</T></Row>
                ) : i === nextIdx ? <T size={14} bold color={th.accent}>● sıradaki</T> : null}
              </Row>
            ))}
          </View>
        </View>
      )}
      <T size={12} muted>Müşteri adları gösterilmez. Bu sayfa kendiliğinden güncellenir.</T>
      <Button title="Randevu al" icon={<Ionicons name="calendar-outline" size={20} color={th.onPrimary} />} onPress={() => router.push(`/randevu/${s.id}`)} />
    </Screen>
  );
}
