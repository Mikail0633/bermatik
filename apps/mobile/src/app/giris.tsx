import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { API_URL, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSegment } from '@/lib/segment';
import { alpha } from '@/lib/theme';
import { AuthCard } from '@/components/AuthCard';
import { Button, Field, Notice, T } from '@/components/ui';

// Giriş — sitedeki /giris sayfasının metinleri
export default function Giris() {
  const { login, sessionEnded } = useAuth();
  const { theme: th } = useSegment();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) return setError('E-posta ve şifrenizi girin.');
    setSaving(true);
    try {
      const u = await login(email.trim(), password);
      router.back();
      // Dükkân sahibi, personel ve admin doğrudan işletme paneline (sitedeki gibi)
      if (u.role !== 'customer') router.navigate('/isletme');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthCard
      title="Giriş yap"
      subtitle="Randevu almak için giriş yapın."
      footer={
        <Pressable onPress={() => router.replace('/kayit')} hitSlop={8}>
          <T size={14} muted>
            Hesabınız yok mu? <T size={14} bold style={{ textDecorationLine: 'underline' }}>Kayıt olun</T>
          </T>
        </Pressable>
      }
    >
      {sessionEnded && (
        <View style={{ borderRadius: 12, backgroundColor: alpha(th.accent, 0.15), paddingHorizontal: 12, paddingVertical: 10 }}>
          <T size={14}>Hesabınıza <T size={14} bold>başka bir cihazdan giriş yapıldığı</T> için bu cihazdaki oturumunuz kapandı. Siz değilseniz giriş yaptıktan sonra şifrenizi değiştirin.</T>
        </View>
      )}
      {error ? <Notice kind="error" text={error} /> : null}
      <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      <Field label="Şifre" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} returnKeyType="go" />
      <Pressable onPress={() => Linking.openURL(`${API_URL}/sifremi-unuttum`)} style={{ alignSelf: 'flex-end' }} hitSlop={8}>
        <T size={14} muted style={{ textDecorationLine: 'underline' }}>Şifremi unuttum</T>
      </Pressable>
      <Button title="Giriş yap" loading={saving} onPress={submit} />
    </AuthCard>
  );
}
