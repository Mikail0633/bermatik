import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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

// İşletme doğrulama belgesi — sitedeki kayıt formuyla aynı türler ve numara alanları
const DOC_KINDS = [
  ['kimlik', 'Kimlik kartı (ön yüz)'],
  ['ruhsat', 'İşyeri açma ruhsatı'],
  ['vergi_levhasi', 'Vergi levhası'],
  ['esnaf_kaydi', 'Esnaf odası kaydı'],
  ['diger', 'Diğer'],
] as const;
const NUMBER_FIELD: Record<string, { label: string; hint: string; numeric: boolean; max: number }> = {
  kimlik: { label: 'T.C. kimlik numarası', hint: 'Ad, soyad ve doğum yılınızla birlikte nüfus kayıtlarından kontrol edilir.', numeric: true, max: 11 },
  vergi_levhasi: { label: 'Vergi numarası', hint: 'Şirketlerde 10 hane; şahıs işletmelerinde levhadaki 11 haneli T.C. numarası.', numeric: true, max: 11 },
  esnaf_kaydi: { label: 'Esnaf sicil numarası', hint: 'Esnaf odası kaydındaki sicil numarası.', numeric: false, max: 30 },
  ruhsat: { label: 'Ruhsat numarası', hint: 'İşyeri açma ve çalışma ruhsatındaki numara.', numeric: false, max: 30 },
  diger: { label: 'Belge numarası', hint: 'Belgenin üzerindeki numara.', numeric: false, max: 30 },
};
const MAX_BYTES = 8 * 1024 * 1024;
type Photo = { uri: string; base64: string; mimeType: string };

// Kayıt — sitedeki /kayit sayfasının alanları ve metinleri
export default function Kayit() {
  const { register } = useAuth();
  const { theme: th } = useSegment();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', birthYear: '', password: '' });
  const [isBusiness, setIsBusiness] = useState(false);
  const [docKind, setDocKind] = useState('kimlik');
  const [docNumber, setDocNumber] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
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

  // Belgenin fotoğrafı: galeriden seç ya da kamerayla çek (küçültülerek gönderilir)
  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin gerekli', camera ? 'Belgenin fotoğrafını çekmek için kamera izni verin.' : 'Belgenin fotoğrafını seçmek için galeri izni verin.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, base64: true };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const a = r.canceled ? null : r.assets[0];
    if (!a?.base64) return;
    if (a.base64.length * 0.75 > MAX_BYTES) return setError('Fotoğraf en fazla 8 MB olabilir.');
    setError('');
    setPhoto({ uri: a.uri, base64: a.base64, mimeType: a.mimeType ?? 'image/jpeg' });
  };

  const submit = async () => {
    setError('');
    if (isBusiness) {
      if (!docNumber.trim()) return setError(`Belge: ${NUMBER_FIELD[docKind].label} yazın.`);
      if (docKind === 'kimlik' && !/^\d{4}$/.test(f.birthYear.trim())) return setError('Kimlik doğrulaması için doğum yılınızı yazın.');
      if (!photo) return setError('Belge: belgenin fotoğrafını seçin ya da çekin.');
    }
    if (!kvkk) return setError('Devam etmek için KVKK aydınlatma metnini onaylayın.');
    setSaving(true);
    try {
      await register({
        ...f, email: f.email.trim(), kvkk, isBusiness, consentEmail: consentEnabled && consentEmail, consentSms: consentEnabled && consentSms,
        doc: isBusiness && photo ? { kind: docKind, number: docNumber.trim(), fileBase64: photo.base64, mimeType: photo.mimeType } : undefined,
      });
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
      <View style={{ gap: 4 }}>
        <Field label={isBusiness ? 'Doğum yılı' : 'Doğum yılı (isteğe bağlı)'} value={f.birthYear} onChangeText={set('birthYear')} keyboardType="number-pad" maxLength={4} placeholder="1995" />
        {isBusiness ? <T size={12} muted>Kimlikle doğrulamada nüfus kaydıyla karşılaştırılır.</T> : null}
      </View>
      {isBusiness && (
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: th.line, padding: 12, gap: 10 }}>
          <T size={14} bold>İşletme doğrulama belgesi</T>
          <T size={12} muted>
            Sahte işletme hesaplarını önlemek için bir belge istiyoruz. <T size={12} bold>Kimlik</T> seçerseniz ad, soyad, doğum yılı ve
            T.C. numaranız nüfus kayıtlarından kontrol edilir ve paneliniz hemen açılır; diğer belgelerde Bermatik ekibi inceleyip
            onaylayınca açılır. Bir belge yalnızca bir hesapta kullanılabilir. Belgenizi yalnızca Bermatik ekibi görür.
          </T>
          <View style={{ gap: 6 }}>
            <T size={14} bold>Belge türü</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {DOC_KINDS.map(([v, l]) => (
                <Pressable key={v} onPress={() => { setDocKind(v); setDocNumber(''); }} accessibilityRole="radio" accessibilityState={{ selected: docKind === v }}
                  style={{ borderRadius: 999, borderWidth: 1, borderColor: docKind === v ? th.primary : th.line, backgroundColor: docKind === v ? th.surface2 : th.surface, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <T size={13} bold={docKind === v}>{l}</T>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <Field label={NUMBER_FIELD[docKind].label} value={docNumber} onChangeText={setDocNumber} autoCapitalize="characters" autoComplete="off"
              keyboardType={NUMBER_FIELD[docKind].numeric ? 'number-pad' : 'default'} maxLength={NUMBER_FIELD[docKind].max + 6} />
            <T size={12} muted>{NUMBER_FIELD[docKind].hint}</T>
          </View>
          <View style={{ gap: 6 }}>
            <T size={14} bold>Belgenin fotoğrafı (en fazla 8 MB)</T>
            {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 1.6, borderRadius: 10 }} contentFit="contain" /> : null}
            <Row>
              <Button title={photo ? 'Başka fotoğraf' : 'Galeriden seç'} variant="secondary" onPress={() => pick(false)} icon={<Ionicons name="images-outline" size={18} color={th.text} />} style={{ flex: 1 }} />
              <Button title="Fotoğraf çek" variant="secondary" onPress={() => pick(true)} icon={<Ionicons name="camera-outline" size={18} color={th.text} />} style={{ flex: 1 }} />
            </Row>
          </View>
        </View>
      )}
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
