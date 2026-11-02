import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSegment } from '@/lib/segment';
import { Screen, T } from './ui';

// Giriş / kayıt ekranlarının ortak kutusu (sitedeki AuthCard)
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const { theme: th } = useSegment();
  return (
    <Screen edges={['bottom']} contentStyle={{ paddingTop: 24 }}>
      <View style={{ borderRadius: 24, borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, padding: 22, gap: 18 }}>
        <View>
          <T size={24} style={{ fontWeight: '800' }}>{title}</T>
          {subtitle ? <T muted style={{ marginTop: 4 }}>{subtitle}</T> : null}
        </View>
        {children}
      </View>
      {footer ? <View style={{ alignItems: 'center' }}>{footer}</View> : null}
    </Screen>
  );
}
