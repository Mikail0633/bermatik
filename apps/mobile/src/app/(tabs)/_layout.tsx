import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/lib/auth';
import { useSegment } from '@/lib/segment';

export default function TabsLayout() {
  const { theme: th, t } = useSegment();
  const { user } = useAuth();
  // "İşletmem" sekmesi yalnızca dükkân sahibi, personel ve admin hesaplarında görünür (sitedeki gibi müşteriye gösterilmez)
  const business = user?.role === 'shop_owner' || user?.role === 'staff' || user?.role === 'admin';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: th.accent,
        tabBarInactiveTintColor: th.muted,
        tabBarStyle: { backgroundColor: th.surface, borderTopColor: th.line },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Keşfet', tabBarIcon: ({ color, size }) => <Ionicons name="cut" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="yakinimda" options={{ title: 'Yakınımda', tabBarIcon: ({ color, size }) => <Ionicons name="location" color={String(color)} size={size} />, tabBarAccessibilityLabel: `Yakınımdaki ${t.shops}` }} />
      <Tabs.Screen name="randevular" options={{ title: 'Randevularım', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="isletme" options={{ title: 'İşletmem', href: business ? undefined : null, tabBarIcon: ({ color, size }) => <Ionicons name="storefront" color={String(color)} size={size} /> }} />
      <Tabs.Screen name="hesap" options={{ title: 'Hesabım', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={String(color)} size={size} /> }} />
    </Tabs>
  );
}
