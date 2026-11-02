import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Telefonun şifreli deposu (Android Keystore / iPhone Keychain). Oturum anahtarı burada saklanır.
export async function getItem(key: string) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}
export async function setItem(key: string, value: string | null) {
  try {
    if (value == null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // depo kullanılamıyorsa uygulama yine çalışır (oturum yalnızca bu açılışta kalır)
  }
}

/** Bu telefona özel rastgele kimlik ("yeni cihazdan giriş" uyarısı için; kişisel bilgi içermez) */
export async function deviceId() {
  let id = await getItem('bm_cihaz');
  if (!id) {
    id = Crypto.randomUUID().replace(/-/g, '');
    await setItem('bm_cihaz', id);
  }
  return id;
}
