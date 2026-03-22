import { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api, loadToken, saveToken, clearToken } from '../lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function registerPushToken() {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders', importance: Notifications.AndroidImportance.HIGH,
          sound: 'default', vibrationPattern: [0, 250, 250, 250],
        });
      }
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: undefined });
      const pushToken = tokenData.data;
      await api('/api/push-token', { method: 'PUT', body: JSON.stringify({ token: pushToken }) });
    } catch (err) { console.log('Push token registration skipped:', err.message); }
  }

  useEffect(() => {
    (async () => {
      try {
        await loadToken();
        const data = await api('/api/me');
        setUser(data.user);
        setProfile(data.profile);
        registerPushToken();
      } catch {
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function signIn(login, password) {
    const data = await api('/api/signin', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    await saveToken(data.token);
    const me = await api('/api/me');
    setUser(me.user);
    setProfile(me.profile);
  }

  async function signUp(username, email, password) {
    const data = await api('/api/signup', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    await saveToken(data.token);
    const me = await api('/api/me');
    setUser(me.user);
    setProfile(me.profile);
  }

  async function signOut() {
    await clearToken();
    setUser(null);
    setProfile(null);
  }

  async function refreshProfile() {
    const me = await api('/api/me');
    setProfile(me.profile);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
