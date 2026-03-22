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
    if (!login.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn(login.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logo}>Luna<Text style={styles.logoAccent}>Sol</Text></Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to sync your data</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>EMAIL OR USERNAME</Text>
          <TextInput
            style={styles.input}
            value={login}
            onChangeText={setLogin}
            placeholder="you@email.com"
            placeholderTextColor="#3b4a5e"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#3b4a5e"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
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
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: {
    fontSize: 26, fontWeight: '800', color: colors.text,
    textAlign: 'center', marginBottom: 24,
  },
  logoAccent: { color: colors.accent },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 4 },
  sub: { fontSize: 14, color: colors.textDim, marginBottom: 24 },
  label: {
    fontSize: 11, fontWeight: '600', color: colors.textDim,
    letterSpacing: 1, marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: colors.input,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 14, color: colors.text, fontSize: 15,
  },
  btn: {
    backgroundColor: colors.accent, borderRadius: 8,
    padding: 15, alignItems: 'center', marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  error: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: 8, padding: 12,
    color: colors.danger, fontSize: 13, marginBottom: 8,
  },
  footer: {
    flexDirection: 'row', justifyContent: 'center',
    marginTop: 20,
  },
  footerText: { color: colors.textDim, fontSize: 14 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
