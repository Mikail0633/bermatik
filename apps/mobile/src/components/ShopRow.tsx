import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { imageUrl } from '@/lib/api';
import { distanceLabel, initials } from '@/lib/format';
import { useTheme } from '@/lib/segment';
import { alpha } from '@/lib/theme';
import type { ShopCard } from '@/lib/types';
import { Row, T } from './ui';

// Sitedeki dükkân listesi parçaları (apps/web/src/components/ShopCard.tsx ile aynı düzen)

/** Açık / kapalı rozeti: "● Şu an açık · Kapanış 20:00" (kısa: "● Açık") */
export function OpenBadge({ shop, compact = false }: { shop: Pick<ShopCard, 'isOpen' | 'opensAt' | 'closesAt'>; compact?: boolean }) {
  const th = useTheme();
  const color = shop.isOpen ? th.open : th.closed;
  const time = shop.isOpen ? shop.closesAt && `Kapanış ${shop.closesAt === '23:59' ? '24:00' : shop.closesAt}` : shop.opensAt && `Açılış ${shop.opensAt}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: alpha(color, 0.12) }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <T size={12} bold color={color}>
        {shop.isOpen ? (compact ? 'Açık' : 'Şu an açık') : 'Kapalı'}{!compact && time ? ` · ${time}` : ''}
      </T>
    </View>
  );
}

/** Puan: "★ 4.7 (12)" — yorum yoksa "Yeni" */
export function Rating({ value, count }: { value: number | null; count: number }) {
  const th = useTheme();
  if (!value) return <T size={12} muted>Yeni</T>;
  return (
    <Row gap={4}>
      <Ionicons name="star" size={15} color={th.accent} />
      <T size={14} bold>{Number(value).toFixed(1)}</T>
      <T size={14} muted>({count})</T>
    </Row>
  );
}

/** Dükkân fotoğrafı; yüklenmemişse baş harfli kutu */
export function ShopThumb({ name, cover, size = 64 }: { name: string; cover: string | null; size?: number }) {
  const th = useTheme();
  const uri = imageUrl(cover);
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 12 }} contentFit="cover" transition={150} />;
  return (
    <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: th.primary, alignItems: 'center', justifyContent: 'center' }}>
      <T size={18} bold color={th.onPrimary} style={{ fontWeight: '800' }}>{initials(name)}</T>
    </View>
  );
}

/** Sade liste satırı: solda fotoğraf, ortada isim/adres, sağda açık/kapalı ve puan */
export function ShopRow({ shop, first }: { shop: ShopCard; first?: boolean }) {
  const th = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/dukkan/${shop.id}`)}
      style={({ pressed }) => [s.row, { borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: th.line, backgroundColor: pressed ? th.surface2 : th.surface }]}
    >
      <ShopThumb name={shop.name} cover={shop.cover} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T bold numberOfLines={2} style={{ lineHeight: 20 }}>
          {shop.name}
          {shop.isCertified ? <>{' '}<Ionicons name="checkmark-circle" size={15} color={th.accent} accessibilityLabel="Belgeli usta" /></> : null}
        </T>
        {/* Mesafe başta: dar ekranda adres kısalsa da mesafe görünsün */}
        <T size={14} muted numberOfLines={1}>
          {shop.distanceKm != null ? <T size={14} bold>{distanceLabel(shop.distanceKm)} · </T> : null}
          {shop.neighborhood.replace(/ Mahallesi$/, '')}, {shop.district}
        </T>
        {shop.isClaimed ? (
          <Row gap={4} style={{ marginTop: 2 }}>
            <Ionicons name="people-outline" size={13} color={th.muted} />
            <T size={12} muted>{shop.todayAppointments === 0 ? 'Bugün randevu yok' : `Bugün ${shop.todayAppointments} randevu`}</T>
          </Row>
        ) : (
          <T size={12} muted style={{ marginTop: 2 }}>Henüz Bermatik'te değil</T>
        )}
      </View>
      {shop.isClaimed && (
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <OpenBadge shop={shop} compact />
          <Rating value={shop.rating} count={shop.reviewCount} />
        </View>
      )}
    </Pressable>
  );
}

/** Sitedeki gibi: tek çerçeve içinde, aralarında ince çizgi olan liste */
export function ShopList({ shops }: { shops: ShopCard[] }) {
  const th = useTheme();
  return (
    <View style={[s.list, { borderColor: th.line, backgroundColor: th.surface }]}>
      {shops.map((sh, i) => <ShopRow key={sh.id} shop={sh} first={i === 0} />)}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  list: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
});
