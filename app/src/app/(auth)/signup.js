import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../lib/theme';

export default function SignUp() {
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!username.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUp(username.trim(), email.trim(), password);
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
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.sub}>Your data syncs across all devices</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>USERNAME</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Pick a username"
            placeholderTextColor="#3b4a5e"
            autoCapitalize="none"
          />

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
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
            placeholder="Min 6 chars, 1 upper, 1 special"
            placeholderTextColor="#3b4a5e"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Creating...' : 'Sign Up'}</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/signin" style={styles.link}>Sign In</Link>
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
    borderRadius: 12, padding: 28,
    borderWidth: 1, borderColor: colors.border,
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
    flexDirection: 'row', justifyContent: 'center', marginTop: 20,
  },
  footerText: { color: colors.textDim, fontSize: 14 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
