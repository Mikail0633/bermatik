import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import { getItem, setItem } from './storage';

// Telefon bildirimleri (randevu onayı, hatırlatma, kampanya değil — sitedeki bildirimlerin aynısı).
// Expo Go'da bildirim yoktur; yalnızca gerçek uygulama derlemesinde (APK / mağaza) çalışır.

const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const KEY = 'bm_push';

if (!inExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
  });
}

export async function registerPush(): Promise<void> {
  if (inExpoGo || !Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bermatik', importance: Notifications.AndroidImportance.MAX, lightColor: '#C9A227',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return; // EAS projesi kurulunca dolar
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api('/api/m/push', { method: 'POST', body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' } });
    await setItem(KEY, token);
  } catch (e) {
    console.warn('Bildirim kaydı yapılamadı', e);
  }
}

/** Çıkışta: bu telefona bildirim gönderilmesin (anahtar sunucuya bildirilir) */
export async function unregisterPush(): Promise<string | null> {
  const token = await getItem(KEY);
  await setItem(KEY, null);
  return token;
}

export const pushAvailable = !inExpoGo;
