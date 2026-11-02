import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type ScrollViewProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/segment';

// Uygulamanın ortak parçaları. Renkler seçili bölüme (erkek koyu / kadın açık) göre gelir.

export function Screen({ children, scroll = true, edges = ['top'], refresh, contentStyle }: {
  children: ReactNode; scroll?: boolean; edges?: Edge[]; refresh?: ScrollViewProps['refreshControl']; contentStyle?: StyleProp<ViewStyle>;
}) {
  const th = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: th.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[{ padding: 16, paddingBottom: 40, gap: 14 }, contentStyle]} refreshControl={refresh} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type TProps = { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; size?: number; bold?: boolean; numberOfLines?: number; color?: string };
export function T({ children, style, muted, size = 15, bold, numberOfLines, color }: TProps) {
  const th = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: color ?? (muted ? th.muted : th.text), fontSize: size, fontWeight: bold ? '700' : '400' }, style]}>
      {children}
    </Text>
  );
}

export const H1 = ({ children }: { children: ReactNode }) => <T size={24} bold>{children}</T>;
export const H2 = ({ children }: { children: ReactNode }) => <T size={18} bold>{children}</T>;

export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; disabled?: boolean; loading?: boolean; icon?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const th = useTheme();
  const bg = variant === 'primary' ? th.primary : variant === 'secondary' ? th.surface2 : th.surface;
  const fg = variant === 'primary' ? th.onPrimary : variant === 'danger' ? th.closed : th.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        variant === 'ghost' || variant === 'danger' ? { borderWidth: 1, borderColor: th.line } : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon}
          <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const th = useTheme();
  const base = [s.card, { backgroundColor: th.surface, borderColor: th.line }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }]}>{children}</Pressable>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const th = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, { backgroundColor: active ? th.primary : th.surface, borderColor: active ? th.primary : th.line }]}
    >
      <Text style={{ color: active ? th.onPrimary : th.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const th = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T size={14} bold>{label}</T>
      <TextInput
        placeholderTextColor={th.muted}
        {...props}
        style={[s.input, { backgroundColor: th.surface, borderColor: error ? th.closed : th.line, color: th.text }, props.style]}
      />
      {error ? <T size={13} color={th.closed}>{error}</T> : null}
    </View>
  );
}

export function Loading({ text }: { text?: string }) {
  const th = useTheme();
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={th.accent} size="large" />
      {text ? <T muted>{text}</T> : null}
    </View>
  );
}

export function Notice({ text, kind = 'info', action }: { text: string; kind?: 'info' | 'error' | 'ok'; action?: ReactNode }) {
  const th = useTheme();
  const color = kind === 'error' ? th.closed : kind === 'ok' ? th.open : th.muted;
  return (
    <View style={[s.notice, { borderColor: kind === 'info' ? th.line : color, backgroundColor: th.surface }]}>
      <T color={kind === 'info' ? th.text : color}>{text}</T>
      {action}
    </View>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={{ paddingVertical: 40, paddingHorizontal: 12, alignItems: 'center', gap: 8 }}>
      <T size={17} bold style={{ textAlign: 'center' }}>{title}</T>
      {text ? <T muted style={{ textAlign: 'center' }}>{text}</T> : null}
      {action ? <View style={{ marginTop: 8, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

/** Sitedeki kesik çizgili boş kutu (ör. "Henüz favori dükkânınız yok.") */
export function Dashed({ text, title, children }: { text?: string; title?: string; children?: ReactNode }) {
  const th = useTheme();
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: th.line, padding: 24, gap: 6, alignItems: 'center' }}>
      {title ? <T size={17} bold style={{ textAlign: 'center' }}>{title}</T> : null}
      {text ? <T muted style={{ textAlign: 'center' }}>{text}</T> : null}
      {children}
    </View>
  );
}

/** Sitedeki büyük sayfa başlığı (text-3xl font-extrabold) */
export const Title = ({ children }: { children: ReactNode }) => <T size={28} style={{ fontWeight: '800' }}>{children}</T>;

export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  const th = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: th.line }} />;
}

const s = StyleSheet.create({
  btn: { minHeight: 50, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  input: { minHeight: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  notice: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 10 },
});
