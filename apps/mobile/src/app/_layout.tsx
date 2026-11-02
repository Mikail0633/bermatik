import { Modal, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth';
import { SegmentProvider, useSegment } from '@/lib/segment';
import { Button, H1, T } from '@/components/ui';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SegmentProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </SegmentProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { theme: th } = useSegment();
  return (
    <>
      <StatusBar style={th.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: th.bg },
          headerTintColor: th.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: th.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="dukkan/[id]" options={{ title: '' }} />
        <Stack.Screen name="randevu/[id]" options={{ title: '' }} />
        <Stack.Screen name="talep/[id]" options={{ title: '' }} />
        <Stack.Screen name="liste" options={{ title: '' }} />
        <Stack.Screen name="hizmet/[slug]" options={{ title: '' }} />
        <Stack.Screen name="sira/index" options={{ title: '' }} />
        <Stack.Screen name="sira/[id]" options={{ title: '' }} />
        <Stack.Screen name="bolge" options={{ title: 'İl / ilçe seç' }} />
        <Stack.Screen name="konum-sec" options={{ title: 'Yerinizi seçin', presentation: 'modal' }} />
        <Stack.Screen name="giris" options={{ title: '', presentation: 'modal' }} />
        <Stack.Screen name="kayit" options={{ title: '', presentation: 'modal' }} />
        <Stack.Screen name="bildirimler" options={{ title: '' }} />
        <Stack.Screen name="favoriler" options={{ title: '' }} />
        <Stack.Screen name="panel/[shopId]" options={{ title: 'İşletme paneli' }} />
      </Stack>
      <WelcomeChoice />
    </>
  );
}

// İlk açılışta: "Erkek mi, kadın mı?" (sitedeki ilk ziyaret penceresinin aynısı)
function WelcomeChoice() {
  const { chosen, setSegment, theme: th } = useSegment();
  return (
    <Modal visible={!chosen} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: th.surface, borderRadius: 20, padding: 22, gap: 14 }}>
          <H1>Bermatik'e hoş geldiniz</H1>
          <T muted>Hangi bölümü görmek istersiniz? Daha sonra üstteki düğmeyle değiştirebilirsiniz.</T>
          <Button title="✂️  Erkek berberleri" onPress={() => setSegment('erkek')} />
          <Button title="💇‍♀️  Kadın kuaförleri" variant="secondary" onPress={() => setSegment('kadin')} />
        </View>
      </View>
    </Modal>
  );
}
