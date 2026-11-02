import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL, api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { lastLocation } from '@/lib/location';
import { useSegment } from '@/lib/segment';
import type { ShopCard } from '@/lib/types';
import { Header, Logo } from '@/components/Header';
import { ShopList } from '@/components/ShopRow';
import { Button, Chip, Dashed, Loading, Notice, Row, T } from '@/components/ui';

type Home = { categories: { slug: string; name: string }[]; openShort: ShopCard[]; topRated: ShopCard[]; ankara: ShopCard[] };

// Ana ekran — sitedeki ana sayfanın (apps/web/src/components/HomePage.tsx) aynı sırası ve metinleri
export default function Kesfet() {
  const { segment, theme: th, t } = useSegment();
  const { user } = useAuth();
  const [data, setData] = useState<Home | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const servicesY = useRef(0);

  const load = useCallback(async () => {
    setError('');
    try {
      const p = await lastLocation();
      setData(await api<Home>(`/api/m/ana?bolum=${segment}${p ? `&lat=${p.lat}&lng=${p.lng}` : ''}`, { auth: false }));
    } catch (e) {
      setError(errorText(e));
    }
  }, [segment]);
  useEffect(() => { setData(null); void load(); }, [load]);

  const section = (children: ReactNode) => <View style={{ paddingHorizontal: 16, gap: 12 }}>{children}</View>;
  const title = (icon: ReactNode, text: string, sub?: string, right?: ReactNode) => (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <Row gap={8} style={{ flex: 1 }}>
        {icon}
        <View style={{ flex: 1 }}>
          <T size={22} style={{ fontWeight: '800' }}>{text}</T>
          {sub ? <T size={13} muted>{sub}</T> : null}
        </View>
      </Row>
      {right}
    </Row>
  );
  const howCard = (icon: keyof typeof Ionicons.glyphMap, head: string, text: string, onPress: () => void) => (
    <Pressable key={head} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: pressed ? th.accent : th.line, backgroundColor: th.surface })}>
      <Ionicons name={icon} size={24} color={th.accent} />
      <View style={{ flex: 1 }}>
        <T bold>{head}</T>
        <T size={14} muted>{text}</T>
      </View>
      <Ionicons name="chevron-forward" size={20} color={th.muted} />
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: th.surface }}>
      <Header />
      <ScrollView
        ref={scroll}
        style={{ backgroundColor: th.bg }}
        contentContainerStyle={{ paddingBottom: 40, gap: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={th.accent} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {/* Karşılama: konum düğmesi + il/ilçe seçimi */}
        <View style={{ backgroundColor: th.hero, paddingHorizontal: 16, paddingVertical: 36, gap: 12 }}>
          <T size={30} color={th.onHero} style={{ fontWeight: '800', lineHeight: 36 }}>
            {segment === 'erkek' ? 'Berberini bul, sıra beklemeden traş ol.' : 'Kuaförünü bul, beklemeden randevunu al.'}
          </T>
          <T size={16} color={th.onHero} style={{ opacity: 0.85 }}>
            Yakınındaki {t.shops}, fiyatlar, bugünkü sıra ve boş randevu saatleri tek ekranda.
          </T>
          <Pressable
            onPress={() => router.push('/yakinimda')}
            style={({ pressed }) => ({ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16, backgroundColor: th.cta, opacity: pressed ? 0.9 : 1 })}
          >
            <Ionicons name="location" size={22} color={th.onCta} />
            <T size={18} bold color={th.onCta}>En yakın {t.shopAcc} bul</T>
          </Pressable>
          <View style={{ marginTop: 12, borderRadius: 16, backgroundColor: th.surface, padding: 12, gap: 8 }}>
            <T size={14} muted style={{ paddingHorizontal: 4 }}>veya il, ilçe ve mahalle seç</T>
            <Button title="İl, ilçe ve mahalle seçin" onPress={() => router.push('/bolge')} icon={<Ionicons name="map-outline" size={18} color={th.onPrimary} />} />
          </View>
        </View>

        {/* Nasıl çalışır: tıklanabilir 3 kutu */}
        {section(<>
          {howCard('cut-outline', 'Hizmetini seç',
            segment === 'erkek' ? 'Saç, sakal, damat traşı — fiyatlar önceden belli.' : 'Saç, boya, manikür, kaş-kirpik — fiyatlar önceden belli.',
            () => scroll.current?.scrollTo({ y: servicesY.current - 12, animated: true }))}
          {howCard('time-outline', 'Sırayı gör', 'Dükkânını ara, bugün kaç randevusu var gör.', () => router.push('/sira'))}
          {howCard('calendar-outline', 'Randevunu al', 'Yakınındakileri bul, boş saatlerden birini seç.', () => router.push('/yakinimda'))}
        </>)}

        {error ? section(<Notice kind="error" text={error} action={<Button title="Tekrar dene" variant="secondary" onPress={load} />} />) : null}
        {!data && !error ? <Loading /> : null}

        {/* Hizmete göre arama */}
        {data && data.categories.length > 0 && (
          <View onLayout={(e) => { servicesY.current = e.nativeEvent.layout.y; }}>
            {section(<>
              {title(null, 'Hizmetler', `Bir hizmet seç, onu yapan ${t.shops} listelensin.`)}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {data.categories.map((c) => <Chip key={c.slug} label={c.name} onPress={() => router.push(`/hizmet/${c.slug}`)} />)}
              </View>
            </>)}
          </View>
        )}

        {data && (data.openShort.length > 0 || data.topRated.length > 0) && (<>
          {section(<>
            {title(<Ionicons name="time-outline" size={24} color={th.accent} />, 'Şu an açık, bugün müsait', 'Bugün randevusu az olan yerler')}
            {data.openShort.length ? <ShopList shops={data.openShort} /> : <Dashed text={`Şu an açık ${t.shop} bulunamadı.`} />}
          </>)}
          {section(<>
            {title(<Ionicons name="star" size={24} color={th.accent} />, 'En yüksek puanlılar', 'Müşterilerin en çok beğendikleri')}
            {data.topRated.length ? <ShopList shops={data.topRated} /> : <Dashed text="Henüz yorum yapılmış dükkân yok." />}
          </>)}
        </>)}

        {data && data.ankara.length > 0 && section(<>
          {title(
            <Ionicons name="cut" size={24} color={th.accent} />, t.Shops, 'Ankara · Pursaklar ve çevresi önce',
            <Pressable onPress={() => router.push({ pathname: '/liste', params: { il: 'ankara', ilAd: 'Ankara' } })} hitSlop={8}>
              <T size={14} bold style={{ textDecorationLine: 'underline' }}>Tümünü gör</T>
            </Pressable>,
          )}
          <ShopList shops={data.ankara} />
        </>)}

        {/* Berberler için tanıtım (müşteri hesaplarına gösterilmez) */}
        {user?.role !== 'customer' && section(
          <View style={{ borderRadius: 24, backgroundColor: th.surface2, padding: 22, gap: 14 }}>
            <Row gap={14} style={{ alignItems: 'flex-start' }}>
              <Ionicons name="storefront-outline" size={38} color={th.accent} />
              <View style={{ flex: 1, gap: 4 }}>
                <T size={22} style={{ fontWeight: '800' }}>{segment === 'erkek' ? 'Berber misiniz?' : 'Kuaför müsünüz?'}</T>
                <T muted>Dükkânınızı Bermatik'e ücretsiz ekleyin. Online randevu, bugünkü sıra ve müşteri hatırlatmaları sizin için çalışsın.</T>
              </View>
            </Row>
            <Button title="Dükkânımı ekle" onPress={() => Linking.openURL(`${API_URL}/isletme`)} />
          </View>,
        )}

        {/* Alt bilgi */}
        {section(
          <View style={{ borderTopWidth: 1, borderTopColor: th.line, paddingTop: 20, gap: 8 }}>
            <Logo />
            <T size={14} muted>Türkiye'nin berber ve kuaför randevu platformu.</T>
          </View>,
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

