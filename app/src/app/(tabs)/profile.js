import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
  Image, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { api, BASE_URL } from '../../lib/api';
import { colors } from '../../lib/theme';
import Calculator from './calculator';

export default function Profile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [showCalc, setShowCalc] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  const displayAvatar = avatarUri || (user?.avatar_url ? `${BASE_URL}${user.avatar_url}` : null);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      try {
        const formData = new FormData();
        formData.append('avatar', {
          uri,
          name: 'avatar.jpg',
          type: 'image/jpeg',
        });
        await api('/api/avatar', {
          method: 'POST',
          body: formData,
        });
      } catch {}
    }
  }

  // Build calorie summary from profile
  let calorieSummary = null;
  if (profile?.age && profile?.height_cm && profile?.weight_kg) {
    const w = parseFloat(profile.weight_kg), h = parseFloat(profile.height_cm), a = profile.age;
    const bmr = profile.sex === 'female' ? 10*w + 6.25*h - 5*a - 161 : 10*w + 6.25*h - 5*a + 5;
    const tdee = Math.round(bmr * parseFloat(profile.activity_level || 1.55));
    const target = Math.max(1200, tdee + parseInt(profile.goal || -500));
    calorieSummary = { bmr: Math.round(bmr), tdee, target };
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Avatar + Name */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatarWrap} onPress={pickImage}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={36} color={colors.accent} />
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Calorie Goal Card */}
      <TouchableOpacity style={styles.goalCard} onPress={() => setShowCalc(true)}>
        <View style={styles.goalLeft}>
          <Ionicons name="calculator-outline" size={22} color={colors.accent} />
          <View>
            <Text style={styles.goalTitle}>Daily Calorie Goal</Text>
            {calorieSummary ? (
              <Text style={styles.goalValue}>{calorieSummary.target.toLocaleString()} kcal/day</Text>
            ) : (
              <Text style={styles.goalSub}>Tap to set up your stats</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </TouchableOpacity>

      {/* Quick stats from profile */}
      {calorieSummary && (
        <View style={styles.quickStats}>
          <QuickStat label="BMR" value={`${calorieSummary.bmr}`} unit="kcal" />
          <QuickStat label="TDEE" value={`${calorieSummary.tdee}`} unit="kcal" />
          <QuickStat label="Weight" value={`${parseFloat(profile.weight_kg).toFixed(1)}`} unit="kg" />
        </View>
      )}

      {/* Account info */}
      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.infoCard}>
        <InfoRow icon="person-outline" label="Username" value={user?.username} />
        <InfoRow icon="mail-outline" label="Email" value={user?.email} />
        <InfoRow icon="finger-print-outline" label="Account ID" value={`#${user?.id}`} last />
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>LunaSol v1.0.0</Text>

      {/* Calculator Modal */}
      <Modal visible={showCalc} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowCalc(false); refreshProfile(); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Calorie Calculator</Text>
            <View style={{ width: 24 }} />
          </View>
          <Calculator />
          <TouchableOpacity style={styles.closeModalBtn} onPress={() => { setShowCalc(false); refreshProfile(); }}>
            <Text style={styles.closeModalBtnText}>Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, last }) {
  return (
    <View style={[infoStyles.row, !last && infoStyles.border]}>
      <Ionicons name={icon} size={18} color={colors.textDim} />
      <View>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function QuickStat({ label, value, unit }) {
  return (
    <View style={qStyles.item}>
      <Text style={qStyles.value}>{value}<Text style={qStyles.unit}> {unit}</Text></Text>
      <Text style={qStyles.label}>{label}</Text>
    </View>
  );
}

const qStyles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center' },
  value: { fontSize: 18, fontWeight: '700', color: colors.text },
  unit: { fontSize: 12, fontWeight: '500', color: colors.textDim },
  label: { fontSize: 10, color: colors.textDim, fontWeight: '600', letterSpacing: 0.5, marginTop: 2 },
});

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: 11, fontWeight: '600', color: colors.textDim, letterSpacing: 0.5 },
  value: { fontSize: 15, color: colors.text, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },

  header: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accentGlow,
    borderWidth: 2, borderColor: colors.accent, justifyContent: 'center', alignItems: 'center',
  },
  avatarImg: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: colors.accent },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.bg,
  },
  username: { fontSize: 20, fontWeight: '700', color: colors.text },
  email: { fontSize: 13, color: colors.textDim, marginTop: 2 },

  goalCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  goalLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  goalValue: { fontSize: 13, color: colors.accent, fontWeight: '600', marginTop: 2 },
  goalSub: { fontSize: 12, color: colors.textDim, marginTop: 2 },

  quickStats: {
    flexDirection: 'row', backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: colors.textDim, letterSpacing: 1, marginBottom: 10, marginTop: 20 },

  infoCard: {
    backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 28, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(226,92,92,0.2)', backgroundColor: 'rgba(226,92,92,0.04)',
  },
  signOutText: { color: colors.danger, fontWeight: '600', fontSize: 14 },

  footer: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 24 },

  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, backgroundColor: colors.bg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },

  closeModalBtn: {
    margin: 16, padding: 14, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  closeModalBtnText: { color: colors.textDim, fontWeight: '600', fontSize: 15 },
});
