import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, errorText } from '@/lib/api';
import { useSegment } from '@/lib/segment';
import type { ShopCard } from '@/lib/types';
import { Crumbs } from '@/components/Header';
import { OsmMap } from '@/components/OsmMap';
import { ShopList } from '@/components/ShopRow';
import { Button, Dashed, Loading, Notice, Screen, T, Title } from '@/components/ui';

const PAGE = 50;

/**
 * İl / ilçe / mahalle listesi — sitedeki il ve ilçe sayfalarının (ShopListPage) düzeni:
 * yol (Berberler › Ankara › Pursaklar), başlık, kısa açıklama, liste, harita.
 * Parametreler: il, ilce, mahalle (slug / id) ve ekranda yazılacak adlar ilAd, ilceAd, mahalleAd.
 */
export default function Liste() {
  const p = useLocalSearchParams<{ il: string; ilce?: string; mahalle?: string; ilAd?: string; ilceAd?: string; mahalleAd?: string }>();
  const { segment, t } = useSegment();
  const [shops, setShops] = useState<ShopCard[] | null>(null);
  const [more, setMore] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const ilAd = p.ilAd ?? p.il, ilceAd = p.ilceAd ?? p.ilce;

  const load = useCallback(async (n: number) => {
    setError('');
    const qs = new URLSearchParams({ bolum: segment, adet: String(n), il: p.il });
    if (p.ilce) qs.set('ilce', p.ilce);
    if (p.mahalle) qs.set('mahalle', p.mahalle);
    try {
      const r = await api<{ shops: ShopCard[]; more: boolean }>(`/api/m/dukkanlar?${qs}`, { auth: false });
      setShops(r.shops); setMore(r.more);
    } catch (e) {
      setError(errorText(e));
    }
  }, [segment, p.il, p.ilce, p.mahalle]);
  useEffect(() => { setShops(null); setLimit(PAGE); void load(PAGE); }, [load]);

  const n = shops ? `${shops.length}${more ? '+' : ''}` : '';
  const title = p.mahalleAd ? `${p.mahalleAd.replace(/ Mahallesi$/, '')} ${t.shops}` : ilceAd && p.ilce ? `${ilceAd} ${t.shops}` : `${ilAd} ${t.shops}`;
  const intro = !shops ? '' : p.mahalleAd ? `${p.mahalleAd}, ${ilceAd}: ${n} ${t.shop}.`
    : p.ilce ? `${ilceAd}, ${ilAd}: ${n} ${t.shop}. Açık olanlar ve en yüksek puanlılar önce.`
      : `${ilAd} genelinde ${n} ${t.shop}. İlçe seçerek daralt.`;

  const crumbs = [
    { label: t.Shops, onPress: () => router.navigate('/') },
    { label: ilAd, onPress: p.ilce ? () => router.push({ pathname: '/liste', params: { il: p.il, ilAd } }) : undefined },
    ...(p.ilce ? [{ label: ilceAd!, onPress: p.mahalle ? () => router.push({ pathname: '/liste', params: { il: p.il, ilAd, ilce: p.ilce, ilceAd } }) : undefined }] : []),
    ...(p.mahalleAd ? [{ label: p.mahalleAd.replace(/ Mahallesi$/, '') }] : []),
  ];

  return (
    <Screen edges={[]}>
      <Crumbs items={crumbs} />
      <View>
        <Title>{title}</Title>
        {intro ? <T muted>{intro}</T> : null}
      </View>
      {error ? <Notice kind="error" text={error} action={<Button title="Tekrar dene" variant="secondary" onPress={() => load(limit)} />} /> : null}
      {!shops && !error ? <Loading /> : null}
      {shops && shops.length === 0 && (
        <Dashed title={`Burada henüz ${t.shop} yok.`} text={`Bermatik yeni büyüyor. Çevrenizdeki ${t.shopAcc} bize önerebilirsiniz!`} />
      )}
      {shops && shops.length > 0 && (<>
        <ShopList shops={shops} />
        {more && (
          <Button
            title="Daha fazla göster" variant="ghost" loading={loadingMore}
            onPress={async () => { setLoadingMore(true); const k = limit + PAGE; setLimit(k); await load(k); setLoadingMore(false); }}
          />
        )}
        <OsmMap
          center={{ lat: shops[0].lat, lng: shops[0].lng }}
          zoom={p.mahalle ? 14 : p.ilce ? 13 : 10}
          markers={shops.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, title: s.name }))}
          onShop={(id) => router.push(`/dukkan/${id}`)}
          style={{ height: 380 }}
        />
      </>)}
    </Screen>
  );
}
