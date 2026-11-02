import { useCallback, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL, api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSegment } from '@/lib/segment';
import { Button, Dashed, Field, Loading, Notice, Row, Screen, T, Title } from '@/components/ui';
import { Result } from '@/components/panel/common';

type MyShop = { id: string; code: string; name: string; status: string; segment: string; district: string | null; role: string };

// İşletmem — sitedeki /panel giriş sayfası: dükkânlarım, "Dükkânımı ekle", personel davet kodu (admin: tüm dükkânlarda arama)
export default function Isletme() {
  const { user } = useAuth();
  const { theme: th } = useSegment();
  const [data, setData] = useState<{ admin: boolean; shops: MyShop[] } | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [code, setCode] = useState('');
  const [codeRes, setCodeRes] = useState<{ ok?: string; error?: string }>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (search = '') => {
    setError('');
    try { setData(await api(`/api/m/panel${search ? `?q=${encodeURIComponent(search)}` : ''}`)); } catch (e) { setError(errorText(e)); }
  }, []);
  useFocusEffect(useCallback(() => { if (user) void load(); }, [user, load]));

  if (!user) {
    return (
      <Screen>
        <Title>İşletme paneli</Title>
        <Dashed title="İşletme panelini görmek için giriş yapın." />
      </Screen>
    );
  }

  const claim = async () => {
    setBusy(true); setCodeRes({});
    try {
      const r = await api<{ ok: string; shopId: string | null }>('/api/m/panel', { method: 'POST', body: { code } });
      setCodeRes({ ok: r.ok }); setCode('');
      if (r.shopId) router.push(`/panel/${r.shopId}`);
      void load();
    } catch (e) {
      setCodeRes({ error: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const shopRow = (s: MyShop) => (
    <Pressable key={s.id} onPress={() => router.push(`/panel/${s.id}`)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: pressed ? th.surface2 : th.surface, padding: 16 })}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T bold numberOfLines={1}>{s.name}</T>
        {data?.admin ? <T size={14} muted>{s.code} · {s.district}{s.status === 'pending' ? ' · onay bekliyor' : ''}</T> : null}
      </View>
      <T size={14} muted>{data?.admin ? s.role : `${s.role}${s.status === 'pending' ? ' · onay bekliyor' : ''}`}</T>
      <Ionicons name="chevron-forward" size={18} color={th.muted} />
    </Pressable>
  );

  return (
    <Screen>
      <Title>{data?.admin ? 'İşletme panelleri' : 'İşletme paneli'}</Title>
      {error ? <Notice kind="error" text={error} /> : null}
      {!data && !error ? <Loading /> : null}

      {data?.admin && (<>
        <T size={14} muted>Admin olarak her dükkânın panelini dükkân sahibi gözüyle görebilirsiniz.</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={th.muted} />
          <TextInput
            value={q} onChangeText={setQ} onSubmitEditing={() => load(q.trim())} returnKeyType="search"
            placeholder="Dükkân adı, kodu veya telefonu ara (tüm dükkânlar)" placeholderTextColor={th.muted}
            style={{ flex: 1, minHeight: 46, color: th.text, fontSize: 15 }}
          />
        </View>
        {data && <T size={14} muted>{q.trim() ? `"${q.trim()}" için ${data.shops.length} sonuç` : `Bermatik'te olan (sahibi veya admin yönetiminde) ${data.shops.length} dükkân`}</T>}
      </>)}

      {data && data.shops.length > 0 && <View style={{ gap: 8 }}>{data.shops.map(shopRow)}</View>}
      {data && !data.admin && data.shops.length === 0 && <T muted>Henüz bir dükkânınız yok. Aşağıdan başlayın:</T>}

      {data && !data.admin && (<>
        <Pressable onPress={() => Linking.openURL(`${API_URL}/panel/yeni`)} style={({ pressed }) => ({ borderRadius: 16, backgroundColor: th.primary, padding: 20, gap: 6, opacity: pressed ? 0.9 : 1 })}>
          <Ionicons name="storefront-outline" size={32} color={th.onPrimary} />
          <T size={18} bold color={th.onPrimary}>Dükkânımı ekle (ilan ver)</T>
          <T size={14} color={th.onPrimary} style={{ opacity: 0.8 }}>Dükkân sahibiyseniz bilgilerinizi girin; onaylandıktan sonra sitede yayınlanır. (Sitede açılır)</T>
        </Pressable>
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, padding: 20, gap: 10 }}>
          <Ionicons name="key-outline" size={32} color={th.accent} />
          <View>
            <T size={18} bold>Personel misiniz?</T>
            <T size={14} muted>Dükkân sahibinizden aldığınız davet kodunu girin.</T>
          </View>
          <Result {...codeRes} />
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field label="Davet kodu" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={20} /></View>
            <Button title="Katıl" loading={busy} disabled={!code.trim()} onPress={claim} />
          </Row>
        </View>
        <T size={14} muted>Dükkânınız sitede "Bermatik'te değil" olarak görünüyorsa, dükkân sayfasındaki "Dükkânı sahiplen" düğmesini kullanın.</T>
      </>)}
    </Screen>
  );
}
