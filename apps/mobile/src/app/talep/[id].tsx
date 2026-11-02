import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { nextDays } from '@/lib/format';
import { useSegment } from '@/lib/segment';
import type { ShopPage } from '@/lib/types';
import { alpha } from '@/lib/theme';
import { Button, Field, Loading, Notice, Row, Screen, T, Title } from '@/components/ui';

// 09:00 – 21:00 arası yarım saatler (sitedeki talep formunun aynısı)
const TIMES = Array.from({ length: 25 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

// Bermatik'e katılmamış dükkânın "Randevu al" ekranı: talep formu (sitedeki RequestPage + RequestForm)
export default function Talep() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme: th } = useSegment();
  const { user } = useAuth();
  const [page, setPage] = useState<ShopPage | null>(null);
  const [error, setError] = useState('');
  const days = useMemo(() => nextDays(14), []);
  const [category, setCategory] = useState<number | null>(null);
  const [day, setDay] = useState(days[0].date);
  const [time, setTime] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => { api<ShopPage>(`/api/m/dukkan/${id}`).then(setPage).catch((e) => setError(errorText(e))); }, [id]);
  if (error) return <Screen edges={[]}><Notice kind="error" text={error} /></Screen>;
  if (!page) return <Screen edges={[]}><Loading /></Screen>;
  const shop = page.shop;

  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <Pressable key={key} onPress={onPress} style={{ borderRadius: 12, borderWidth: 1, borderColor: on ? th.primary : th.line, backgroundColor: on ? th.primary : th.surface, paddingHorizontal: 12, paddingVertical: 9 }}>
      <T size={14} bold color={on ? th.onPrimary : th.text}>{label}</T>
    </Pressable>
  );

  const send = async () => {
    if (!time) return setFormErr('Gün ve saat seçin.');
    setSaving(true); setFormErr('');
    try {
      const r = await api<{ ok: string }>('/api/m/talep', { method: 'POST', body: { shopId: id, day, time, categoryId: category ?? undefined, note: note.trim() || undefined } });
      setDone(r.ok);
    } catch (e) {
      setFormErr(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Pressable onPress={() => router.back()}><T size={14} muted style={{ textDecorationLine: 'underline' }}>← {shop.name}</T></Pressable>
      <View>
        <Title>Randevu al</Title>
        <T muted>{shop.name} · {shop.district}</T>
      </View>
      <View style={{ borderRadius: 12, backgroundColor: th.surface2, paddingHorizontal: 16, paddingVertical: 12 }}>
        <T size={14}>
          Bu dükkân henüz Bermatik'e katılmadı. Talebinizi bırakın; <T size={14} bold>dükkânı biz arayıp sizin için ayarlayalım</T>.
          Onaylanınca bildirim gelir ve Randevularım sayfanızda görünür.
        </T>
      </View>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, padding: 18, gap: 18 }}>
        {!user ? (
          <View style={{ alignItems: 'center', gap: 14 }}>
            <T style={{ textAlign: 'center' }}>Talep bırakmak için giriş yapın; size ulaşabilmemiz için telefonunuz gerekli.</T>
            <Row>
              <Button title="Giriş yap" variant="ghost" onPress={() => router.push('/giris')} />
              <Button title="Kayıt ol" onPress={() => router.push('/kayit')} />
            </Row>
          </View>
        ) : done ? (
          <View style={{ borderRadius: 16, backgroundColor: alpha(th.open, 0.12), padding: 18, gap: 12 }}>
            <T bold color={th.open}>{done}</T>
            <Button title="Randevularım" variant="secondary" onPress={() => { router.dismissAll(); router.replace('/randevular'); }} />
          </View>
        ) : (<>
          {formErr ? <Notice kind="error" text={formErr} /> : null}
          <View style={{ gap: 6 }}>
            <T size={14} bold>Hizmet</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {chip(category === null, 'Seçmeden devam et', () => setCategory(null), 'yok')}
              {(page.categories ?? []).map((c) => chip(category === c.id, c.name, () => setCategory(c.id), String(c.id)))}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <T size={14} bold>Gün</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {days.map((d) => chip(d.date === day, d.top === 'Bugün' || d.top === 'Yarın' ? d.top : `${d.top} ${d.bottom}`, () => setDay(d.date), d.date))}
            </ScrollView>
          </View>
          <View style={{ gap: 6 }}>
            <T size={14} bold>İstediğiniz saat</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TIMES.map((tm) => chip(time === tm, tm, () => setTime(tm), tm))}
            </View>
          </View>
          <Field label="Not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={300} placeholder="Örn. saat 14:00 olmazsa 16:00 da uyar" />
          <Button title="Randevu talebi gönder" loading={saving} onPress={send} />
        </>)}
      </View>
    </Screen>
  );
}
