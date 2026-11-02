import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, errorText, imageUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { initials, nextDays, tl } from '@/lib/format';
import { useSegment } from '@/lib/segment';
import type { ShopPage, Slot } from '@/lib/types';
import { Button, Dashed, Field, Loading, Notice, Row, Screen, T, Title } from '@/components/ui';

const ANY = 'farketmez';

// Randevu: 1) Hizmet  2) Personel (veya fark etmez)  3) Gün ve saat  → Onayla
// (sitedeki BookingWizard ile aynı adımlar ve metinler)
export default function Randevu() {
  const { id, personel } = useLocalSearchParams<{ id: string; personel?: string }>();
  const { theme: th } = useSegment();
  const { user } = useAuth();
  const [page, setPage] = useState<ShopPage | null>(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [who, setWho] = useState<string | null>(null);
  const days = useMemo(() => nextDays(14), []);
  const [day, setDay] = useState(days[0].date);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [bookErr, setBookErr] = useState('');

  useEffect(() => {
    api<ShopPage>(`/api/m/dukkan/${id}`).then((p) => {
      setPage(p);
      // "Tekrar randevu al": aynı personel seçili gelir; tek personel varsa o seçilir
      if (personel && p.staff.some((x) => x.id === personel)) setWho(personel);
      else if (p.staff.length === 1) setWho(p.staff[0].id);
    }).catch((e) => setError(errorText(e)));
  }, [id, personel]);

  // Hizmet, personel veya gün değişince boş saatleri getir
  useEffect(() => {
    setSlot(null);
    if (!picked.length || !who) { setSlots(null); return; }
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ dukkan: id, personel: who, tarih: day, hizmetler: picked.join(',') });
    api<Slot[]>(`/api/randevu/saatler?${qs}`, { auth: false })
      .then((rows) => { if (!cancelled) setSlots(rows); })
      .catch(() => { if (!cancelled) setSlots([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, picked, who, day]);

  if (error) return <Screen edges={[]}><Notice kind="error" text={error} /></Screen>;
  if (!page) return <Screen edges={[]}><Loading /></Screen>;
  const { shop, services, staff } = page;
  const chosen = services.filter((x) => picked.includes(x.id));
  const total = chosen.reduce((a, x) => a + x.price, 0);

  const num = (n: number, done: boolean) => (
    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? th.open : th.primary }}>
      {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : <T size={14} bold color={th.onPrimary}>{n}</T>}
    </View>
  );
  const step = (n: number, done: boolean, title: string, enabled: boolean, children: ReactNode) => (
    <View pointerEvents={enabled ? 'auto' : 'none'} style={{ borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, padding: 16, gap: 12, opacity: enabled ? 1 : 0.5 }}>
      <Row gap={8}>{num(n, done)}<T size={17} bold>{title}</T></Row>
      {children}
    </View>
  );
  const option = (on: boolean, onPress: () => void, children: ReactNode, key?: string) => (
    <Pressable key={key} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: on ? th.primary : th.line, backgroundColor: on ? th.surface2 : th.surface }}>
      {children}
    </Pressable>
  );

  const book = async () => {
    if (!slot) return;
    if (!user) return router.push('/giris');
    setSaving(true); setBookErr('');
    try {
      await api('/api/m/randevu', { method: 'POST', body: { shopId: id, staffId: slot.staffId, serviceIds: picked, start: slot.start, note: note.trim() || undefined } });
      router.dismissAll();
      router.replace({ pathname: '/randevular', params: { yeni: '1' } });
    } catch (e) {
      setBookErr(errorText(e));
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
      {!user && (
        <View style={{ borderRadius: 12, backgroundColor: th.surface2, paddingHorizontal: 12, paddingVertical: 10 }}>
          <T size={14}>
            Seçimlerinizi yapın; onaylarken giriş yapmanız istenecek. Hesabınız yoksa 1 dakikada{' '}
            <T size={14} bold style={{ textDecorationLine: 'underline' }} >kayıt olabilirsiniz</T>.
          </T>
          <Pressable onPress={() => router.push('/kayit')} style={{ marginTop: 6 }}><T size={14} bold color={th.accent}>Kayıt ol →</T></Pressable>
        </View>
      )}

      {!services.length || !staff.length ? (
        <Dashed text="Bu dükkân henüz hizmet veya personel eklemedi. Telefonla randevu alabilirsiniz." />
      ) : (<>
        {/* 1) Hizmet */}
        {step(1, picked.length > 0, 'Hizmet seç', true, services.map((x) => {
          const on = picked.includes(x.id);
          return option(on, () => setPicked(on ? picked.filter((p) => p !== x.id) : [...picked, x.id]), (
            <>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? th.primary : th.muted} />
              <View style={{ flex: 1 }}>
                <T bold>{x.name}</T>
                <T size={14} muted>{x.minutes} dk{x.description ? ` · ${x.description}` : ''}</T>
              </View>
              <T bold>{tl(x.price)}</T>
            </>
          ), x.id);
        }))}

        {/* 2) Personel */}
        {step(2, !!who, 'Personel seç', picked.length > 0, (<>
          {staff.length > 1 && option(who === ANY, () => setWho(ANY), (
            <>
              <Ionicons name="people-outline" size={24} color={th.accent} />
              <View><T bold>Fark etmez</T><T size={12} muted>En erken boş olan</T></View>
            </>
          ))}
          {staff.map((p) => option(who === p.id, () => setWho(p.id), (
            <>
              {p.photo ? <Image source={{ uri: imageUrl(p.photo)! }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                : <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: th.primary, alignItems: 'center', justifyContent: 'center' }}><T bold color={th.onPrimary}>{initials(p.name, 1)}</T></View>}
              <View style={{ flex: 1 }}>
                <Row gap={4}><T bold>{p.name}</T>{p.isCertified && <Ionicons name="checkmark-circle" size={16} color={th.accent} accessibilityLabel="Belgeli" />}</Row>
                {p.title ? <T size={12} muted>{p.title}</T> : null}
              </View>
            </>
          ), p.id))}
        </>))}

        {/* 3) Gün ve saat */}
        {step(3, !!slot, 'Gün ve saat seç', picked.length > 0 && !!who, (<>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map((d) => {
              const on = d.date === day;
              return (
                <Pressable key={d.date} onPress={() => setDay(d.date)} style={{ borderRadius: 12, borderWidth: 1, borderColor: on ? th.primary : th.line, backgroundColor: on ? th.primary : th.surface, paddingHorizontal: 12, paddingVertical: 9 }}>
                  <T size={14} bold color={on ? th.onPrimary : th.text}>{d.top === 'Bugün' || d.top === 'Yarın' ? d.top : `${d.top} ${d.bottom}`}</T>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ minHeight: 56 }}>
            {loading ? (
              <Row gap={8}><ActivityIndicator size="small" color={th.muted} /><T muted>Boş saatler yükleniyor…</T></Row>
            ) : slots && slots.length === 0 ? (
              <T muted>Bu gün için boş saat yok. Başka bir gün seçin.</T>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {slots?.map((sl) => {
                  const on = slot?.start === sl.start;
                  return (
                    <Pressable key={sl.start} onPress={() => setSlot(sl)} style={{ width: '23%', borderRadius: 10, borderWidth: 1, borderColor: on ? th.primary : th.line, backgroundColor: on ? th.primary : th.surface, paddingVertical: 9, alignItems: 'center' }}>
                      <T size={14} bold color={on ? th.onPrimary : th.text}>{sl.start.slice(11, 16)}</T>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </>))}

        {/* Onay */}
        {slot && (
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: th.primary, backgroundColor: th.surface, padding: 16, gap: 10 }}>
            <T size={17} bold>Randevu özeti</T>
            <View style={{ gap: 3 }}>
              <T size={14}><T size={14} bold>Hizmet:</T> {chosen.map((x) => x.name).join(', ')}</T>
              <T size={14}><T size={14} bold>Personel:</T> {slot.staffName ?? staff.find((p) => p.id === slot.staffId)?.name}</T>
              <T size={14}><T size={14} bold>Zaman:</T> {(() => { const d = days.find((x) => x.date === day); return d ? (d.top === 'Bugün' || d.top === 'Yarın' ? d.top : `${d.top} ${d.bottom}`) : day; })()}, {slot.start.slice(11, 16)} ({slot.minutes} dk)</T>
              <T size={14}><T size={14} bold>Tutar:</T> {tl(total)} <T size={14} muted>(ödeme dükkânda)</T></T>
            </View>
            <Field label="Not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={500} placeholder="Örn. kısa olsun, yanları sıfır" />
            {bookErr ? <Notice kind="error" text={bookErr} /> : null}
            <Button title="Randevuyu onayla" loading={saving} onPress={book} />
            <T size={12} muted>Randevunuz dükkânın onayına gönderilir; onaylanınca bildirim alırsınız.</T>
          </View>
        )}
      </>)}
    </Screen>
  );
}
