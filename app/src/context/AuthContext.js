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

      // Schedule daily reminders (cancel old ones first)
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Reminder to log food - 12:00 PM daily
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Log Your Meals', body: "Don't forget to log your food intake today!", sound: 'default' },
        trigger: { type: 'daily', hour: 12, minute: 0 },
      });

      // Reminder to check in cleanse - 9:00 PM daily
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Cleanse Check-in', body: 'Have you checked in for your cleanse today?', sound: 'default' },
        trigger: { type: 'daily', hour: 21, minute: 0 },
      });
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
