import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

const ACTIVITIES = [
  { label: 'Sedentary (little/no exercise)', value: 1.2 },
  { label: 'Light (1–3 days/week)', value: 1.375 },
  { label: 'Moderate (3–5 days/week)', value: 1.55 },
  { label: 'Very Active (6–7 days/week)', value: 1.725 },
  { label: 'Extreme (2x/day or physical job)', value: 1.9 },
];

const GOALS = [
  { label: 'Aggressive Cut (−1 kg/wk)', value: -1000 },
  { label: 'Moderate Cut (−0.5 kg/wk)', value: -500 },
  { label: 'Maintain Weight', value: 0 },
  { label: 'Lean Bulk (+0.25 kg/wk)', value: 250 },
  { label: 'Bulk (+0.5 kg/wk)', value: 500 },
];

export default function Calculator() {
  const { profile, refreshProfile } = useAuth();
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activityIdx, setActivityIdx] = useState(2);
  const [goalIdx, setGoalIdx] = useState(1);
  const [results, setResults] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.age) setAge(String(profile.age));
      if (profile.sex) setSex(profile.sex);
      if (profile.height_cm) setHeight(String(parseFloat(profile.height_cm)));
      if (profile.weight_kg) setWeight(String(parseFloat(profile.weight_kg)));
      if (profile.activity_level) {
        const idx = ACTIVITIES.findIndex(a => Math.abs(a.value - parseFloat(profile.activity_level)) < 0.01);
        if (idx >= 0) setActivityIdx(idx);
      }
      if (profile.goal !== null && profile.goal !== undefined) {
        const idx = GOALS.findIndex(g => g.value === parseInt(profile.goal));
        if (idx >= 0) setGoalIdx(idx);
      }
    }
  }, [profile]);

  function calculate() {
    const a = parseFloat(age);
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!a || !h || !w) return;

    const bmr = sex === 'male'
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161;

    const tdee = Math.round(bmr * ACTIVITIES[activityIdx].value);
    const target = Math.max(1200, tdee + GOALS[goalIdx].value);
    const bmi = w / ((h / 100) ** 2);

    const proteinG = Math.round(w * 2);
    const proteinKcal = proteinG * 4;
    const fatKcal = Math.round(target * 0.25);
    const fatG = Math.round(fatKcal / 9);
    const carbKcal = Math.max(0, target - proteinKcal - fatKcal);
    const carbG = Math.round(carbKcal / 4);

    setResults({ bmr: Math.round(bmr), tdee, target, bmi, proteinG, fatG, carbG });
  }

  async function saveProfile() {
    try {
      await api('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          age: parseInt(age) || null,
          sex,
          height_cm: parseFloat(height) || null,
          weight_kg: parseFloat(weight) || null,
          activity_level: ACTIVITIES[activityIdx].value,
          goal: GOALS[goalIdx].value,
        }),
      });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  }

  function bmiCategory(bmi) {
    if (bmi < 18.5) return { label: 'Underweight', color: '#4f8aff' };
    if (bmi < 25) return { label: 'Normal', color: colors.success };
    if (bmi < 30) return { label: 'Overweight', color: colors.accent2 };
    return { label: 'Obese', color: colors.danger };
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Calorie Calculator</Text>
        <Text style={styles.sub}>Mifflin-St Jeor equation — adjust your stats anytime</Text>

        {/* Sex toggle */}
        <Text style={styles.label}>BIOLOGICAL SEX</Text>
        <View style={styles.toggleRow}>
          {['male', 'female'].map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.toggleBtn, sex === s && styles.toggleActive]}
              onPress={() => setSex(s)}
            >
              <Text style={[styles.toggleText, sex === s && styles.toggleTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Inputs */}
        <View style={styles.row}>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>AGE</Text>
            <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="numeric" placeholder="28" placeholderTextColor={colors.muted} />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>HEIGHT (CM)</Text>
            <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="178" placeholderTextColor={colors.muted} />
          </View>
        </View>

        <Text style={styles.label}>WEIGHT (KG)</Text>
        <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="75" placeholderTextColor={colors.muted} />

        {/* Activity */}
        <Text style={styles.label}>ACTIVITY LEVEL</Text>
        <View style={styles.pillWrap}>
          {ACTIVITIES.map((a, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.pill, activityIdx === i && styles.pillActive]}
              onPress={() => setActivityIdx(i)}
            >
              <Text style={[styles.pillText, activityIdx === i && styles.pillTextActive]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Goal */}
        <Text style={styles.label}>GOAL</Text>
        <View style={styles.pillWrap}>
          {GOALS.map((g, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.pill, goalIdx === i && styles.pillActive]}
              onPress={() => setGoalIdx(i)}
            >
              <Text style={[styles.pillText, goalIdx === i && styles.pillTextActive]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.btnPrimary} onPress={calculate}>
            <Text style={styles.btnPrimaryText}>Calculate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={saveProfile}>
            <Text style={styles.btnOutlineText}>{saved ? 'Saved!' : 'Save Stats'}</Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        {results && (
          <View style={styles.results}>
            <View style={styles.resultRow}>
              <ResultCard label="BMR" value={results.bmr.toLocaleString()} unit="kcal/day" />
              <ResultCard label="TDEE" value={results.tdee.toLocaleString()} unit="kcal/day" />
              <ResultCard label="Target" value={results.target.toLocaleString()} unit="kcal/day" highlight />
            </View>

            <View style={styles.bmiRow}>
              <Text style={styles.bmiLabel}>BMI: </Text>
              <Text style={styles.bmiValue}>{results.bmi.toFixed(1)}</Text>
              <View style={[styles.bmiBadge, { backgroundColor: bmiCategory(results.bmi).color + '22' }]}>
                <Text style={[styles.bmiBadgeText, { color: bmiCategory(results.bmi).color }]}>
                  {bmiCategory(results.bmi).label}
                </Text>
              </View>
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>DAILY MACROS</Text>
            <View style={styles.macroBar}>
              <View style={[styles.macroSeg, { flex: results.proteinG * 4, backgroundColor: '#4f8aff' }]}>
                <Text style={styles.macroSegText}>P</Text>
              </View>
              <View style={[styles.macroSeg, { flex: results.fatG * 9, backgroundColor: colors.accent2 }]}>
                <Text style={styles.macroSegText}>F</Text>
              </View>
              <View style={[styles.macroSeg, { flex: results.carbG * 4, backgroundColor: colors.accent }]}>
                <Text style={styles.macroSegText}>C</Text>
              </View>
            </View>
            <View style={styles.macroDetails}>
              <MacroItem color="#4f8aff" label="Protein" grams={results.proteinG} />
              <MacroItem color={colors.accent2} label="Fat" grams={results.fatG} />
              <MacroItem color={colors.accent} label="Carbs" grams={results.carbG} />
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ResultCard({ label, value, unit, highlight }) {
  return (
    <View style={[styles.resultCard, highlight && styles.resultCardHighlight]}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, highlight && { color: colors.accent }]}>{value}</Text>
      <Text style={styles.resultUnit}>{unit}</Text>
    </View>
  );
}

function MacroItem({ color, label, grams }) {
  return (
    <View style={styles.macroItem}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroText}><Text style={{ fontWeight: '700' }}>{grams}g</Text> {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  heading: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4 },
  sub: { fontSize: 13, color: colors.textDim, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '600', color: colors.textDim, letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 14, color: colors.text, fontSize: 15,
  },
  row: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1, padding: 12, borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  toggleActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  toggleText: { color: colors.textDim, fontWeight: '600', fontSize: 14 },
  toggleTextActive: { color: colors.accent },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  pillText: { fontSize: 12, color: colors.textDim, fontWeight: '500' },
  pillTextActive: { color: colors.accent, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btnPrimary: {
    flex: 1, backgroundColor: colors.accent, borderRadius: 8,
    padding: 14, alignItems: 'center',
  },
  btnPrimaryText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  btnOutline: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 14, alignItems: 'center',
  },
  btnOutlineText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  results: {
    marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border,
  },
  resultRow: { flexDirection: 'row', gap: 10 },
  resultCard: {
    flex: 1, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 14,
  },
  resultCardHighlight: { borderColor: 'rgba(232,133,91,0.4)' },
  resultLabel: { fontSize: 10, fontWeight: '600', color: colors.textDim, letterSpacing: 0.8, marginBottom: 6 },
  resultValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  resultUnit: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  bmiRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 8 },
  bmiLabel: { fontSize: 13, color: colors.textDim },
  bmiValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  bmiBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  bmiBadgeText: { fontSize: 12, fontWeight: '700' },
  macroBar: { flexDirection: 'row', height: 28, borderRadius: 6, overflow: 'hidden' },
  macroSeg: { justifyContent: 'center', alignItems: 'center' },
  macroSegText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },
  macroDetails: { flexDirection: 'row', gap: 20, marginTop: 12 },
  macroItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroDot: { width: 10, height: 10, borderRadius: 5 },
  macroText: { fontSize: 13, color: colors.text },
});
