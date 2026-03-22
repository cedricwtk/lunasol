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
    if (!username.trim() || !email.trim() || !password) { setError('All fields are required.'); return; }
    setError('');
    setLoading(true);
    try { await signUp(username.trim(), email.trim(), password); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logo}>Luna<Text style={styles.logoAccent}>Sol</Text></Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.sub}>Your data syncs across all devices</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>USERNAME</Text>
          <TextInput style={styles.input} value={username} onChangeText={setUsername}
            placeholder="Pick a username" placeholderTextColor={colors.muted} autoCapitalize="none" />

          <Text style={styles.label}>EMAIL</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail}
            placeholder="you@email.com" placeholderTextColor={colors.muted}
            autoCapitalize="none" keyboardType="email-address" />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword}
            placeholder="Min 6 chars, 1 upper, 1 special" placeholderTextColor={colors.muted} secureTextEntry />

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading}>
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
