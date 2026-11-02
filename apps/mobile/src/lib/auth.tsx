import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Device from 'expo-device';
import { api, setApiToken, setUnauthorizedHandler } from './api';
import { deviceId, getItem, setItem } from './storage';
import { registerPush, unregisterPush } from './push';
import type { User } from './types';

type RegisterInput = {
  firstName: string; lastName: string; email: string; phone: string; birthYear: string; password: string;
  kvkk: boolean; isBusiness: boolean; consentEmail: boolean; consentSms: boolean;
};

type AuthCtx = {
  ready: boolean;
  user: User | null;
  unread: number;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  sessionEnded: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);
const TOKEN_KEY = 'bm_oturum';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [unread, setUnread] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);

  const clear = useCallback(async () => {
    setApiToken(null);
    await setItem(TOKEN_KEY, null);
    setUser(null);
    setUnread(0);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: User; unread: number }>('/api/m/ben');
      setUser(r.user);
      setUnread(r.unread);
    } catch {
      // 401 ise aşağıdaki işleyici oturumu temizler; bağlantı hatasında mevcut bilgi kalır
    }
  }, []);

  // Sunucu "oturum kapandı" derse (ör. başka bir telefondan girildi): çıkış yapılmış say
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSessionEnded(true);
      void clear();
    });
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  useEffect(() => {
    (async () => {
      const t = await getItem(TOKEN_KEY);
      if (t) {
        setApiToken(t);
        await refresh();
      }
      setReady(true);
    })();
  }, [refresh]);

  const afterLogin = useCallback(async (r: { token: string; user: User }) => {
    setApiToken(r.token);
    await setItem(TOKEN_KEY, r.token);
    setUser(r.user);
    setSessionEnded(false);
    void registerPush(); // bildirim izni (yalnızca gerçek uygulama derlemesinde çalışır)
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/api/m/giris', {
      method: 'POST', auth: false,
      body: { email, password, deviceId: await deviceId(), deviceName: Device.modelName ?? undefined },
    });
    await afterLogin(r);
    return r.user;
  }, [afterLogin]);

  const register = useCallback(async (input: RegisterInput) => {
    const r = await api<{ token: string; user: User }>('/api/m/kayit', {
      method: 'POST', auth: false,
      body: { ...input, deviceId: await deviceId(), deviceName: Device.modelName ?? undefined },
    });
    await afterLogin(r);
  }, [afterLogin]);

  const logout = useCallback(async () => {
    const pushToken = await unregisterPush();
    await api('/api/m/cikis', { method: 'POST', body: { pushToken } }).catch(() => {});
    await clear();
  }, [clear]);

  const value = useMemo(
    () => ({ ready, user, unread, login, register, logout, refresh, sessionEnded }),
    [ready, user, unread, login, register, logout, refresh, sessionEnded],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider eksik');
  return c;
}
