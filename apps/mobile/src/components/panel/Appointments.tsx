import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { nowLocalIso, tl } from '@/lib/format';
import { useSegment } from '@/lib/segment';
import { Button, Field, Loading, Notice, Row, T } from '../ui';
import { Box, BoxTitle, DayStrip, Result, SmallButton, TimeField, confirmThen, dateLabel, hm, useAction, useLoad } from './common';
import type { PanelAppt } from './Today';

const STATUS: Record<string, string> = {
  pending: 'Onay bekliyor', accepted: 'Onaylı', completed: 'Tamamlandı', cancelled: 'İptal', rejected: 'Reddedildi', no_show: 'Gelmedi',
};
type Data = { day: string; appointments: PanelAppt[]; services: { id: string; name: string }[]; staff: { id: string; name: string }[] };

// "Randevular" sekmesi — gün seçimi, o günün randevuları, telefonla gelen randevuyu ekleme
export function Appointments({ shopId }: { shopId: string }) {
  const { theme: th } = useSegment();
  const [day, setDay] = useState(nowLocalIso().slice(0, 10));
  const { data, error, reload } = useLoad<Data>(`/api/m/panel/${shopId}/randevular?gun=${day}`);
  const act = useAction(reload);
  const setStatus = (id: string, status: string) => act.run(`/api/m/panel/randevu/${id}`, 'POST', { status });

  return (
    <View style={{ gap: 16 }}>
      <DayStrip value={day} onChange={setDay} days={30} from={-1} />
      <Result {...act.res} />
      {error && !data ? <Notice kind="error" text={error} /> : !data ? <Loading /> : (<>
        <Box>
          <T size={17} bold>{dateLabel(data.day)} · {data.appointments.length} randevu</T>
          {data.appointments.length === 0 ? <T size={14} muted>Bu gün için randevu yok.</T> : (
            <View>
              {data.appointments.map((a, i) => (
                <View key={a.id} style={{ paddingVertical: 12, gap: 8, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: th.line }}>
                  <View>
                    <T bold>{hm(a.start)}–{hm(a.end)} · {a.customerName} <T size={12} muted>({STATUS[a.status] ?? a.status}{a.source === 'phone' ? ', telefon' : ''})</T></T>
                    <T size={14} muted>{a.services} · {a.staffName} · {tl(a.price)}{a.customerPhone ? ` · ${a.customerPhone}` : ''}{a.note ? ` · “${a.note}”` : ''}</T>
                  </View>
                  <Row style={{ flexWrap: 'wrap' }}>
                    {a.customerPhone ? <SmallButton title="Ara" onPress={() => Linking.openURL(`tel:${a.customerPhone!.replace(/[^\d+]/g, '')}`)} /> : null}
                    {a.status === 'pending' && <>
                      <SmallButton title="Onayla" variant="success" disabled={act.busy} onPress={() => setStatus(a.id, 'accepted')} />
                      <SmallButton title="Reddet" variant="danger" disabled={act.busy} onPress={() => confirmThen('Reddedilsin mi?', () => setStatus(a.id, 'rejected'))} />
                    </>}
                    {a.status === 'accepted' && <>
                      <SmallButton title="Tamamlandı" variant="success" disabled={act.busy} onPress={() => setStatus(a.id, 'completed')} />
                      <SmallButton title="Gelmedi" disabled={act.busy} onPress={() => setStatus(a.id, 'no_show')} />
                      <SmallButton title="İptal" variant="danger" disabled={act.busy} onPress={() => confirmThen('Randevu iptal edilsin mi? Müşteriye bildirim gider.', () => setStatus(a.id, 'cancelled'))} />
                    </>}
                  </Row>
                </View>
              ))}
            </View>
          )}
        </Box>

        <Box>
          <BoxTitle sub="Arayan müşterinin randevusunu buradan girin; doğrudan onaylı olarak kaydedilir.">Telefonla gelen randevuyu ekle</BoxTitle>
          {data.services.length && data.staff.length
            ? <PhoneBookingForm shopId={shopId} day={day} services={data.services} staff={data.staff} onDone={reload} />
            : <T size={14} muted>Önce hizmet ve personel ekleyin.</T>}
        </Box>
      </>)}
    </View>
  );
}

function PhoneBookingForm({ shopId, day, services, staff, onDone }: { shopId: string; day: string; services: { id: string; name: string }[]; staff: { id: string; name: string }[]; onDone: () => void }) {
  const { theme: th } = useSegment();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [staffId, setStaffId] = useState(staff[0].id);
  const [date, setDate] = useState(day);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const act = useAction(onDone);
  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <Pressable key={key} onPress={onPress} style={{ borderRadius: 10, borderWidth: 1, borderColor: on ? th.primary : th.line, backgroundColor: on ? th.surface2 : th.surface, paddingHorizontal: 12, paddingVertical: 7 }}>
      <T size={14} bold={on}>{on ? '✓ ' : ''}{label}</T>
    </Pressable>
  );
  const save = async () => {
    const ok = await act.run(`/api/m/panel/${shopId}/randevular`, 'POST', { customerName: name, customerPhone: phone, serviceIds: picked, staffId, date, time, note });
    if (ok) { setName(''); setPhone(''); setPicked([]); setTime(''); setNote(''); }
  };
  return (
    <View style={{ gap: 12 }}>
      <Result {...act.res} />
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Field label="Müşteri adı" value={name} onChangeText={setName} /></View>
        <View style={{ flex: 1 }}><Field label="Telefonu" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></View>
      </Row>
      <View style={{ gap: 6 }}>
        <T size={14} bold>Hizmet</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {services.map((s) => chip(picked.includes(s.id), s.name, () => setPicked(picked.includes(s.id) ? picked.filter((x) => x !== s.id) : [...picked, s.id]), s.id))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <T size={14} bold>Personel</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {staff.map((s) => chip(staffId === s.id, s.name, () => setStaffId(s.id), s.id))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <T size={14} bold>Gün</T>
        <DayStrip value={date} onChange={setDate} days={60} />
      </View>
      <Row style={{ alignItems: 'flex-end' }}>
        <TimeField label="Saat" value={time} onChange={setTime} placeholder="14:30" />
        <View style={{ flex: 1 }}><Field label="Not" value={note} onChangeText={setNote} maxLength={500} /></View>
      </Row>
      <Button title="Randevuyu ekle" loading={act.busy} onPress={save} />
    </View>
  );
}
