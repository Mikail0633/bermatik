import { Alert, Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pushAvailable } from '@/lib/push';
import { useSegment } from '@/lib/segment';
import { Button, Card, Divider, Notice, Row, Screen, T, Title } from '@/components/ui';

// Hesabım: giriş/çıkış, favoriler, bildirimler, bölüm seçimi, yasal metinler.
// Profil düzenleme ve hesap silme şimdilik sitede açılır (aynı hesap).
export default function Hesap() {
  const { user, logout, sessionEnded } = useAuth();
  const { segment, setSegment, theme: th } = useSegment();

  const item = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={({ pressed }) => ({ paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={12}><Ionicons name={icon} size={20} color={th.accent} /><T size={16}>{label}</T></Row>
        <Ionicons name="chevron-forward" size={16} color={th.muted} />
      </Row>
    </Pressable>
  );
  const web = (path: string) => Linking.openURL(`${API_URL}${path}`);

  return (
    <Screen>
      <Title>Hesabım</Title>
      {sessionEnded && !user && <Notice kind="error" text="Oturumunuz kapandı (hesabınıza başka bir telefondan giriş yapılmış olabilir). Lütfen tekrar giriş yapın." />}

      {user ? (
        <Card style={{ gap: 4 }}>
          <T bold size={18}>{user.firstName} {user.lastName}</T>
          <T muted>{user.email}</T>
          {user.phone ? <T muted>{user.phone}</T> : null}
        </Card>
      ) : (
        <Card style={{ gap: 10 }}>
          <T>Randevu almak, favorilerinizi ve bildirimlerinizi görmek için giriş yapın.</T>
          <Button title="Giriş yap" onPress={() => router.push('/giris')} />
          <Button title="Kayıt ol" variant="secondary" onPress={() => router.push('/kayit')} />
        </Card>
      )}

      <Card style={{ paddingVertical: 4 }}>
        {user && item('heart-outline', 'Favorilerim', () => router.push('/favoriler'))}
        {user && <Divider />}
        {user && item('notifications-outline', 'Bildirimler', () => router.push('/bildirimler'))}
        {user && <Divider />}
        {item('swap-horizontal', segment === 'erkek' ? 'Kadın bölümüne geç' : 'Erkek bölümüne geç', () => setSegment(segment === 'erkek' ? 'kadin' : 'erkek'))}
        {user && (user.role === 'shop_owner' || user.role === 'staff' || user.role === 'admin') && <Divider />}
        {user && (user.role === 'shop_owner' || user.role === 'staff' || user.role === 'admin') && item('storefront-outline', 'İşletmem', () => router.push('/isletme'))}
        {user && <Divider />}
        {user && item('settings-outline', 'Profil ve hesap ayarları (sitede açılır)', () => web('/hesabim'))}
      </Card>

      {!pushAvailable && (
        <T muted size={12}>Not: Telefon bildirimleri uygulamanın deneme sürümünde (Expo Go) çalışmaz; yüklenebilir sürümde açılır. Bildirimleriniz yine de zil simgesinde görünür.</T>
      )}

      <Card style={{ paddingVertical: 4 }}>
        {item('document-text-outline', 'KVKK aydınlatma metni', () => web('/kvkk'))}
        <Divider />
        {item('document-outline', 'Kullanım koşulları', () => web('/kullanim-kosullari'))}
      </Card>

      {user && (
        <Button
          title="Çıkış yap" variant="danger"
          onPress={() => Alert.alert('Çıkış yapılsın mı?', undefined, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Çıkış yap', style: 'destructive', onPress: () => void logout() }])}
        />
      )}
      <View style={{ alignItems: 'center' }}><T muted size={12}>Bermatik · sürüm 1.0.0 (deneme)</T></View>
    </Screen>
  );
}
