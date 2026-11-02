import { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { API_URL, imageUrl } from '@/lib/api';
import { useSegment } from '@/lib/segment';
import { alpha } from '@/lib/theme';
import { Button, Field, Loading, Notice, Row, T } from '../ui';
import { Box, BoxTitle, Check, Result, TimeField, WEEKDAYS, useAction, useLoad } from './common';

type HourRow = { weekday: number; isClosed: boolean; opensAt: string | null; closesAt: string | null };
type Info = {
  name: string; description: string | null; phone: string | null; street: string; buildingNo: string; addressDetail: string | null;
  province: string; district: string; neighborhood: string; isTemporarilyClosed: boolean; showServiceDescriptions: boolean; cover: string | null;
};

// "Bilgiler ve saatler" sekmesi (yalnızca sahip): kapak fotoğrafı, çalışma saatleri, dükkân bilgileri
export function InfoTab({ shopId }: { shopId: string }) {
  const { theme: th } = useSegment();
  const { data, error, reload } = useLoad<{ info: Info; hours: HourRow[]; hasHours: boolean }>(`/api/m/panel/${shopId}/bilgiler`);
  if (error && !data) return <Notice kind="error" text={error} />;
  if (!data) return <Loading />;
  const cover = imageUrl(data.info.cover);
  return (
    <View style={{ gap: 16 }}>
      <Box>
        <BoxTitle sub="Listelerde ve dükkân sayfanızın en üstünde görünür. Dükkânın önünü ya da içini gösteren, yatay ve aydınlık bir fotoğraf seçin.">Kapak fotoğrafı</BoxTitle>
        {cover ? <Image source={{ uri: cover }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12 }} contentFit="cover" /> : <T size={14} muted>Henüz kapak fotoğrafı yok.</T>}
        <Pressable onPress={() => Linking.openURL(`${API_URL}/panel/${shopId}/bilgiler`)}><T size={14} bold color={th.accent}>Fotoğrafı sitede yükle →</T></Pressable>
      </Box>
      <Box>
        <T size={17} bold>Çalışma saatleri</T>
        {!data.hasHours && (
          <View style={{ borderRadius: 12, backgroundColor: alpha(th.accent, 0.15), paddingHorizontal: 12, paddingVertical: 8 }}>
            <T size={14}>Saatlerinizi girin; müşteriler ancak bu saatler içinde randevu alabilir.</T>
          </View>
        )}
        <HoursForm shopId={shopId} initial={data.hours} onDone={reload} />
      </Box>
      <Box>
        <T size={17} bold>Dükkân bilgileri</T>
        <ShopForm shopId={shopId} initial={data.info} onDone={reload} />
      </Box>
    </View>
  );
}

function HoursForm({ shopId, initial, onDone }: { shopId: string; initial: HourRow[]; onDone: () => void }) {
  const [rows, setRows] = useState(initial.map((h) => ({ ...h, opensAt: h.opensAt ?? '', closesAt: h.closesAt ?? '' })));
  useEffect(() => { setRows(initial.map((h) => ({ ...h, opensAt: h.opensAt ?? '', closesAt: h.closesAt ?? '' }))); }, [initial]);
  const act = useAction(onDone);
  const set = (wd: number, patch: Partial<(typeof rows)[number]>) => setRows((cur) => cur.map((r) => (r.weekday === wd ? { ...r, ...patch } : r)));
  // İlk açık günün saatlerini diğer açık günlere kopyala (hızlı doldurma)
  const copyFirst = () => {
    const first = rows.find((r) => !r.isClosed && r.opensAt && r.closesAt);
    if (first) setRows((cur) => cur.map((r) => (r.isClosed ? r : { ...r, opensAt: first.opensAt, closesAt: first.closesAt })));
  };
  return (
    <View style={{ gap: 10 }}>
      <Result {...act.res} />
      {rows.map((r) => (
        <Row key={r.weekday} style={{ alignItems: 'center' }}>
          <T size={14} bold style={{ width: 82 }}>{WEEKDAYS[r.weekday - 1]}</T>
          {r.isClosed ? <T size={14} muted style={{ flex: 1 }}>Kapalı</T> : (
            <Row gap={6} style={{ flex: 1 }}>
              <TimeField value={r.opensAt} onChange={(v) => set(r.weekday, { opensAt: v })} placeholder="09:00" />
              <T muted>–</T>
              <TimeField value={r.closesAt} onChange={(v) => set(r.weekday, { closesAt: v })} placeholder="20:00" />
            </Row>
          )}
          <Check value={r.isClosed} onChange={(v) => set(r.weekday, { isClosed: v })} label="Kapalı" />
        </Row>
      ))}
      <T size={12} muted>Gece yarısına kadar açıksanız kapanışa 24:00 yazın.</T>
      <Pressable onPress={copyFirst} hitSlop={6}><T size={14} style={{ textDecorationLine: 'underline' }}>İlk günün saatlerini tüm açık günlere uygula</T></Pressable>
      <Button title="Saatleri kaydet" loading={act.busy} onPress={() => act.run(`/api/m/panel/${shopId}/bilgiler`, 'POST', { tur: 'saatler', hours: rows })} />
    </View>
  );
}

function ShopForm({ shopId, initial, onDone }: { shopId: string; initial: Info; onDone: () => void }) {
  const { theme: th } = useSegment();
  const [f, setF] = useState({
    name: initial.name, description: initial.description ?? '', phone: initial.phone ?? '', street: initial.street,
    buildingNo: initial.buildingNo === '-' ? '' : initial.buildingNo, addressDetail: initial.addressDetail ?? '',
  });
  const [closed, setClosed] = useState(initial.isTemporarilyClosed);
  const [showDesc, setShowDesc] = useState(initial.showServiceDescriptions);
  const act = useAction(onDone);
  const set = (k: keyof typeof f) => (v: string) => setF((cur) => ({ ...cur, [k]: v }));
  return (
    <View style={{ gap: 12 }}>
      <Result {...act.res} />
      <Field label="Dükkân adı" value={f.name} onChangeText={set('name')} maxLength={100} />
      <Field label="Açıklama" value={f.description} onChangeText={set('description')} multiline maxLength={2000} style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }} />
      <Field label="Dükkân telefonu" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" maxLength={40} />
      <View style={{ gap: 4 }}>
        <T size={14} bold>Konum</T>
        <T size={14} muted>{initial.neighborhood}, {initial.district}/{initial.province}</T>
        <Pressable onPress={() => Linking.openURL(`${API_URL}/panel/${shopId}/bilgiler`)}><T size={13} color={th.accent}>İl, ilçe, mahalle ve harita yerini sitede değiştirin →</T></Pressable>
      </View>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 2 }}><Field label="Cadde / sokak" value={f.street} onChangeText={set('street')} maxLength={120} /></View>
        <View style={{ flex: 1 }}><Field label="Bina no" value={f.buildingNo} onChangeText={set('buildingNo')} maxLength={20} /></View>
      </Row>
      <Field label="Adres tarifi (isteğe bağlı)" value={f.addressDetail} onChangeText={set('addressDetail')} maxLength={200} />
      <Check value={closed} onChange={setClosed} label="Geçici olarak kapalı (randevu alınmaz)" />
      <Check value={showDesc} onChange={setShowDesc} label="Hizmet açıklamalarını müşterilere göster" />
      <Button title="Bilgileri kaydet" loading={act.busy} onPress={() => act.run(`/api/m/panel/${shopId}/bilgiler`, 'POST', { tur: 'bilgi', ...f, isTemporarilyClosed: closed, showServiceDescriptions: showDesc })} />
    </View>
  );
}
