import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { nowLocalIso } from '@/lib/format';
import { useSegment } from '@/lib/segment';
import { Button, Field, Loading, Notice, Row, T } from '../ui';
import { Box, BoxTitle, DayStrip, Result, SmallButton, dateLabel, useAction, useLoad } from './common';

type Closure = { id: string; startDate: string; endDate: string; reason: string | null };

// "Kapalı günler" sekmesi (yalnızca sahip): bayram, tatil, tadilat
export function Closures({ shopId }: { shopId: string }) {
  const { theme: th } = useSegment();
  const today = nowLocalIso().slice(0, 10);
  const { data, error, reload } = useLoad<{ closures: Closure[] }>(`/api/m/panel/${shopId}/kapali`);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [reason, setReason] = useState('');
  const add = useAction(reload);
  const del = useAction(reload);

  return (
    <View style={{ gap: 16 }}>
      <Box>
        <BoxTitle sub={'Bayram, tatil, tadilat… O günlerde randevu alınamaz; sayfanızda "Bugün kapalı" yazar.'}>Kapalı gün ekle</BoxTitle>
        <Result {...add.res} />
        <T size={14} bold>Başlangıç</T>
        <DayStrip value={start} onChange={(d) => { setStart(d); if (end < d) setEnd(d); }} days={365} />
        <T size={14} bold>Bitiş</T>
        <DayStrip value={end} onChange={setEnd} days={365} />
        <Field label="Neden" value={reason} onChangeText={setReason} placeholder="Örn. Bayram tatili" maxLength={100} />
        <Button title="Ekle" loading={add.busy} onPress={async () => {
          const ok = await add.run(`/api/m/panel/${shopId}/kapali`, 'POST', { startDate: start, endDate: end < start ? start : end, reason });
          if (ok) setReason('');
        }} />
      </Box>
      <Box>
        <T size={17} bold>Planlanan kapalı günler</T>
        <Result {...del.res} />
        {error && !data ? <Notice kind="error" text={error} /> : !data ? <Loading /> : data.closures.length === 0 ? <T size={14} muted>Planlanan kapalı gün yok.</T> : (
          <View>
            {data.closures.map((c, i) => (
              <Row key={c.id} style={{ justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: th.line }}>
                <T size={14} style={{ flex: 1 }}>
                  {dateLabel(c.startDate, true)}{c.endDate !== c.startDate ? ` – ${dateLabel(c.endDate, true)}` : ''}
                  {c.reason ? <T size={14} muted> · {c.reason}</T> : null}
                </T>
                <SmallButton title="Kaldır" variant="danger" disabled={del.busy} onPress={() => del.run(`/api/m/panel/kapali/${c.id}`, 'DELETE')} />
              </Row>
            ))}
          </View>
        )}
      </Box>
    </View>
  );
}
