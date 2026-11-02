import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, errorText } from '@/lib/api';
import { useSegment } from '@/lib/segment';
import type { District, Province } from '@/lib/types';
import { Loading, Notice, Row, Screen, T } from '@/components/ui';

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');

// İl → ilçe → (isteğe bağlı) mahalle seçimi; seçilince o bölgenin listesi açılır
export default function Bolge() {
  const { theme: th } = useSegment();
  const [provinces, setProvinces] = useState<Province[] | null>(null);
  const [province, setProvince] = useState<Province | null>(null);
  const [districts, setDistricts] = useState<District[] | null>(null);
  const [district, setDistrict] = useState<District | null>(null);
  const [hoods, setHoods] = useState<{ Id: number; Name: string }[] | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<Province[]>('/api/iller', { auth: false }).then(setProvinces).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    setDistricts(null); setFilter('');
    if (province) api<District[]>(`/api/ilceler?il=${province.Id}`, { auth: false }).then(setDistricts).catch((e) => setError(errorText(e)));
  }, [province]);
  useEffect(() => {
    setHoods(null); setFilter('');
    if (district) api<{ Id: number; Name: string }[]>(`/api/mahalleler?ilce=${district.Id}`, { auth: false }).then(setHoods).catch((e) => setError(errorText(e)));
  }, [district]);

  const step = !province ? 'il' : !district ? 'ilce' : 'mahalle';
  const items = useMemo(() => {
    const list: { id: number; name: string }[] = step === 'il'
      ? (provinces ?? []).map((x) => ({ id: x.Id, name: x.Name }))
      : step === 'ilce' ? (districts ?? []).map((x) => ({ id: x.Id, name: x.Name })) : (hoods ?? []).map((x) => ({ id: x.Id, name: x.Name }));
    const f = norm(filter.trim());
    return f ? list.filter((x) => norm(x.name).includes(f)) : list;
  }, [step, provinces, districts, hoods, filter]);
  const loading = step === 'il' ? !provinces : step === 'ilce' ? !districts : !hoods;

  const open = (hood?: { id: number; name: string }) => {
    if (!province) return;
    router.push({
      pathname: '/liste',
      params: {
        il: province.Slug, ilAd: province.Name,
        ...(district ? { ilce: district.Slug, ilceAd: district.Name } : {}),
        ...(hood ? { mahalle: String(hood.id), mahalleAd: hood.name } : {}),
      },
    });
  };

  const choose = (x: { id: number; name: string }) => {
    if (step === 'il') setProvince(provinces!.find((p) => p.Id === x.id) ?? null);
    else if (step === 'ilce') setDistrict(districts!.find((d) => d.Id === x.id) ?? null);
    else open(x);
  };

  const back = () => { if (district) setDistrict(null); else setProvince(null); };

  return (
    <Screen scroll={false} edges={['bottom']}>
      <View style={{ padding: 16, gap: 10 }}>
        {province && (
          <Row style={{ justifyContent: 'space-between' }}>
            <Pressable onPress={back} hitSlop={8}><Row gap={4}><Ionicons name="chevron-back" size={18} color={th.accent} /><T bold color={th.accent}>Geri</T></Row></Pressable>
            <Pressable onPress={() => open()} hitSlop={8}>
              <T bold color={th.accent}>{district ? `Tüm ${district.Name}` : `Tüm ${province.Name}`} →</T>
            </Pressable>
          </Row>
        )}
        <T bold size={17}>{step === 'il' ? 'İl seçin' : step === 'ilce' ? `${province!.Name} — ilçe seçin` : `${district!.Name} — mahalle seçin (isteğe bağlı)`}</T>
        <TextInput
          value={filter} onChangeText={setFilter} placeholder="Yazarak bulun…" placeholderTextColor={th.muted}
          style={{ minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, color: th.text, paddingHorizontal: 12, fontSize: 16 }}
        />
        {error ? <Notice kind="error" text={error} /> : null}
      </View>
      {loading && !error ? <Loading /> : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => choose(item)} style={({ pressed }) => ({ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: th.line, opacity: pressed ? 0.6 : 1 })}>
              <Row style={{ justifyContent: 'space-between' }}><T size={16}>{item.name}</T><Ionicons name="chevron-forward" size={16} color={th.muted} /></Row>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
