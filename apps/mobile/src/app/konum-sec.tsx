import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { deliverPickedLocation } from '@/lib/location';
import { OsmMap } from '@/components/OsmMap';
import { Button, Screen, T } from '@/components/ui';

// Konum bulunamazsa ya da başka bir yere bakmak için: haritaya dokunarak yer seçme
export default function KonumSec() {
  const p = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const start = p.lat && p.lng ? { lat: Number(p.lat), lng: Number(p.lng) } : { lat: 39.0, lng: 35.2 }; // yoksa Türkiye geneli
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  return (
    <Screen scroll={false} edges={['bottom']}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <T muted>Haritayı yakınlaştırıp bulunduğunuz yere (ya da bakmak istediğiniz yere) dokunun.</T>
      </View>
      <OsmMap center={start} zoom={p.lat ? 14 : 6} picker onPick={setPicked} style={{ flex: 1, marginHorizontal: 16 }} />
      <View style={{ padding: 16 }}>
        <Button
          title={picked ? 'Bu yerin çevresinde ara' : 'Haritada bir yere dokunun'}
          disabled={!picked}
          onPress={() => { if (picked) { deliverPickedLocation(picked); router.back(); } }}
        />
      </View>
    </Screen>
  );
}
