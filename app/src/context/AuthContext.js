import { createContext, useContext, useState, useEffect } from 'react';
import { api, loadToken, saveToken, clearToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await loadToken();
        const data = await api('/api/me');
        setUser(data.user);
        setProfile(data.profile);
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
