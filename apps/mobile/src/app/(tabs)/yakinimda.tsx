import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, errorText } from '@/lib/api';
import { currentLocation, onPickedLocation, type Point } from '@/lib/location';
import { useSegment } from '@/lib/segment';
import type { ShopCard } from '@/lib/types';
import { Crumbs } from '@/components/Header';
import { OsmMap } from '@/components/OsmMap';
import { ShopList } from '@/components/ShopRow';
import { Button, Dashed, Loading, Notice, Screen, T, Title } from '@/components/ui';

// Sitedeki gibi: önce 5 km, bulunamazsa 15, sonra 50 km
const RADII = [5, 15, 50];

// Yakınındaki berberler / kuaförler (sitedeki /[bölüm]/yakinimda sayfasının düzeni)
export default function Yakinimda() {
  const { segment, theme: th, t } = useSegment();
  const [point, setPoint] = useState<Point | null>(null);
  const [status, setStatus] = useState<'locating' | 'denied' | 'failed' | 'ok'>('locating');
  const [result, setResult] = useState<{ shops: ShopCard[]; radius: number } | null>(null);
  const [error, setError] = useState('');
  const req = useRef(0);

  const locate = useCallback(async () => {
    setStatus('locating');
    const r = await currentLocation();
    if (r.point) { setPoint(r.point); setStatus('ok'); } else setStatus(r.denied ? 'denied' : 'failed');
  }, []);
  useEffect(() => { void locate(); }, [locate]);

  // Haritadan seçilen yer bu ekrana döner
  useFocusEffect(useCallback(() => {
    onPickedLocation((p) => { setPoint(p); setStatus('ok'); });
    return () => onPickedLocation(null);
  }, []));

  useEffect(() => {
    if (!point) return;
    const my = ++req.current; // eski bir isteğin geç gelen cevabı yenisini ezmesin
    setResult(null); setError('');
    (async () => {
      try {
        let shops: ShopCard[] = [], radius = RADII[0];
        for (radius of RADII) {
          shops = (await api<{ shops: ShopCard[] }>(`/api/m/dukkanlar?bolum=${segment}&lat=${point.lat}&lng=${point.lng}&km=${radius}&adet=50`, { auth: false })).shops;
          if (shops.length) break;
        }
        if (my === req.current) setResult({ shops, radius });
      } catch (e) {
        if (my === req.current) setError(errorText(e));
      }
    })();
  }, [point, segment]);

  const pickOnMap = () => router.push({ pathname: '/konum-sec', params: point ? { lat: String(point.lat), lng: String(point.lng) } : {} });

  return (
    <Screen>
      <Crumbs items={[{ label: t.Shops, onPress: () => router.navigate('/') }, { label: 'Yakınımda' }]} />
      <View>
        <Title>Yakınındaki {t.shops}</Title>
        {result ? (
          <T muted>
            {result.shops.length
              ? `${result.radius} km içinde ${result.shops.length} ${t.shop} bulundu. En yakın olan en üstte.`
              : `${result.radius} km içinde ${t.shop} bulunamadı.`}
          </T>
        ) : null}
      </View>

      {!point && status === 'locating' && <Loading text="Konum alınıyor…" />}
      {!point && (status === 'denied' || status === 'failed') && (<>
        <Notice kind="error" text={status === 'denied' ? 'Konum izni verilmedi. Yerinizi haritadan seçebilirsiniz.' : 'Konumunuz bulunamadı. Yerinizi haritadan seçebilirsiniz.'} />
        <Button title="Yerimi haritadan seç" icon={<Ionicons name="map-outline" size={18} color={th.onPrimary} />} onPress={pickOnMap} />
        <Button title="Konumu tekrar dene" variant="ghost" onPress={locate} />
      </>)}

      {point && (
        <Pressable onPress={pickOnMap} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
          <T size={14} bold color={th.accent}>Başka bir yer seç →</T>
        </Pressable>
      )}
      {error ? <Notice kind="error" text={error} /> : null}
      {point && !result && !error ? <Loading /> : null}

      {result && result.shops.length === 0 && (
        <Dashed title={`Burada henüz ${t.shop} yok.`} text={`Bermatik yeni büyüyor. Çevrenizdeki ${t.shopAcc} bize önerebilirsiniz!`} />
      )}
      {point && result && result.shops.length > 0 && (<>
        <ShopList shops={result.shops} />
        <OsmMap
          center={point}
          zoom={result.radius <= 5 ? 13 : result.radius <= 15 ? 12 : 10}
          me={point}
          markers={result.shops.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, title: s.name }))}
          onShop={(id) => router.push(`/dukkan/${id}`)}
          style={{ height: 380 }}
        />
      </>)}
    </Screen>
  );
}
