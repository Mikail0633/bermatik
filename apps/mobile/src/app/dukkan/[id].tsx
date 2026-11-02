import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL, api, errorText, imageUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { DAYS, initials, tl } from '@/lib/format';
import { useSegment } from '@/lib/segment';
import type { Hours, ShopPage } from '@/lib/types';
import { Crumbs } from '@/components/Header';
import { OsmMap } from '@/components/OsmMap';
import { OpenBadge, Rating } from '@/components/ShopRow';
import { Button, Loading, Notice, Row, Screen, T, Title } from '@/components/ui';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const longDate = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const close = (t: string | null) => (t === '23:59' ? '24:00' : t);

// Dükkân sayfası — sitedeki dükkân sayfasının (apps/web/src/app/[segment]/[il]/[ilce]/[shop]/page.tsx) düzeni
export default function Dukkan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme: th, t } = useSegment();
  const { user } = useAuth();
  const [data, setData] = useState<ShopPage | null>(null);
  const [error, setError] = useState('');
  const [fav, setFav] = useState(false);
  const [favErr, setFavErr] = useState('');
  const [openDesc, setOpenDesc] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await api<ShopPage>(`/api/m/dukkan/${id}`);
      setData(r); setFav(r.isFavorite);
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <Screen edges={[]}><Notice kind="error" text={error} action={<Button title="Tekrar dene" variant="secondary" onPress={load} />} /></Screen>;
  if (!data) return <Screen edges={[]}><Loading /></Screen>;

  const s = data.shop;
  const webUrl = `${API_URL}/${s.segment}/${s.provinceSlug}/${s.districtSlug}/${s.slug}`;
  const todayIdx = (new Date(Date.now() + 3 * 3_600_000).getUTCDay() + 6) % 7;
  const directions = () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`);
  const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
  const toggleFav = async () => {
    if (!user) return router.push('/giris');
    try {
      const r = await api<{ isFavorite: boolean }>(`/api/m/favori/${s.id}`, { method: 'POST' });
      setFav(r.isFavorite); setFavErr('');
    } catch (e) {
      setFavErr(errorText(e));
    }
  };
  const crumbs = (
    <Crumbs items={[
      { label: t.Shops, onPress: () => router.navigate('/') },
      { label: s.province, onPress: () => router.push({ pathname: '/liste', params: { il: s.provinceSlug, ilAd: s.province } }) },
      { label: s.district, onPress: () => router.push({ pathname: '/liste', params: { il: s.provinceSlug, ilAd: s.province, ilce: s.districtSlug, ilceAd: s.district } }) },
    ]} />
  );
  const header = (
    <Stack.Screen options={{
      title: '',
      headerRight: () => (
        <Pressable onPress={() => Share.share({ message: `${s.name} — Bermatik\n${webUrl}` })} hitSlop={10} accessibilityLabel="Paylaş">
          <Ionicons name="share-social-outline" size={23} color={th.text} />
        </Pressable>
      ),
    }} />
  );
  const favButton = (
    <View style={{ gap: 4 }}>
      <Button
        title={fav ? 'Favorilerimde' : 'Favorilere ekle'} variant="ghost" onPress={toggleFav}
        icon={<Ionicons name={fav ? 'heart' : 'heart-outline'} size={20} color={fav ? th.closed : th.text} />}
      />
      {favErr ? <T size={12} color={th.closed}>{favErr}</T> : null}
    </View>
  );
  const hoursTable = (rows: Hours[], boldToday: boolean) => rows.map((h, i) => {
    const today = boldToday && h.weekday - 1 === todayIdx;
    return (
      <Row key={h.weekday} style={{ justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: !boldToday && i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: th.line }}>
        <T size={14} bold={today} muted={boldToday && !today}>{DAYS[h.weekday - 1]}</T>
        <T size={14} bold={today} muted={boldToday && !today}>{h.isClosed || !h.opensAt ? 'Kapalı' : `${h.opensAt} – ${close(h.closesAt)}`}</T>
      </Row>
    );
  });
  const address = `${s.street}${s.buildingNo && s.buildingNo !== '-' ? ` No: ${s.buildingNo}` : ''}${s.addressDetail ? `, ${s.addressDetail}` : ''}, ${s.neighborhood}, ${s.district}/${s.province}`;
  const map = (h: number) => <OsmMap center={{ lat: s.lat, lng: s.lng }} zoom={16} markers={[{ id: s.id, lat: s.lat, lng: s.lng, title: s.name }]} style={{ height: h }} />;
  const claimBox = (text: string) => (
    <Box style={{ gap: 10 }}>
      <View><T bold>Bu dükkân sizin mi?</T><T size={14} muted>{text}</T></View>
      <Button title="Dükkânı sahiplen" onPress={() => Linking.openURL(`${API_URL}/isletme?sahiplen=${s.id}`)} />
    </Box>
  );

  // ---------------------------------------------------------------
  // Henüz Bermatik'e katılmamış dükkân: yalnızca bilgi, arama ve yol tarifi
  // ---------------------------------------------------------------
  if (!s.isClaimed) {
    return (
      <Screen edges={[]}>
        {header}
        {crumbs}
        <Title>{s.name}</Title>
        <Row gap={4} style={{ alignItems: 'flex-start' }}><Ionicons name="location-outline" size={16} color={th.muted} style={{ marginTop: 2 }} /><T muted style={{ flex: 1 }}>{address}</T></Row>
        {favButton}
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface2, padding: 16, gap: 4 }}>
          <T size={14} bold>Bu {t.shop} henüz Bermatik'e katılmadı.</T>
          <T size={14} muted>
            Randevu talebinizi bırakın, <T size={14} bold>dükkânı biz arayıp sizin için ayarlayalım</T>.{' '}
            {s.source === 'overture' ? 'Bilgiler açık veriden (Overture Maps) alınmıştır, değişmiş olabilir.' : s.source === 'osm' ? "Bilgiler OpenStreetMap'ten alınmıştır, değişmiş olabilir." : 'Bilgiler değişmiş olabilir.'}
          </T>
        </View>
        <Button title="Randevu al" icon={<Ionicons name="calendar-outline" size={20} color={th.onPrimary} />} onPress={() => router.push({ pathname: '/talep/[id]', params: { id: s.id } })} />
        {s.phone ? (
          <Button title="Ara" variant="ghost" icon={<Ionicons name="call-outline" size={20} color={th.text} />} onPress={() => call(s.phone!)} />
        ) : (
          <View style={{ borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: th.line, padding: 14, alignItems: 'center' }}><T size={14} muted>Telefon bilgisi yok</T></View>
        )}
        <Button title="Google Haritalar'da yol tarifi" variant="ghost" icon={<Ionicons name="navigate-outline" size={20} color={th.text} />} onPress={directions} />

        {data.services.length > 0 && (
          <View style={{ gap: 8 }}>
            <T size={20} style={{ fontWeight: '800' }}>Fiyatlar</T>
            <Box style={{ padding: 0 }}>
              {data.services.map((x, i) => (
                <Row key={x.id} style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: th.line }}>
                  <T style={{ flex: 1 }}><T bold>{x.name}</T> <T size={14} muted>· {x.minutes} dk</T></T>
                  <T bold>{tl(x.price)}</T>
                </Row>
              ))}
            </Box>
          </View>
        )}
        {data.hours.length > 0 && (
          <View style={{ gap: 8 }}>
            <T size={20} style={{ fontWeight: '800' }}>Çalışma saatleri</T>
            <Box style={{ paddingVertical: 6 }}>{hoursTable(data.hours, false)}</Box>
          </View>
        )}
        {map(300)}
        {user?.role !== 'customer' && claimBox('Ücretsiz sahiplenin: online randevu, bugünkü sıra ve fiyat listesi hemen açılsın.')}
      </Screen>
    );
  }

  // ---------------------------------------------------------------
  // Bermatik'e katılmış dükkân
  // ---------------------------------------------------------------
  const cover = imageUrl(s.cover);
  return (
    <Screen edges={[]}>
      {header}
      {crumbs}
      {cover ? <Image source={{ uri: cover }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }} contentFit="cover" /> : null}

      {/* Başlık */}
      <View style={{ gap: 8 }}>
        <Row gap={8} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Title>{s.name}</Title></View>
          {s.isCertified && <Ionicons name="checkmark-circle" size={28} color={th.accent} accessibilityLabel="Ustalık belgesi onaylı" style={{ marginTop: 4 }} />}
        </Row>
        <Row gap={12} style={{ flexWrap: 'wrap' }}>
          <OpenBadge shop={s} />
          <Rating value={s.rating} count={s.reviewCount} />
          {s.isCertified && <T size={14} muted>Belgeli usta</T>}
        </Row>
        {s.closedReason ? (
          <View style={{ borderRadius: 10, backgroundColor: th.surface2, paddingHorizontal: 12, paddingVertical: 8 }}>
            <T size={14} bold color={th.closed}>Bugün kapalı: {s.closedReason}</T>
          </View>
        ) : null}
        {s.description ? <T muted>{s.description}</T> : null}
      </View>

      {/* Ana eylemler */}
      <View style={{ gap: 8 }}>
        <Button title="Randevu al" icon={<Ionicons name="calendar-outline" size={20} color={th.onPrimary} />} onPress={() => router.push(`/randevu/${s.id}`)} />
        {s.phone ? <Button title="Ara" variant="ghost" icon={<Ionicons name="call-outline" size={20} color={th.text} />} onPress={() => call(s.phone!)} /> : null}
        {favButton}
      </View>

      {/* Sırayı gör: bugünkü randevular */}
      <Box style={{ gap: 12 }}>
        <Row gap={12}>
          <Ionicons name="people-outline" size={32} color={th.accent} />
          <View style={{ flex: 1 }}>
            <T size={17} bold>Bugünkü sıra</T>
            <T muted>{data.today.length === 0 ? 'Bugün henüz randevu yok.' : `Bugün ${data.today.length} randevu var.`}</T>
          </View>
        </Row>
        <Pressable onPress={() => router.push(`/sira/${s.id}`)} style={({ pressed }) => ({ borderRadius: 12, backgroundColor: th.accent, paddingVertical: 11, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}>
          <T bold color={th.onAccent}>Sırayı gör</T>
        </Pressable>
      </Box>

      {/* Fiyat listesi — açıklamalar açılır/kapanır */}
      <Section title="Hizmetler ve fiyatlar">
        <Box style={{ padding: 0 }}>
          {data.services.map((x, i) => {
            const hasDesc = s.showServiceDescriptions && !!x.description;
            const open = openDesc === x.id;
            return (
              <Pressable key={x.id} disabled={!hasDesc} onPress={() => setOpenDesc(open ? null : x.id)} style={{ padding: 16, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: th.line }}>
                <Row gap={12}>
                  <View style={{ flex: 1 }}>
                    <T bold>{x.name}</T>
                    <T size={14} muted>{x.minutes} dk</T>
                  </View>
                  <T size={18} bold>{tl(x.price)}</T>
                  {hasDesc ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={th.muted} /> : <View style={{ width: 20 }} />}
                </Row>
                {hasDesc && open ? <T size={14} muted style={{ marginTop: 8 }}>{x.description}</T> : null}
              </Pressable>
            );
          })}
        </Box>
      </Section>

      {/* Personel */}
      {data.staff.length > 0 && (
        <Section title="Ekibimiz">
          {data.staff.map((p) => (
            <Box key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {p.photo ? <Image source={{ uri: imageUrl(p.photo)! }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                : <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: th.primary, alignItems: 'center', justifyContent: 'center' }}><T size={18} bold color={th.onPrimary}>{initials(p.name, 1)}</T></View>}
              <View style={{ flex: 1 }}>
                <Row gap={4}><T bold>{p.name}</T>{p.isCertified && <Ionicons name="checkmark-circle" size={16} color={th.accent} accessibilityLabel="Belgeli" />}</Row>
                {p.title ? <T size={14} muted>{p.title}</T> : null}
              </View>
              {p.phone ? (
                <Pressable onPress={() => call(p.phone!)} hitSlop={8} accessibilityLabel={`${p.name}'i ara`} style={{ padding: 8 }}>
                  <Ionicons name="call-outline" size={20} color={th.text} />
                </Pressable>
              ) : null}
            </Box>
          ))}
        </Section>
      )}

      {/* Çalışmalar (galeri) */}
      {data.gallery.length > 0 && (
        <Section title="Çalışmalarımız">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {data.gallery.slice(0, 12).map((g) => (
              <View key={g.id} style={{ width: '48.5%', gap: 4 }}>
                <Pressable onPress={() => Linking.openURL(imageUrl(g.path)!)}>
                  <Image source={{ uri: imageUrl(g.path)! }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} contentFit="cover" />
                </Pressable>
                {g.caption || g.staff ? <T size={12} muted numberOfLines={1}>{[g.caption, g.staff].filter(Boolean).join(' · ')}</T> : null}
              </View>
            ))}
          </View>
        </Section>
      )}

      {/* Yorumlar */}
      {s.reviewsEnabled && (
        <Section title="Yorumlar">
          {data.reviews.length === 0 ? <T muted>Henüz yorum yok. Hizmet alan müşteriler yorum yazabilir.</T> : data.reviews.map((r) => (
            <Box key={r.id} style={{ gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T bold>{r.customer}</T>
                <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${r.rating} yıldız`}>
                  {[1, 2, 3, 4, 5].map((n) => <Ionicons key={n} name="star" size={15} color={n <= r.rating ? th.accent : th.line} />)}
                </View>
              </Row>
              {r.comment ? <T muted>{r.comment}</T> : null}
              <T size={12} muted>{longDate(r.createdAt)}{r.staff ? ` · ${r.staff}` : ''}</T>
            </Box>
          ))}
        </Section>
      )}

      {/* Konum, yol tarifi, çalışma saatleri */}
      {map(260)}
      <Box style={{ gap: 12 }}>
        <Row gap={8} style={{ alignItems: 'flex-start' }}><Ionicons name="location-outline" size={20} color={th.accent} /><T size={14} style={{ flex: 1 }}>{address}</T></Row>
        <Button title="Google Haritalar'da yol tarifi" variant="ghost" icon={<Ionicons name="navigate-outline" size={20} color={th.text} />} onPress={directions} />
      </Box>
      {data.hours.length > 0 && (
        <Box style={{ gap: 4 }}>
          <Row gap={8} style={{ marginBottom: 4 }}><Ionicons name="time-outline" size={20} color={th.accent} /><T bold>Çalışma saatleri</T></Row>
          {hoursTable(data.hours, true)}
        </Box>
      )}
      {s.ownerIsAdmin && user?.role !== 'customer' && user?.role !== 'admin' && claimBox('Sahiplenin; randevuları, fiyatları ve personeli kendiniz yönetin.')}
    </Screen>
  );
}

function Box({ children, style }: { children: ReactNode; style?: object }) {
  const { theme: th } = useSegment();
  return <View style={[{ borderRadius: 16, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, padding: 16, overflow: 'hidden' }, style]}>{children}</View>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12, marginTop: 8 }}>
      <T size={22} style={{ fontWeight: '800' }}>{title}</T>
      {children}
    </View>
  );
}

