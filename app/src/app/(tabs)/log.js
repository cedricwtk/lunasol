import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

export default function DailyLog() {
  const [date, setDate] = useState(todayStr());
  const [meals, setMeals] = useState([]);
  const [dayLog, setDayLog] = useState(null);
  const [label, setLabel] = useState('');
  const [calories, setCalories] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

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

  useEffect(() => {
    loadDay(date);
    loadHistory();
  }, [date, loadDay]);

  async function addMeal() {
    if (!label.trim()) return;
    const cal = parseInt(calories, 10);
    if (!cal || cal <= 0) return;

    try {
      await api('/api/meals', {
        method: 'POST',
        body: JSON.stringify({ label: label.trim(), calories: cal, date }),
      });
      setLabel('');
      setCalories('');
      await loadDay(date);
      await loadHistory();
    } catch {}
  }

  async function deleteMeal(id) {
    try {
      await api(`/api/meals/${id}`, { method: 'DELETE' });
      await loadDay(date);
      await loadHistory();
    } catch {}
  }

  async function markDay(success) {
    try {
      await api('/api/daily-log', {
        method: 'PUT',
        body: JSON.stringify({ date, success }),
      });
      await loadDay(date);
      await loadHistory();
    } catch {}
  }

  const totalCal = meals.reduce((sum, m) => sum + (m.calories || 0), 0);

  function shiftDate(days) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  }

  function fmtDate(str) {
    const d = new Date(str + 'T00:00:00');
    const today = todayStr();
    if (str === today) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (str === yesterday.toISOString().split('T')[0]) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function fmtHistDate(str) {
    return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Daily Calorie Log</Text>

        {/* Date nav */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateArrow}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.dateText}>{fmtDate(date)}</Text>
          <TouchableOpacity
            onPress={() => shiftDate(1)}
            style={styles.dateArrow}
            disabled={date >= todayStr()}
          >
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
            <TouchableOpacity
              style={[styles.statusBtn, dayLog?.success === true && styles.statusSuccess]}
              onPress={() => markDay(true)}
            >
              <Ionicons name="checkmark" size={20} color={dayLog?.success === true ? '#fff' : colors.success} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusBtn, dayLog?.success === false && styles.statusFail]}
              onPress={() => markDay(false)}
            >
              <Ionicons name="close" size={20} color={dayLog?.success === false ? '#fff' : colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Add meal */}
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            value={label}
            onChangeText={setLabel}
            placeholder="Meal name"
            placeholderTextColor="#3b4a5e"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={calories}
            onChangeText={setCalories}
            placeholder="kcal"
            placeholderTextColor="#3b4a5e"
            keyboardType="numeric"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addMeal}>
            <Ionicons name="add" size={22} color={colors.bg} />
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
                <Ionicons name="trash-outline" size={16} color={colors.textDim} />
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* History toggle */}
        <TouchableOpacity style={styles.historyToggle} onPress={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}>
          <Text style={styles.historyToggleText}>{showHistory ? 'Hide History' : 'Show History'}</Text>
          <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
        </TouchableOpacity>

        {showHistory && history.length > 0 && (
          <View style={styles.historySection}>
            {history.map((h, i) => (
              <TouchableOpacity key={i} style={styles.historyRow} onPress={() => { setDate(h.log_date.split('T')[0]); setShowHistory(false); }}>
                <View style={styles.historyLeft}>
                  {h.success === true && <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
                  {h.success === false && <Ionicons name="close-circle" size={16} color={colors.danger} />}
                  {h.success === null && <Ionicons name="ellipse-outline" size={16} color={colors.textDim} />}
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
  heading: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 16 },

  // Date nav
  dateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 16, marginBottom: 16,
  },
  dateArrow: { padding: 8 },
  dateText: { fontSize: 16, fontWeight: '600', color: colors.text, minWidth: 120, textAlign: 'center' },

  // Summary
  summaryCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 20, marginBottom: 20,
  },
  summaryLeft: {},
  totalLabel: { fontSize: 10, fontWeight: '600', color: colors.textDim, letterSpacing: 1 },
  totalValue: { fontSize: 36, fontWeight: '800', color: colors.accent, lineHeight: 42 },
  totalUnit: { fontSize: 12, color: colors.textDim },
  statusBtns: { gap: 10 },
  statusBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  statusSuccess: { backgroundColor: colors.success, borderColor: colors.success },
  statusFail: { backgroundColor: colors.danger, borderColor: colors.danger },

  // Add meal
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 12, color: colors.text, fontSize: 14,
  },
  addBtn: {
    backgroundColor: colors.accent, borderRadius: 8,
    width: 46, justifyContent: 'center', alignItems: 'center',
  },

  // Meals
  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  mealItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 14, marginBottom: 8,
  },
  mealLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  mealCal: { fontSize: 12, color: colors.textDim, marginTop: 2 },

  // History
  historyToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 20, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  historyToggleText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  historySection: { marginTop: 8 },
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyDate: { fontSize: 13, color: colors.text },
  historyCal: { fontSize: 13, color: colors.textDim, fontWeight: '600' },
});
