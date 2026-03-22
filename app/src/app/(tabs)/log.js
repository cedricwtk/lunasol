import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';

export default function DailyLog() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [meals, setMeals] = useState([]);
  const [dayLog, setDayLog] = useState(null);
  const [label, setLabel] = useState('');
  const [calories, setCalories] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  function todayStr() { return new Date().toISOString().split('T')[0]; }

  const loadDay = useCallback(async (d) => {
    try {
      const data = await api(`/api/meals?date=${d}`);
      setMeals(data.meals || []);
      setDayLog(data.log);
    } catch {}
  }, []);

  async function loadHistory() {
    try {
      const data = await api('/api/daily-logs');
      setHistory(data.logs || []);
    } catch {}
  }

  useEffect(() => { loadDay(date); loadHistory(); }, [date, loadDay]);

  async function addMeal() {
    if (!label.trim()) return;
    const cal = parseInt(calories, 10);
    if (!cal || cal <= 0) return;
    try {
      await api('/api/meals', { method: 'POST', body: JSON.stringify({ label: label.trim(), calories: cal, date }) });
      setLabel(''); setCalories('');
      await loadDay(date); await loadHistory();
    } catch {}
  }

  async function deleteMeal(id) {
    try { await api(`/api/meals/${id}`, { method: 'DELETE' }); await loadDay(date); await loadHistory(); } catch {}
  }

  async function markDay(success) {
    try { await api('/api/daily-log', { method: 'PUT', body: JSON.stringify({ date, success }) }); await loadDay(date); await loadHistory(); } catch {}
  }

  const totalCal = meals.reduce((sum, m) => sum + (m.calories || 0), 0);

  function shiftDate(days) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  }

  function fmtDate(str) {
    const today = todayStr();
    if (str === today) return 'Today';
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (str === y.toISOString().split('T')[0]) return 'Yesterday';
    return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function fmtHistDate(str) {
    return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {/* Greeting */}
        <Text style={styles.greeting}>{greeting}, {user?.username}!</Text>

        {/* Date nav */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateArrow}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.dateText}>{fmtDate(date)}</Text>
          <TouchableOpacity onPress={() => shiftDate(1)} style={styles.dateArrow} disabled={date >= todayStr()}>
            <Ionicons name="chevron-forward" size={20} color={date >= todayStr() ? colors.border : colors.text} />
          </TouchableOpacity>
        </View>

        {/* Total + status */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text style={styles.totalLabel}>TOTAL CALORIES</Text>
            <Text style={styles.totalValue}>{totalCal.toLocaleString()}</Text>
            <Text style={styles.totalUnit}>kcal</Text>
          </View>
          <View style={styles.statusBtns}>
            <TouchableOpacity style={[styles.statusBtn, dayLog?.success === true && styles.statusSuccess]} onPress={() => markDay(true)}>
              <Ionicons name="checkmark" size={20} color={dayLog?.success === true ? '#fff' : colors.success} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statusBtn, dayLog?.success === false && styles.statusFail]} onPress={() => markDay(false)}>
              <Ionicons name="close" size={20} color={dayLog?.success === false ? '#fff' : colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Add meal */}
        <View style={styles.addRow}>
          <TextInput style={[styles.input, { flex: 2 }]} value={label} onChangeText={setLabel}
            placeholder="Meal name" placeholderTextColor={colors.muted} />
          <TextInput style={[styles.input, { flex: 1 }]} value={calories} onChangeText={setCalories}
            placeholder="kcal" placeholderTextColor={colors.muted} keyboardType="numeric" />
          <TouchableOpacity style={styles.addBtn} onPress={addMeal}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Meal list */}
        {meals.length === 0 ? (
          <Text style={styles.empty}>No meals logged for this day.</Text>
        ) : (
          meals.map(m => (
            <View key={m.id} style={styles.mealItem}>
              <View>
                <Text style={styles.mealLabel}>{m.label}</Text>
                <Text style={styles.mealCal}>{m.calories.toLocaleString()} kcal</Text>
              </View>
              <TouchableOpacity onPress={() => deleteMeal(m.id)}>
                <Ionicons name="trash-outline" size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* History */}
        <TouchableOpacity style={styles.historyToggle} onPress={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}>
          <Text style={styles.historyToggleText}>{showHistory ? 'Hide History' : 'Show History'}</Text>
          <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
        </TouchableOpacity>

        {showHistory && history.length > 0 && (
          <View>
            {history.map((h, i) => (
              <TouchableOpacity key={i} style={styles.historyRow} onPress={() => { setDate(h.log_date.split('T')[0]); setShowHistory(false); }}>
                <View style={styles.historyLeft}>
                  {h.success === true && <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
                  {h.success === false && <Ionicons name="close-circle" size={16} color={colors.danger} />}
                  {h.success === null && <Ionicons name="ellipse-outline" size={16} color={colors.muted} />}
                  <Text style={styles.historyDate}>{fmtHistDate(h.log_date)}</Text>
                </View>
                <Text style={styles.historyCal}>{parseInt(h.total_calories).toLocaleString()} kcal</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 16 },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 },
  dateArrow: { padding: 8, backgroundColor: colors.card, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  dateText: { fontSize: 16, fontWeight: '600', color: colors.text, minWidth: 120, textAlign: 'center' },
  summaryCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  summaryLeft: {},
  totalLabel: { fontSize: 10, fontWeight: '600', color: colors.textDim, letterSpacing: 1 },
  totalValue: { fontSize: 36, fontWeight: '800', color: colors.accent, lineHeight: 42 },
  totalUnit: { fontSize: 12, color: colors.textDim },
  statusBtns: { gap: 10 },
  statusBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.input,
    justifyContent: 'center', alignItems: 'center',
  },
  statusSuccess: { backgroundColor: colors.success, borderColor: colors.success },
  statusFail: { backgroundColor: colors.danger, borderColor: colors.danger },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 12, color: colors.text, fontSize: 14,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  addBtn: { backgroundColor: colors.accent, borderRadius: 12, width: 46, justifyContent: 'center', alignItems: 'center' },
  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  mealItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  mealLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  mealCal: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  historyToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  historyToggleText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyDate: { fontSize: 13, color: colors.text },
  historyCal: { fontSize: 13, color: colors.textDim, fontWeight: '600' },
});
