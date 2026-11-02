import { useEffect } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { localLabel, tl } from '@/lib/format';
import { useSegment } from '@/lib/segment';
import { Loading, Notice, Row, T } from '../ui';
import { Box, Result, SmallButton, confirmThen, hm, useAction, useLoad } from './common';

export type PanelAppt = {
  id: string; status: string; source: string; start: string; end: string; customerName: string; customerPhone: string | null;
  price: number; note: string | null; staffId: string; staffName: string; services: string;
};
type TodayData = {
  stats: { completed: number; revenue: number; uniqueCustomers: number; noShows: number } | null;
  pending: PanelAppt[]; today: PanelAppt[];
};

// "Bugün" sekmesi — sitedeki /panel/[dükkân] ana sayfası (20 saniyede bir yenilenir)
export function Today({ shopId }: { shopId: string }) {
  const { theme: th } = useSegment();
  const { data, error, reload } = useLoad<TodayData>(`/api/m/panel/${shopId}`);
  const act = useAction(reload);
  useEffect(() => { const t = setInterval(reload, 20_000); return () => clearInterval(t); }, [reload]);

  if (error && !data) return <Notice kind="error" text={error} />;
  if (!data) return <Loading />;
  const setStatus = (id: string, status: string) => act.run(`/api/m/panel/randevu/${id}`, 'POST', { status });
  const sep = (i: number) => ({ paddingVertical: 12, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: th.line, gap: 8 });

  return (
    <View style={{ gap: 16 }}>
      <Result {...act.res} />
      {data.stats && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {([
            ['Son 7 gün randevu', String(data.stats.completed)],
            ['Son 7 gün kazanç', tl(data.stats.revenue)],
            ['Farklı müşteri', String(data.stats.uniqueCustomers)],
            ['Gelmeyen', String(data.stats.noShows)],
          ] as const).map(([l, v]) => (
            <Box key={l} style={{ width: '48.4%', gap: 2 }}>
              <T size={24} style={{ fontWeight: '800' }}>{v}</T>
              <T size={12} muted>{l}</T>
            </Box>
          ))}
        </View>
      )}

      {/* Bekleyen randevu talepleri */}
      <Box>
        <Row gap={8}>
          <T size={17} bold>Onay bekleyen randevular</T>
          {data.pending.length > 0 && <View style={{ borderRadius: 999, backgroundColor: th.accent, paddingHorizontal: 8 }}><T size={14} bold color={th.onAccent}>{data.pending.length}</T></View>}
        </Row>
        {data.pending.length === 0 ? <T size={14} muted>Bekleyen talep yok.</T> : (
          <View>
            {data.pending.map((a, i) => (
              <View key={a.id} style={sep(i)}>
                <View>
                  <T bold>{localLabel(a.start)} · {a.staffName}</T>
                  <T size={14} muted>{a.customerName} · {a.services} · {tl(a.price)}{a.note ? ` · “${a.note}”` : ''}</T>
                </View>
                <Row>
                  <SmallButton title="Onayla" variant="success" disabled={act.busy} onPress={() => setStatus(a.id, 'accepted')} />
                  <SmallButton title="Reddet" variant="danger" disabled={act.busy} onPress={() => confirmThen('Randevu reddedilsin mi?', () => setStatus(a.id, 'rejected'))} />
                </Row>
              </View>
            ))}
          </View>
        )}
      </Box>

      {/* Bugünün randevuları */}
      <Box>
        <T size={17} bold>Bugünün randevuları</T>
        {data.today.length === 0 ? <T size={14} muted>Bugün onaylı randevu yok.</T> : (
          <View>
            {data.today.map((a, i) => (
              <View key={a.id} style={sep(i)}>
                <View>
                  <T bold>{hm(a.start)}–{hm(a.end)} · {a.customerName}{a.source === 'phone' ? <T size={12} muted> (telefon)</T> : null}</T>
                  <T size={14} muted>{a.services} · {a.staffName} · {tl(a.price)}</T>
                </View>
                <Row style={{ flexWrap: 'wrap' }}>
                  {a.customerPhone ? <SmallButton title="Ara" onPress={() => Linking.openURL(`tel:${a.customerPhone!.replace(/[^\d+]/g, '')}`)} /> : null}
                  <SmallButton title="Tamamlandı" variant="success" disabled={act.busy} onPress={() => setStatus(a.id, 'completed')} />
                  <SmallButton title="Gelmedi" variant="danger" disabled={act.busy} onPress={() => setStatus(a.id, 'no_show')} />
                </Row>
              </View>
            ))}
          </View>
        )}
      </Box>
    </View>
  );
}
