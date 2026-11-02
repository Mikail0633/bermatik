import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api } from '@/lib/api';
import { useSegment } from '@/lib/segment';
import { Crumbs } from '@/components/Header';
import { OpenBadge } from '@/components/ShopRow';
import { Button, Dashed, Screen, T, Title } from '@/components/ui';

type Row = {
  Id: string; Name: string; Neighborhood: string; District: string; Province: string;
  IsOpen: boolean; OpensAt: string | null; ClosesAt: string | null; IsClaimed: boolean; TodayAppointments: number;
};
const PAGE = 50;
const hhmm = (t: string | null) => (t ? new Date(t).toISOString().slice(11, 16) : null);

// Sırayı gör: tüm dükkânlar listelenir, yazdıkça süzülür; dükkâna basınca o dükkânın bugünkü sırası açılır
// (sitedeki /[bölüm]/sira sayfası ve QueueFinder ile aynı)
export default function SiraAra() {
  const { segment, theme: th, t } = useSegment();
  const [q, setQ] = useState('');
  const [count, setCount] = useState(PAGE);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const req = useRef(0);

  useEffect(() => {
    const my = ++req.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await api<{ shops: Row[]; more: boolean }>(`/api/sira-ara?bolum=${segment}&q=${encodeURIComponent(q.trim())}&adet=${count}`, { auth: false });
        if (my !== req.current) return; // daha yeni bir arama başladıysa bu cevabı yok say
        setRows(r.shops ?? []); setMore(!!r.more);
      } catch {
        if (my === req.current) setRows([]);
      } finally {
        if (my === req.current) setLoading(false);
      }
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, count, segment]);

  const header = (
    <View style={{ gap: 12, marginBottom: 12 }}>
      <Crumbs items={[{ label: t.Shops, onPress: () => router.navigate('/') }, { label: 'Sırayı gör' }]} />
      <View>
        <Title>Sırayı gör</Title>
        <T muted>{t.Shops} içinde arayın, seçtiğiniz dükkânın bugünkü randevu sırasını görün.</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, paddingHorizontal: 12 }}>
        <Ionicons name="search" size={20} color={th.muted} />
        <TextInput
          value={q} autoFocus
          onChangeText={(v) => { setQ(v); setCount(PAGE); }}
          placeholder={`${t.shop.charAt(0).toLocaleUpperCase('tr-TR')}${t.shop.slice(1)} adı, ilçe veya il yazın`}
          placeholderTextColor={th.muted}
          returnKeyType="search"
          style={{ flex: 1, minHeight: 50, fontSize: 18, color: th.text }}
        />
        {loading && <ActivityIndicator size="small" color={th.muted} />}
      </View>
    </View>
  );

  return (
    <Screen scroll={false} edges={[]}>
      <FlatList
        data={rows ?? []}
        keyExtractor={(s) => s.Id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={header}
        renderItem={({ item: s, index }) => (
          <Pressable
            onPress={() => router.push(s.IsClaimed ? `/sira/${s.Id}` : `/dukkan/${s.Id}`)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12,
              backgroundColor: pressed ? th.surface2 : th.surface, borderColor: th.line, borderLeftWidth: 1, borderRightWidth: 1,
              borderTopWidth: index === 0 ? 1 : StyleSheet.hairlineWidth, borderBottomWidth: index === (rows?.length ?? 0) - 1 ? 1 : 0,
              borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0,
              borderBottomLeftRadius: index === (rows?.length ?? 0) - 1 ? 16 : 0, borderBottomRightRadius: index === (rows?.length ?? 0) - 1 ? 16 : 0,
            })}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <T bold numberOfLines={1}>{s.Name}</T>
              <T size={14} muted numberOfLines={1}>{s.Neighborhood.replace(/ Mahallesi$/, '')}, {s.District} / {s.Province}</T>
              <T size={12} muted style={{ marginTop: 2 }}>
                {s.IsClaimed ? (s.TodayAppointments === 0 ? 'Bugün randevu yok' : `Bugün ${s.TodayAppointments} randevu`) : "Henüz Bermatik'e katılmadı · sıra bilgisi yok"}
              </T>
            </View>
            {s.IsClaimed && <OpenBadge shop={{ isOpen: s.IsOpen, opensAt: hhmm(s.OpensAt), closesAt: hhmm(s.ClosesAt) }} compact />}
            <Ionicons name="chevron-forward" size={20} color={th.muted} />
          </Pressable>
        )}
        ListEmptyComponent={rows && !loading ? <Dashed text={`"${q}" ile eşleşen ${t.shop} bulunamadı.`} /> : undefined}
        ListFooterComponent={more ? (
          <Button title="Daha fazla göster" variant="ghost" disabled={loading} onPress={() => setCount((c) => c + PAGE)} style={{ marginTop: 16 }} />
        ) : undefined}
      />
    </Screen>
  );
}
