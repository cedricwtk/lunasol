import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../lib/theme';

export default function SignIn() {
  const { signIn } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!login.trim() || !password) { setError('All fields are required.'); return; }
    setError('');
    setLoading(true);
    try { await signIn(login.trim(), password); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logo}>Luna<Text style={styles.logoAccent}>Sol</Text></Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to sync your data</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>EMAIL OR USERNAME</Text>
          <TextInput style={styles.input} value={login} onChangeText={setLogin}
            placeholder="you@email.com" placeholderTextColor={colors.muted}
            autoCapitalize="none" keyboardType="email-address" />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword}
            placeholder="••••••••" placeholderTextColor={colors.muted} secureTextEntry />

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/signup" style={styles.link}>Sign Up</Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  logo: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 28 },
  logoAccent: { color: colors.accent },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 4 },
  sub: { fontSize: 14, color: colors.textDim, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '600', color: colors.textDim, letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 14, color: colors.text, fontSize: 15,
  },
  btn: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: {
    backgroundColor: 'rgba(226,92,92,0.08)', borderWidth: 1, borderColor: 'rgba(226,92,92,0.2)',
    borderRadius: 10, padding: 12, color: colors.danger, fontSize: 13, marginBottom: 8,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: colors.textDim, fontSize: 14 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
