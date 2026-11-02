import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, errorText } from '@/lib/api';
import { lastLocation } from '@/lib/location';
import { useSegment } from '@/lib/segment';
import type { ShopCard } from '@/lib/types';
import { Crumbs } from '@/components/Header';
import { ShopList } from '@/components/ShopRow';
import { Button, Chip, Dashed, H2, Loading, Notice, Row, Screen, T, Title } from '@/components/ui';

type Data = {
  category: { slug: string; name: string; description: string | null };
  categories: { slug: string; name: string }[];
  providers: ShopCard[];
  others: ShopCard[];
};

// Hizmet ekranı — sitedeki "Damat traşı yapan berberler" sayfasının düzeni
export default function Hizmet() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { segment, t } = useSegment();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError(''); setData(null);
    try {
      const p = await lastLocation();
      setData(await api<Data>(`/api/m/hizmet/${slug}?bolum=${segment}${p ? `&lat=${p.lat}&lng=${p.lng}` : ''}`, { auth: false }));
    } catch (e) {
      setError(errorText(e));
    }
  }, [slug, segment]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <Screen edges={[]}><Notice kind="error" text={error} action={<Button title="Tekrar dene" variant="secondary" onPress={load} />} /></Screen>;
  if (!data) return <Screen edges={[]}><Loading /></Screen>;
  const name = data.category.name;

  return (
    <Screen edges={[]}>
      <Crumbs items={[{ label: t.Shops, onPress: () => router.navigate('/') }, { label: 'Hizmetler', onPress: () => router.navigate('/') }]} />
      <View style={{ gap: 6 }}>
        <Title>{name}</Title>
        {data.category.description ? <T muted>{data.category.description}</T> : null}
      </View>

      {/* Diğer hizmetler */}
      {data.categories.length > 0 && (
        <Row style={{ flexWrap: 'wrap' }}>
          {data.categories.map((c) => (
            <Chip key={c.slug} label={c.name} onPress={() => router.replace(`/hizmet/${c.slug}`)} />
          ))}
        </Row>
      )}

      <View style={{ gap: 8, marginTop: 8 }}>
        <H2>Bermatik'te {name.toLocaleLowerCase('tr-TR')} yapan {t.shops}</H2>
        {data.providers.length ? <ShopList shops={data.providers} /> : (
          <Dashed text={`Bu hizmeti veren ve Bermatik'e katılmış ${t.shop} henüz yok. ${t.Shops} katıldıkça fiyatlarıyla burada listelenecek.`} />
        )}
      </View>

      {data.others.length > 0 && (
        <View style={{ gap: 8, marginTop: 8 }}>
          <View style={{ gap: 2 }}>
            <H2>Bölgedeki diğer {t.shops}</H2>
            <T muted size={13}>Henüz Bermatik'e katılmadılar; bu hizmeti verip vermediklerini arayarak sorabilirsiniz.</T>
          </View>
          <ShopList shops={data.others} />
        </View>
      )}
    </Screen>
  );
}
