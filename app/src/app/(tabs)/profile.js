import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';

export default function Profile() {
  const { user, signOut } = useAuth();

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color={colors.accent} />
        </View>
        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.card}>
        <InfoRow icon="person-outline" label="Username" value={user?.username} />
        <InfoRow icon="mail-outline" label="Email" value={user?.email} />
        <InfoRow icon="finger-print-outline" label="Account ID" value={`#${user?.id}`} />
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>LunaSol v1.0.0</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.textDim} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  header: { alignItems: 'center', marginBottom: 28, marginTop: 12 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accentGlow,
    borderWidth: 2, borderColor: colors.accent,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  username: { fontSize: 20, fontWeight: '700', color: colors.text },
  email: { fontSize: 13, color: colors.textDim, marginTop: 2 },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 4,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoContent: {},
  infoLabel: { fontSize: 11, fontWeight: '600', color: colors.textDim, letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: colors.text, marginTop: 2 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 28, paddingVertical: 14, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    backgroundColor: 'rgba(248,113,113,0.06)',
  },
  signOutText: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  footer: { textAlign: 'center', color: colors.textDim, fontSize: 12, marginTop: 'auto', paddingTop: 32 },
});
