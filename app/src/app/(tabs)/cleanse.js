import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

const PROTEIN_OPTIONS = ['Chicken', 'Beef', 'Fish', 'Turkey', 'Pork', 'Other'];

export default function Cleanse() {
  const [challenge, setChallenge] = useState(null);
  const [mealPrep, setMealPrep] = useState(null);
  const [todayStr] = useState(() => new Date().toISOString().split('T')[0]);

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  async function loadAll() {
    try {
      const [cData, mData] = await Promise.all([
        api('/api/cleanse'),
        api(`/api/meal-prep?date=${todayStr}`),
      ]);
      setChallenge(cData.challenge);
      setMealPrep(mData.check);
    } catch {}
  }

  async function startChallenge() {
    Alert.alert('Start Cleanse', 'Begin a 14-day cleansing challenge?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start', onPress: async () => {
        try {
          const data = await api('/api/cleanse', { method: 'POST', body: JSON.stringify({ total_days: 14 }) });
          setChallenge(data.challenge);
        } catch {}
      }},
    ]);
  }

  async function checkIn() {
    if (!challenge) return;
    try {
      const data = await api(`/api/cleanse/${challenge.id}/checkin`, { method: 'PATCH' });
      setChallenge(data.challenge);
      Vibration.vibrate(200);
      if (data.challenge.days_left === 0) {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Cleanse Complete!', body: 'You finished your 14-day cleanse! Amazing discipline!', sound: 'default' },
          trigger: null,
        });
        Alert.alert('Cleanse Complete!', 'You made it through the full cleanse! Incredible work!');
      } else {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Cleanse Check-in', body: `Day checked! ${data.challenge.days_left} days remaining.`, sound: 'default' },
          trigger: null,
        });
      }
    } catch {}
  }

  async function resetChallenge() {
    if (!challenge) return;
    Alert.alert('Reset Cleanse', 'Delete this challenge and start over?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        try {
          await api(`/api/cleanse/${challenge.id}`, { method: 'DELETE' });
          setChallenge(null);
        } catch {}
      }},
    ]);
  }

  async function toggleMealItem(field) {
    const current = mealPrep || {};
    const updated = {
      date: todayStr,
      eggs: current.eggs || false,
      protein_shake: current.protein_shake || false,
      veggies: current.veggies || false,
      extra_protein: current.extra_protein || false,
      protein_type: current.protein_type || null,
      [field]: !current[field],
    };
    // If unchecking extra_protein, clear protein_type
    if (field === 'extra_protein' && current.extra_protein) {
      updated.protein_type = null;
    }
    try {
      const data = await api('/api/meal-prep', { method: 'PUT', body: JSON.stringify(updated) });
      setMealPrep(data.check);

      // Check if all items are now checked
      const c = data.check;
      if (c.eggs && c.protein_shake && c.veggies && c.extra_protein) {
        Vibration.vibrate(300);
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Meal Prep Complete!', body: 'All meals checked off for today!', sound: 'default' },
          trigger: null,
        });
      }
    } catch {}
  }

  async function selectProtein(type) {
    const current = mealPrep || {};
    const updated = {
      date: todayStr,
      eggs: current.eggs || false,
      protein_shake: current.protein_shake || false,
      veggies: current.veggies || false,
      extra_protein: true,
      protein_type: type,
    };
    try {
      const data = await api('/api/meal-prep', { method: 'PUT', body: JSON.stringify(updated) });
      setMealPrep(data.check);
    } catch {}
  }

  const progress = challenge ? ((challenge.total_days - challenge.days_left) / challenge.total_days) : 0;
  const checkedCount = mealPrep ? [mealPrep.eggs, mealPrep.protein_shake, mealPrep.veggies, mealPrep.extra_protein].filter(Boolean).length : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.heading}>Cleanse</Text>

      {/* ── Countdown Section ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>14-DAY CLEANSE</Text>

        {!challenge || challenge.completed ? (
          <View style={styles.startCard}>
            {challenge?.completed && (
              <View style={styles.completedBanner}>
                <Ionicons name="trophy" size={28} color={colors.accent} />
                <Text style={styles.completedBannerText}>Last cleanse completed!</Text>
              </View>
            )}
            <Text style={styles.startDesc}>
              Commit to 2 weeks of clean eating. Press the button each day to count down.
            </Text>
            <TouchableOpacity style={styles.startBtn} onPress={startChallenge}>
              <Ionicons name="leaf-outline" size={20} color="#fff" />
              <Text style={styles.startBtnText}>Start 14-Day Cleanse</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.counterCard}>
            {/* Progress bar */}
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              Day {challenge.total_days - challenge.days_left} of {challenge.total_days}
            </Text>

            {/* Big counter */}
            <View style={styles.counterCircle}>
              <Text style={styles.counterNumber}>{challenge.days_left}</Text>
              <Text style={styles.counterLabel}>days left</Text>
            </View>

            {/* Check-in button */}
            <TouchableOpacity style={styles.checkinBtn} onPress={checkIn}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
              <Text style={styles.checkinBtnText}>Check In Today</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={resetChallenge}>
              <Text style={styles.resetBtnText}>Reset Challenge</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Meal Prep Checklist ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>TODAY'S MEAL PREP</Text>
          <Text style={styles.checkCount}>{checkedCount}/4</Text>
        </View>

        {/* Eggs */}
        <TouchableOpacity style={styles.checkItem} onPress={() => toggleMealItem('eggs')}>
          <View style={styles.checkLeft}>
            <Ionicons
              name={mealPrep?.eggs ? 'checkbox' : 'square-outline'}
              size={24}
              color={mealPrep?.eggs ? colors.success : colors.muted}
            />
            <View>
              <Text style={[styles.checkTitle, mealPrep?.eggs && styles.checkedText]}>6 Eggs</Text>
              <Text style={styles.checkSub}>~500 calories</Text>
            </View>
          </View>
          <Ionicons name="egg-outline" size={20} color={colors.textDim} />
        </TouchableOpacity>

        {/* Protein Shake */}
        <TouchableOpacity style={styles.checkItem} onPress={() => toggleMealItem('protein_shake')}>
          <View style={styles.checkLeft}>
            <Ionicons
              name={mealPrep?.protein_shake ? 'checkbox' : 'square-outline'}
              size={24}
              color={mealPrep?.protein_shake ? colors.success : colors.muted}
            />
            <View>
              <Text style={[styles.checkTitle, mealPrep?.protein_shake && styles.checkedText]}>Protein Shake</Text>
              <Text style={styles.checkSub}>1 shake</Text>
            </View>
          </View>
          <Ionicons name="water-outline" size={20} color={colors.textDim} />
        </TouchableOpacity>

        {/* Veggies */}
        <TouchableOpacity style={styles.checkItem} onPress={() => toggleMealItem('veggies')}>
          <View style={styles.checkLeft}>
            <Ionicons
              name={mealPrep?.veggies ? 'checkbox' : 'square-outline'}
              size={24}
              color={mealPrep?.veggies ? colors.success : colors.muted}
            />
            <View>
              <Text style={[styles.checkTitle, mealPrep?.veggies && styles.checkedText]}>Veggies</Text>
              <Text style={styles.checkSub}>Greens & vegetables</Text>
            </View>
          </View>
          <Ionicons name="leaf-outline" size={20} color={colors.textDim} />
        </TouchableOpacity>

        {/* Extra Protein */}
        <TouchableOpacity style={styles.checkItem} onPress={() => toggleMealItem('extra_protein')}>
          <View style={styles.checkLeft}>
            <Ionicons
              name={mealPrep?.extra_protein ? 'checkbox' : 'square-outline'}
              size={24}
              color={mealPrep?.extra_protein ? colors.success : colors.muted}
            />
            <View>
              <Text style={[styles.checkTitle, mealPrep?.extra_protein && styles.checkedText]}>Extra Protein</Text>
              <Text style={styles.checkSub}>
                {mealPrep?.protein_type || 'Chicken, beef, fish...'}
              </Text>
            </View>
          </View>
          <Ionicons name="restaurant-outline" size={20} color={colors.textDim} />
        </TouchableOpacity>

        {/* Protein type selector */}
        {mealPrep?.extra_protein && (
          <View style={styles.proteinPicker}>
            <Text style={styles.proteinPickerLabel}>What protein?</Text>
            <View style={styles.proteinGrid}>
              {PROTEIN_OPTIONS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.proteinChip, mealPrep?.protein_type === p && styles.proteinChipActive]}
                  onPress={() => selectProtein(p)}
                >
                  <Text style={[styles.proteinChipText, mealPrep?.protein_type === p && styles.proteinChipTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* All done banner */}
        {checkedCount === 4 && (
          <View style={styles.allDoneBanner}>
            <Ionicons name="checkmark-done-circle" size={22} color={colors.success} />
            <Text style={styles.allDoneText}>All meals checked off today!</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 20 },

  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: colors.textDim, letterSpacing: 1, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  checkCount: { fontSize: 13, fontWeight: '700', color: colors.accent },

  // Start card
  startCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  completedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  completedBannerText: { fontSize: 15, fontWeight: '600', color: colors.accent },
  startDesc: { fontSize: 13, color: colors.textDim, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14,
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Counter card
  counterCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  progressBarBg: {
    width: '100%', height: 8, borderRadius: 4, backgroundColor: colors.input, overflow: 'hidden', marginBottom: 8,
  },
  progressBarFill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  progressText: { fontSize: 12, color: colors.textDim, marginBottom: 20 },
  counterCircle: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: colors.input, borderWidth: 3, borderColor: colors.accent,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  counterNumber: { fontSize: 48, fontWeight: '800', color: colors.accent },
  counterLabel: { fontSize: 12, color: colors.textDim, marginTop: -4 },
  checkinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.success, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14,
  },
  checkinBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resetBtn: { marginTop: 14 },
  resetBtnText: { color: colors.danger, fontSize: 13, fontWeight: '500' },

  // Meal checklist
  checkItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  checkLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  checkedText: { textDecorationLine: 'line-through', color: colors.muted },
  checkSub: { fontSize: 11, color: colors.textDim, marginTop: 2 },

  // Protein picker
  proteinPicker: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  proteinPickerLabel: { fontSize: 12, color: colors.textDim, marginBottom: 10 },
  proteinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  proteinChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.input,
  },
  proteinChipActive: { borderColor: colors.accent, backgroundColor: colors.accentGlow || 'rgba(232,133,91,0.1)' },
  proteinChipText: { fontSize: 13, fontWeight: '500', color: colors.textDim },
  proteinChipTextActive: { color: colors.accent, fontWeight: '600' },

  // All done
  allDoneBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(92,184,134,0.1)', borderRadius: 12, padding: 14, marginTop: 4,
  },
  allDoneText: { color: colors.success, fontSize: 14, fontWeight: '600' },
});
