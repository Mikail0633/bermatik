import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { tl } from '@/lib/format';
import { useSegment } from '@/lib/segment';
import { Button, Field, Loading, Notice, Row, T } from '../ui';
import { Box, BoxTitle, Result, SmallButton, confirmThen, useAction, useLoad } from './common';

type Category = { id: number; name: string; description: string | null };
type Svc = { id: string; categoryId: number; category: string; name: string; description: string | null; price: number; minutes: number; isActive: boolean; sortOrder: number };
type Data = { services: Svc[]; categories: Category[] };

// "Hizmetler ve fiyatlar" sekmesi (yalnızca sahip)
export function Services({ shopId }: { shopId: string }) {
  const { theme: th } = useSegment();
  const { data, error, reload } = useLoad<Data>(`/api/m/panel/${shopId}/hizmetler`);
  const [open, setOpen] = useState<string | null>(null);
  const del = useAction(reload);
  if (error && !data) return <Notice kind="error" text={error} />;
  if (!data) return <Loading />;

  return (
    <View style={{ gap: 16 }}>
      <Box>
        <BoxTitle sub="Fiyatları siz belirlersiniz. Açıklama yazmazsanız Bermatik'in hazır açıklaması gösterilir.">Yeni hizmet ekle</BoxTitle>
        <ServiceForm shopId={shopId} categories={data.categories} onDone={reload} />
      </Box>
      <Box>
        <T size={17} bold>Fiyat listeniz</T>
        <Result {...del.res} />
        {data.services.length === 0 ? <T size={14} muted>Henüz hizmet eklemediniz.</T> : (
          <View>
            {data.services.map((s, i) => (
              <View key={s.id} style={{ paddingVertical: 12, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: th.line, gap: 10 }}>
                <Pressable onPress={() => setOpen(open === s.id ? null : s.id)}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <T style={{ flex: 1 }}><T bold>{s.name}</T> <T size={14} muted>· {s.category} · {s.minutes} dk{!s.isActive ? ' · pasif' : ''}</T></T>
                    <Row gap={10}><T bold>{tl(s.price)}</T><T size={14} style={{ textDecorationLine: 'underline' }}>{open === s.id ? 'Kapat' : 'Düzenle'}</T></Row>
                  </Row>
                </Pressable>
                {open === s.id && (
                  <View style={{ borderRadius: 12, backgroundColor: th.surface2, padding: 12, gap: 10 }}>
                    <ServiceForm shopId={shopId} categories={data.categories} initial={s} onDone={reload} />
                    <SmallButton title="Hizmeti kaldır" variant="danger" disabled={del.busy} onPress={() => confirmThen('Hizmet kaldırılsın mı?', () => del.run(`/api/m/panel/hizmet/${s.id}`, 'DELETE'))} />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </Box>
    </View>
  );
}

function ServiceForm({ shopId, categories, initial, onDone }: { shopId: string; categories: Category[]; initial?: Svc; onDone: () => void }) {
  const { theme: th } = useSegment();
  const [cat, setCat] = useState(initial?.categoryId ?? categories[0]?.id);
  const [name, setName] = useState(initial?.name ?? categories[0]?.name ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price).replace('.', ',') : '');
  const [minutes, setMinutes] = useState(String(initial?.minutes ?? 30));
  const [active, setActive] = useState(initial?.isActive ?? true);
  const [desc, setDesc] = useState(initial?.description ?? '');
  const act = useAction(onDone);
  const hint = categories.find((c) => c.id === cat)?.description;

  const save = async () => {
    const ok = await act.run(`/api/m/panel/${shopId}/hizmetler`, 'POST', {
      serviceId: initial?.id, categoryId: cat, name, price, minutes: Number(minutes), isActive: active, description: desc, sortOrder: initial?.sortOrder ?? 0,
    });
    if (ok && !initial) { setCat(categories[0]?.id); setName(categories[0]?.name ?? ''); setPrice(''); setMinutes('30'); setActive(true); setDesc(''); }
  };
  const chip = (on: boolean, label: string, onPress: () => void, key: string | number) => (
    <Pressable key={key} onPress={onPress} style={{ borderRadius: 10, borderWidth: 1, borderColor: on ? th.primary : th.line, backgroundColor: on ? th.primary : th.surface, paddingHorizontal: 12, paddingVertical: 7 }}>
      <T size={14} bold color={on ? th.onPrimary : th.text}>{label}</T>
    </Pressable>
  );

  return (
    <View style={{ gap: 12 }}>
      <Result {...act.res} />
      <View style={{ gap: 6 }}>
        <T size={14} bold>Kategori</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((c) => chip(cat === c.id, c.name, () => {
            // Ad, eski kategorinin adıyla aynıysa yeni kategorinin adı yazılır (sitedeki gibi)
            if (!initial || name === categories.find((x) => x.id === cat)?.name) setName(c.name);
            setCat(c.id);
          }, c.id))}
        </View>
      </View>
      <Field label="Hizmet adı" value={name} onChangeText={setName} maxLength={80} />
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Field label="Fiyat (TL)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Süre (dk)" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" maxLength={3} /></View>
      </Row>
      <View style={{ gap: 6 }}>
        <T size={14} bold>Durum</T>
        <Row>{chip(active, 'Sitede göster', () => setActive(true), 'on')}{chip(!active, 'Gizle (pasif)', () => setActive(false), 'off')}</Row>
      </View>
      <Field label="Açıklama (isteğe bağlı)" value={desc} onChangeText={setDesc} placeholder={hint ?? ''} maxLength={1000} />
      <Button title={initial ? 'Kaydet' : 'Hizmeti ekle'} loading={act.busy} onPress={save} />
    </View>
  );
}
