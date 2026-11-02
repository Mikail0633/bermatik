import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/lib/auth';
import { useSegment } from '@/lib/segment';
import { Row, T } from './ui';

/** Sitedeki logo: renkli kare içinde makas + "Ber" ve vurgulu "matik" */
export function Logo() {
  const { theme: th } = useSegment();
  return (
    <Row gap={8}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: th.logoBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="cut" size={20} color={th.logoFg} />
      </View>
      <T size={20} style={{ fontWeight: '800', letterSpacing: -0.3 }}>
        Ber<T size={20} color={th.accent} style={{ fontWeight: '800' }}>matik</T>
      </T>
    </Row>
  );
}

// Sitedeki üst menü: logo + Erkek/Kadın düğmesi + bildirim zili / giriş simgesi
export function Header() {
  const { segment, setSegment, theme: th } = useSegment();
  const { user, unread } = useAuth();
  return (
    <View style={{ backgroundColor: th.surface, borderBottomWidth: 1, borderBottomColor: th.line, paddingHorizontal: 16, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Logo />
      <View style={{ flexDirection: 'row', backgroundColor: th.surface2, borderRadius: 999, padding: 3 }}>
        {(['erkek', 'kadin'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSegment(s)}
            accessibilityRole="button"
            accessibilityState={{ selected: segment === s }}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: segment === s ? th.primary : 'transparent' }}
          >
            <T size={13} bold color={segment === s ? th.onPrimary : th.text}>{s === 'erkek' ? 'Erkek' : 'Kadın'}</T>
          </Pressable>
        ))}
      </View>
      {user ? (
        <Pressable onPress={() => router.push('/bildirimler')} accessibilityLabel={unread ? `Bildirimler (${unread} yeni)` : 'Bildirimler'} hitSlop={10}>
          <Ionicons name="notifications-outline" size={23} color={th.text} />
          {unread > 0 && (
            <View style={{ position: 'absolute', right: -6, top: -4, backgroundColor: th.closed, borderRadius: 999, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
              <T size={10} bold color="#fff">{unread > 9 ? '9+' : unread}</T>
            </View>
          )}
        </Pressable>
      ) : (
        <Pressable onPress={() => router.push('/giris')} accessibilityLabel="Giriş yap" hitSlop={10}>
          <Ionicons name="person-circle-outline" size={28} color={th.text} />
        </Pressable>
      )}
    </View>
  );
}

/** Sitedeki "Berberler › Ankara › Pursaklar" yolu */
export function Crumbs({ items }: { items: { label: string; onPress?: () => void }[] }) {
  const { theme: th } = useSegment();
  return (
    <Row gap={4} style={{ flexWrap: 'wrap' }}>
      {items.map((c, i) => (
        <Row key={i} gap={4}>
          {i > 0 && <Ionicons name="chevron-forward" size={13} color={th.muted} />}
          <Pressable onPress={c.onPress} disabled={!c.onPress} hitSlop={6}><T size={13} muted>{c.label}</T></Pressable>
        </Row>
      ))}
    </Row>
  );
}
