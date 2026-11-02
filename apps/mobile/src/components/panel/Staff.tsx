import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { api, errorText, imageUrl } from '@/lib/api';
import { initials, nowLocalIso } from '@/lib/format';
import { useSegment } from '@/lib/segment';
import { alpha } from '@/lib/theme';
import { Button, Field, Loading, Notice, Row, T } from '../ui';
import { Box, BoxTitle, Check, DayStrip, Result, SmallButton, TimeField, WEEKDAYS, dateLabel, useAction, useLoad } from './common';

type DayOff = { id: string; weekday: number | null; startDate: string | null; endDate: string | null; note: string | null };
type Person = {
  id: string; name: string; title: string | null; photo: string | null; phone: string | null; showPhone: boolean;
  isActive: boolean; hasAccount: boolean; breakStart: string | null; breakEnd: string | null; daysOff: DayOff[];
};

// "Personel" sekmesi (yalnızca sahip): personel, davet kodu, günlük mola, izinler
export function Staff({ shopId }: { shopId: string }) {
  const { theme: th } = useSegment();
  const { data, error, reload } = useLoad<{ staff: Person[] }>(`/api/m/panel/${shopId}/personel`);
  if (error && !data) return <Notice kind="error" text={error} />;
  if (!data) return <Loading />;

  return (
    <View style={{ gap: 16 }}>
      <Box>
        <BoxTitle sub="Siz de koltukta çalışıyorsanız kendinizi de ekleyin; müşteriler randevuyu kişiye göre alır.">Personel ekle</BoxTitle>
        <StaffForm shopId={shopId} onDone={reload} />
      </Box>
      {data.staff.map((s) => (
        <Box key={s.id} style={{ opacity: s.isActive ? 1 : 0.6 }}>
          <Row gap={12} style={{ alignItems: 'flex-start' }}>
            {s.photo ? <Image source={{ uri: imageUrl(s.photo)! }} style={{ width: 48, height: 48, borderRadius: 24 }} />
              : <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: th.primary, alignItems: 'center', justifyContent: 'center' }}><T size={18} bold color={th.onPrimary}>{initials(s.name, 1)}</T></View>}
            <View style={{ flex: 1 }}>
              <T size={17} bold>{s.name}{!s.isActive ? <T size={14} muted> (pasif)</T> : null}</T>
              <T size={14} muted>{s.title ?? 'Personel'}{s.phone ? ` · ${s.phone}` : ''} · {s.hasAccount ? 'Bermatik hesabı bağlı' : 'Hesabı bağlı değil'}</T>
            </View>
          </Row>
          {!s.hasAccount && <InviteButton staffId={s.id} />}
          <EditToggle shopId={shopId} person={s} onDone={reload} />
          <View style={{ borderRadius: 12, backgroundColor: th.surface2, padding: 12, gap: 8 }}>
            <T bold>Günlük mola</T>
            <BreakForm staffId={s.id} start={s.breakStart} end={s.breakEnd} onDone={reload} />
          </View>
          <View style={{ borderRadius: 12, backgroundColor: th.surface2, padding: 12, gap: 8 }}>
            <T bold>İzinler</T>
            <DaysOff list={s.daysOff} onDone={reload} />
            <DayOffForm staffId={s.id} onDone={reload} />
          </View>
        </Box>
      ))}
    </View>
  );
}

function EditToggle({ shopId, person, onDone }: { shopId: string; person: Person; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <Pressable onPress={() => setOpen(!open)} hitSlop={6}><T size={14} bold style={{ textDecorationLine: 'underline' }}>{open ? 'Kapat' : 'Bilgileri düzenle'}</T></Pressable>
      {open && <StaffForm shopId={shopId} initial={person} onDone={onDone} />}
    </View>
  );
}

function StaffForm({ shopId, initial, onDone }: { shopId: string; initial?: Person; onDone: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [showPhone, setShowPhone] = useState(initial?.showPhone ?? false);
  const [passive, setPassive] = useState(initial ? !initial.isActive : false);
  const act = useAction(onDone);
  const save = async () => {
    const ok = await act.run(`/api/m/panel/${shopId}/personel`, 'POST', { staffId: initial?.id, name, title, phone, showPhone, isActive: !passive });
    if (ok && !initial) { setName(''); setTitle(''); setPhone(''); setShowPhone(false); }
  };
  return (
    <View style={{ gap: 12 }}>
      <Result {...act.res} />
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Field label="Adı" value={name} onChangeText={setName} placeholder="Örn. Mehmet Usta" maxLength={60} /></View>
        <View style={{ flex: 1 }}><Field label="Unvanı" value={title} onChangeText={setTitle} placeholder="Usta, kalfa, stilist…" maxLength={60} /></View>
      </Row>
      <Field label="Telefonu" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={40} />
      <Check value={showPhone} onChange={setShowPhone} label="Telefonu müşterilere göster" />
      {initial && <Check value={passive} onChange={setPassive} label="Pasif (artık çalışmıyor)" />}
      <Button title={initial ? 'Kaydet' : 'Personeli ekle'} loading={act.busy} onPress={save} />
    </View>
  );
}

// Personelin kendi hesabıyla panele girebilmesi için davet kodu
function InviteButton({ staffId }: { staffId: string }) {
  const { theme: th } = useSegment();
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (code) {
    return (
      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: th.accent, backgroundColor: alpha(th.accent, 0.1), padding: 12, gap: 4 }}>
        <T size={14}>Davet kodu: <T size={20} bold style={{ letterSpacing: 3 }}>{code}</T></T>
        <T size={14} muted>Personeliniz Bermatik'e kayıt olup <T size={14} bold>İşletme paneli</T>nde bu kodu girsin.</T>
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'flex-start', gap: 4 }}>
      <SmallButton title="Davet kodu oluştur" disabled={busy} onPress={async () => {
        setBusy(true); setErr('');
        try {
          const r = await api<{ code: string | null }>(`/api/m/panel/personel/${staffId}`, { method: 'POST', body: { islem: 'davet' } });
          setCode(r.code);
        } catch (e) {
          setErr(errorText(e));
        } finally {
          setBusy(false);
        }
      }} />
      {err ? <T size={12} color={th.closed}>{err}</T> : null}
    </View>
  );
}

function BreakForm({ staffId, start, end, onDone }: { staffId: string; start: string | null; end: string | null; onDone: () => void }) {
  const [s, setS] = useState(start ?? '');
  const [e, setE] = useState(end ?? '');
  const act = useAction(onDone);
  return (
    <View style={{ gap: 8 }}>
      <Result {...act.res} />
      <Row style={{ alignItems: 'flex-end' }}>
        <TimeField label="Başlangıç" value={s} onChange={setS} placeholder="13:00" />
        <TimeField label="Bitiş" value={e} onChange={setE} placeholder="14:00" />
        <SmallButton title="Kaydet" variant="primary" disabled={act.busy} onPress={() => act.run(`/api/m/panel/personel/${staffId}`, 'POST', { islem: 'mola', start: s, end: e })} />
      </Row>
      <T size={12} muted>Bu saatlerde randevu verilmez. Molayı kaldırmak için iki kutuyu boşaltıp kaydedin.</T>
    </View>
  );
}

function DaysOff({ list, onDone }: { list: DayOff[]; onDone: () => void }) {
  const act = useAction(onDone);
  if (!list.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <Result {...act.res} />
      {list.map((o) => (
        <Row key={o.id} style={{ justifyContent: 'space-between' }}>
          <T size={14} style={{ flex: 1 }}>
            {o.weekday ? `Her ${WEEKDAYS[o.weekday - 1]}` : o.startDate === o.endDate ? dateLabel(o.startDate!) : `${dateLabel(o.startDate!)} – ${dateLabel(o.endDate!)}`}
            {o.note ? <T size={14} muted> · {o.note}</T> : null}
          </T>
          <SmallButton title="Sil" variant="danger" disabled={act.busy} onPress={() => act.run(`/api/m/panel/izin/${o.id}`, 'DELETE')} />
        </Row>
      ))}
    </View>
  );
}

function DayOffForm({ staffId, onDone }: { staffId: string; onDone: () => void }) {
  const { theme: th } = useSegment();
  const today = nowLocalIso().slice(0, 10);
  const [kind, setKind] = useState<'weekly' | 'dates'>('weekly');
  const [weekday, setWeekday] = useState(1);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [note, setNote] = useState('');
  const act = useAction(onDone);
  const radio = (on: boolean, label: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: on ? th.primary : th.muted, alignItems: 'center', justifyContent: 'center' }}>
        {on ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th.primary }} /> : null}
      </View>
      <T size={14}>{label}</T>
    </Pressable>
  );
  const add = async () => {
    const ok = await act.run(`/api/m/panel/personel/${staffId}`, 'POST', kind === 'weekly'
      ? { islem: 'izin', weekday, note }
      : { islem: 'izin', startDate, endDate: endDate < startDate ? startDate : endDate, note });
    if (ok) setNote('');
  };
  return (
    <View style={{ gap: 10 }}>
      <Result {...act.res} />
      <Row gap={16}>{radio(kind === 'weekly', 'Haftalık izin günü', () => setKind('weekly'))}{radio(kind === 'dates', 'Tarih aralığı', () => setKind('dates'))}</Row>
      {kind === 'weekly' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {WEEKDAYS.map((w, i) => (
            <Pressable key={w} onPress={() => setWeekday(i + 1)} style={{ borderRadius: 10, borderWidth: 1, borderColor: weekday === i + 1 ? th.primary : th.line, backgroundColor: weekday === i + 1 ? th.primary : th.surface, paddingHorizontal: 10, paddingVertical: 6 }}>
              <T size={13} bold color={weekday === i + 1 ? th.onPrimary : th.text}>{w}</T>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <T size={13}>Başlangıç</T>
          <DayStrip value={startDate} onChange={(d) => { setStartDate(d); if (endDate < d) setEndDate(d); }} days={120} />
          <T size={13}>Bitiş</T>
          <DayStrip value={endDate} onChange={setEndDate} days={120} />
        </View>
      )}
      <Field label="Not" value={note} onChangeText={setNote} placeholder="Not (ör. yıllık izin)" maxLength={100} />
      <SmallButton title="Ekle" variant="primary" disabled={act.busy} onPress={add} />
    </View>
  );
}
