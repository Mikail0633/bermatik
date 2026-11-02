import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL, api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSegment } from '@/lib/segment';
import { AuthCard } from '@/components/AuthCard';
import { Button, Field, Notice, Row, T } from '@/components/ui';

function Check({ value, onChange, children }: { value: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const { theme: th } = useSegment();
  return (
    <Pressable onPress={() => onChange(!value)} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }} accessibilityRole="checkbox" accessibilityState={{ checked: value }}>
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={20} color={value ? th.primary : th.muted} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

// Kayıt — sitedeki /kayit sayfasının alanları ve metinleri
export default function Kayit() {
  const { register } = useAuth();
  const { theme: th } = useSegment();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', birthYear: '', password: '' });
  const [isBusiness, setIsBusiness] = useState(false);
  const [kvkk, setKvkk] = useState(false);
  const [consentEnabled, setConsentEnabled] = useState(false);
  const [consentEmail, setConsentEmail] = useState(false);
  const [consentSms, setConsentSms] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((cur) => ({ ...cur, [k]: v }));

  // Kampanya izni kutuları yalnızca yönetim panelinde bu özellik açıksa görünür (sitedeki gibi)
  useEffect(() => {
    api<{ consentEnabled: boolean }>('/api/m/kayit', { auth: false }).then((r) => setConsentEnabled(r.consentEnabled)).catch(() => {});
  }, []);

  const submit = async () => {
    setError('');
    if (!kvkk) return setError('Devam etmek için KVKK aydınlatma metnini onaylayın.');
    setSaving(true);
    try {
      await register({ ...f, email: f.email.trim(), kvkk, isBusiness, consentEmail: consentEnabled && consentEmail, consentSms: consentEnabled && consentSms });
      router.back();
      if (isBusiness) Linking.openURL(`${API_URL}/dogrula`); // işletme hesabı: e-posta doğrulaması sitede
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const type = (value: boolean, title: string, text: string) => (
    <Pressable onPress={() => setIsBusiness(value)} style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: isBusiness === value ? th.primary : th.line, backgroundColor: isBusiness === value ? th.surface2 : th.surface, padding: 12 }}>
      <T bold>{title}</T>
      <T size={12} muted>{text}</T>
    </Pressable>
  );

  return (
    <AuthCard
      title="Kayıt ol"
      subtitle={isBusiness ? 'İşletme hesabınızı açın, dükkânınızı ücretsiz ekleyin.' : 'Bir dakikada hesabınızı açın, hemen randevu alın.'}
      footer={
        <Pressable onPress={() => router.replace('/giris')} hitSlop={8}>
          <T size={14} muted>Zaten hesabınız var mı? <T size={14} bold style={{ textDecorationLine: 'underline' }}>Giriş yapın</T></T>
        </Pressable>
      }
    >
      {error ? <Notice kind="error" text={error} /> : null}
      <View style={{ gap: 6 }}>
        <T size={14} bold>Hesap türü</T>
        <Row>
          {type(false, 'Müşteri', 'Randevu alırım')}
          {type(true, 'İşletme', 'Berber, kuaför veya personelim')}
        </Row>
      </View>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Field label="Ad" value={f.firstName} onChangeText={set('firstName')} autoComplete="given-name" maxLength={60} /></View>
        <View style={{ flex: 1 }}><Field label="Soyad" value={f.lastName} onChangeText={set('lastName')} autoComplete="family-name" maxLength={60} /></View>
      </Row>
      <Field label="E-posta" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <View style={{ gap: 4 }}>
        <Field label="Telefon" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" placeholder="05xx xxx xx xx" maxLength={20} />
        <T size={12} muted>Randevunuzla ilgili dükkân size ulaşabilsin diye.</T>
      </View>
      <Field label="Doğum yılı (isteğe bağlı)" value={f.birthYear} onChangeText={set('birthYear')} keyboardType="number-pad" maxLength={4} placeholder="1995" />
      <View style={{ gap: 4 }}>
        <Field label="Şifre" value={f.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" maxLength={128} />
        <T size={12} muted>En az 8 karakter; adınız, e-postanız ya da çok bilinen şifreler kullanılamaz.</T>
      </View>

      <Check value={kvkk} onChange={setKvkk}>
        <T size={14}>
          <T size={14} bold style={{ textDecorationLine: 'underline' }} >KVKK aydınlatma metnini</T> okudum, kişisel verilerimin randevu hizmeti için işlenmesini kabul ediyorum.
        </T>
      </Check>
      <Pressable onPress={() => Linking.openURL(`${API_URL}/kvkk`)} hitSlop={6}><T size={13} color={th.accent}>Metni oku →</T></Pressable>

      {consentEnabled && (
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: th.line, padding: 12, gap: 8 }}>
          <T size={14} bold>Kampanya ve fırsatlar <T size={14} muted>(isteğe bağlı)</T></T>
          <Check value={consentEmail} onChange={setConsentEmail}><T size={14}>Kampanya ve fırsatlardan <T size={14} bold>e-posta</T> ile haberdar olmak istiyorum.</T></Check>
          <Check value={consentSms} onChange={setConsentSms}><T size={14}>Kampanya ve fırsatlardan <T size={14} bold>SMS</T> ile haberdar olmak istiyorum.</T></Check>
          <T size={12} muted>İstediğiniz zaman Hesabım sayfasından ya da iletideki bağlantıdan vazgeçebilirsiniz.</T>
        </View>
      )}
      <Button title="Kayıt ol" loading={saving} onPress={submit} />
    </AuthCard>
  );
}
