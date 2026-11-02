import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { localLabel, nowLocalIso, tl } from '@/lib/format';
import { useSegment } from '@/lib/segment';
import { alpha, type Theme } from '@/lib/theme';
import type { Appointment, BookingRequest } from '@/lib/types';
import { Button, Dashed, Loading, Notice, Row, Screen, T, Title } from '@/components/ui';

const STATUS: Record<string, string> = {
  pending: 'Onay bekliyor', accepted: 'Onaylandı', completed: 'Tamamlandı', cancelled: 'İptal edildi', rejected: 'Kabul edilmedi', no_show: 'Gelinmedi',
};
// Sitedeki renkler: onay bekliyor = vurgu, onaylandı = yeşil, tamamlandı = gri, iptal/ret = kırmızı
const statusColors = (th: Theme, st: string) =>
  st === 'accepted' ? { bg: alpha(th.open, 0.12), fg: th.open }
    : st === 'completed' ? { bg: th.surface2, fg: th.muted }
      : st === 'pending' ? { bg: alpha(th.accent, 0.2), fg: th.text }
        : { bg: alpha(th.closed, 0.12), fg: th.closed };

// Randevularım — sitedeki /randevularim sayfasının düzeni
export default function Randevular() {
  const { user, ready } = useAuth();
  const { theme: th } = useSegment();
  const { yeni } = useLocalSearchParams<{ yeni?: string }>();
  const [data, setData] = useState<{ appointments: Appointment[]; requests: BookingRequest[] } | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try { setData(await api('/api/m/randevu')); } catch (e) { setError(errorText(e)); }
  }, [user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!ready) return <Screen><Loading /></Screen>;
  if (!user) {
    return (
      <Screen>
        <Title>Randevularım</Title>
        <Dashed title="Randevularınızı görmek için giriş yapın.">
          <Row style={{ marginTop: 8 }}>
            <Button title="Giriş yap" variant="ghost" onPress={() => router.push('/giris')} />
            <Button title="Kayıt ol" onPress={() => router.push('/kayit')} />
          </Row>
        </Dashed>
      </Screen>
    );
  }

  const now = nowLocalIso();
  const upcoming = (data?.appointments ?? []).filter((a) => ['pending', 'accepted'].includes(a.status) && a.start > now).reverse();
  const past = (data?.appointments ?? []).filter((a) => !upcoming.includes(a));
  const activeReq = (data?.requests ?? []).filter((q) => q.status === 'open' || q.status === 'confirmed');
  const callShop = (p: string) => Linking.openURL(`tel:${p.replace(/[^\d+]/g, '')}`);
  const smallBtn = (label: string, onPress: () => void, icon?: keyof typeof Ionicons.glyphMap, danger?: boolean) => (
    <Pressable key={label} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, borderWidth: 1, borderColor: th.line, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: pressed ? th.surface2 : 'transparent' })}>
      {icon && <Ionicons name={icon} size={16} color={danger ? th.closed : th.text} />}
      <T size={14} bold color={danger ? th.closed : th.text}>{label}</T>
    </Pressable>
  );
  const pill = (text: string, c: { bg: string; fg: string }) => (
    <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: c.bg }}><T size={12} bold color={c.fg}>{text}</T></View>
  );
  const box = { borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, padding: 16, gap: 4 } as const;

  const cancel = (a: Appointment) => Alert.alert('Randevu iptal edilsin mi?', `${a.shopName} · ${localLabel(a.start)}`, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'İptal et', style: 'destructive', onPress: async () => {
      try { await api(`/api/m/randevu/${a.id}/iptal`, { method: 'POST' }); void load(); } catch (e) { Alert.alert('İptal edilemedi', errorText(e)); }
    } },
  ]);
  const cancelReq = (q: BookingRequest) => Alert.alert('Talep iptal edilsin mi?', q.shopName, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'İptal et', style: 'destructive', onPress: async () => {
      try { await api(`/api/m/talep/${q.id}/iptal`, { method: 'POST' }); void load(); } catch (e) { Alert.alert('İptal edilemedi', errorText(e)); }
    } },
  ]);

  const card = (a: Appointment, active: boolean) => (
    <View key={a.id} style={box}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => router.push(`/dukkan/${a.shopId}`)}><T size={18} bold>{a.shopName}</T></Pressable>
          <T size={14} muted>{a.services} · {a.staffName}</T>
        </View>
        {pill(STATUS[a.status] ?? a.status, statusColors(th, a.status))}
      </Row>
      <T bold style={{ marginTop: 6 }}>{localLabel(a.start)}</T>
      <T size={14} muted>{tl(a.price)} · ödeme dükkânda</T>
      <Row style={{ flexWrap: 'wrap', marginTop: 8 }}>
        {a.shopPhone ? smallBtn('Ara', () => callShop(a.shopPhone!), 'call-outline') : null}
        {active ? smallBtn('İptal et', () => cancel(a), undefined, true) : smallBtn('Tekrar randevu al', () => router.push({ pathname: '/randevu/[id]', params: { id: a.shopId, personel: a.staffId } }), 'refresh')}
      </Row>
      {a.canReview && <ReviewForm appointmentId={a.id} />}
    </View>
  );

  return (
    <Screen refresh={<RefreshControl refreshing={refreshing} tintColor={th.accent} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Title>Randevularım</Title>
      {yeni === '1' && (
        <View style={{ borderRadius: 12, backgroundColor: alpha(th.open, 0.12), paddingHorizontal: 12, paddingVertical: 10 }}>
          <T bold color={th.open}>Randevu talebiniz gönderildi! Dükkân onaylayınca bildirim alacaksınız.</T>
        </View>
      )}
      {error ? <Notice kind="error" text={error} /> : null}
      {!data && !error ? <Loading /> : null}
      {data && (<>
        {activeReq.length > 0 && (
          <View style={{ gap: 10 }}>
            <View>
              <T size={20} bold>Taleplerim</T>
              <T size={14} muted>Bermatik'e henüz katılmamış dükkânlar için bıraktığınız talepler; dükkânı arayıp ayarlıyoruz.</T>
            </View>
            {activeReq.map((q) => (
              <View key={q.id} style={box}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Pressable disabled={!q.shopId} onPress={() => q.shopId && router.push(`/dukkan/${q.shopId}`)}><T size={18} bold>{q.shopName}</T></Pressable>
                    <T size={14} muted>{q.kind === 'sira' ? 'Sıra talebi' : 'Randevu talebi'}{q.category ? ` · ${q.category}` : ''} · {q.district}</T>
                  </View>
                  {pill(q.status === 'confirmed' ? 'Ayarlandı' : 'Ayarlanıyor', q.status === 'confirmed' ? { bg: alpha(th.open, 0.12), fg: th.open } : { bg: alpha(th.accent, 0.2), fg: th.text })}
                </Row>
                <T bold style={{ marginTop: 6 }}>
                  {localLabel(q.confirmed ?? q.preferred)}{q.status === 'open' ? <T muted> (istediğiniz saat)</T> : null}
                </T>
                {q.adminNote ? <T size={14} muted>{q.adminNote}</T> : null}
                <Row style={{ flexWrap: 'wrap', marginTop: 8 }}>
                  {q.shopPhone ? smallBtn('Ara', () => callShop(q.shopPhone!), 'call-outline') : null}
                  {smallBtn('İptal et', () => cancelReq(q), undefined, true)}
                </Row>
              </View>
            ))}
          </View>
        )}
        <View style={{ gap: 10 }}>
          <T size={20} bold>Yaklaşan</T>
          {upcoming.length ? upcoming.map((a) => card(a, true)) : <T muted>Yaklaşan randevunuz yok.</T>}
        </View>
        {past.length > 0 && (
          <View style={{ gap: 10, marginTop: 8 }}>
            <T size={20} bold>Geçmiş</T>
            {past.map((a) => card(a, false))}
          </View>
        )}
      </>)}
    </Screen>
  );
}

// Tamamlanan randevu için puan + yorum (sitedeki gibi 5 yıldız seçili başlar)
function ReviewForm({ appointmentId }: { appointmentId: string }) {
  const { theme: th } = useSegment();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  if (done) return <View style={{ marginTop: 10, borderRadius: 12, backgroundColor: alpha(th.open, 0.12), padding: 10 }}><T size={14} bold color={th.open}>{done}</T></View>;
  const send = async () => {
    setSaving(true); setErr('');
    try {
      const r = await api<{ ok: string }>('/api/m/yorum', { method: 'POST', body: { appointmentId, rating, comment: comment.trim() || undefined } });
      setDone(r.ok);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={{ marginTop: 10, gap: 8, borderRadius: 12, backgroundColor: th.surface2, padding: 12 }}>
      <T size={14} bold>Hizmeti puanlayın</T>
      <Row gap={4}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)} hitSlop={4} accessibilityLabel={`${n} yıldız`} accessibilityState={{ selected: rating === n }}>
            <Ionicons name="star" size={28} color={n <= rating ? th.accent : th.line} />
          </Pressable>
        ))}
      </Row>
      <TextInput
        value={comment} onChangeText={setComment} maxLength={1000} multiline numberOfLines={2}
        placeholder="Yorumunuz (isteğe bağlı)" placeholderTextColor={th.muted}
        style={{ minHeight: 60, borderRadius: 12, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, color: th.text, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, textAlignVertical: 'top' }}
      />
      {err ? <T size={13} color={th.closed}>{err}</T> : null}
      <Button title="Gönder" loading={saving} onPress={send} style={{ alignSelf: 'flex-start', minHeight: 42 }} />
    </View>
  );
}
