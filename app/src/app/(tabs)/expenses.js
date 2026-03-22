import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

const NECESSARY_SUBS = ['Food', 'Living Necessities', 'Other'];

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [customCats, setCustomCats] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [catType, setCatType] = useState('necessary');
  const [subcategory, setSubcategory] = useState(NECESSARY_SUBS[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  function todayStr() { return new Date().toISOString().split('T')[0]; }
  function currentMonth() { return new Date().toISOString().slice(0, 7); }

  const fetchData = useCallback(async () => {
    try {
      const [expData, catData] = await Promise.all([
        api(`/api/expenses?month=${month}`),
        api('/api/expense-categories'),
      ]);
      setExpenses(expData.expenses || []);
      setCustomCats(catData.categories || []);
    } catch {}
  }, [month]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  function shiftMonth(dir) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function fmtMonth(m) {
    const [y, mo] = m.split('-');
    return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  async function addExpense() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (!subcategory) return;
    try {
      await api('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({ amount: amt, category_type: catType, subcategory, note, date }),
      });
      setAmount(''); setNote(''); setShowAdd(false);
      await fetchData();
    } catch {}
  }

  async function deleteExpense(id) {
    Alert.alert('Delete', 'Remove this expense?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api(`/api/expenses/${id}`, { method: 'DELETE' }); await fetchData(); } catch {}
      }},
    ]);
  }

  async function addCustomCategory() {
    if (!newCatName.trim()) return;
    try {
      await api('/api/expense-categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      setNewCatName(''); setShowNewCat(false);
      const catData = await api('/api/expense-categories');
      setCustomCats(catData.categories || []);
    } catch {}
  }

  async function deleteCategory(id) {
    try {
      await api(`/api/expense-categories/${id}`, { method: 'DELETE' });
      const catData = await api('/api/expense-categories');
      setCustomCats(catData.categories || []);
    } catch {}
  }

  // Totals
  const necessaryTotal = expenses.filter(e => e.category_type === 'necessary').reduce((s, e) => s + parseFloat(e.amount), 0);
  const unnecessaryTotal = expenses.filter(e => e.category_type === 'unnecessary').reduce((s, e) => s + parseFloat(e.amount), 0);
  const grandTotal = necessaryTotal + unnecessaryTotal;

  // Group expenses by date
  const grouped = {};
  expenses.forEach(e => {
    const d = e.expense_date.split('T')[0];
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(e);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Available subcategories for unnecessary
  const unnecessarySubs = customCats.map(c => c.name);

  function openAdd() {
    setCatType('necessary');
    setSubcategory(NECESSARY_SUBS[0]);
    setAmount('');
    setNote('');
    setDate(todayStr());
    setShowAdd(true);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}>

        <Text style={styles.heading}>Expenses</Text>

        {/* Month nav */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{fmtMonth(month)}</Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.monthArrow}
            disabled={month >= currentMonth()}>
            <Ionicons name="chevron-forward" size={20} color={month >= currentMonth() ? colors.border : colors.text} />
          </TouchableOpacity>
        </View>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: colors.accent }]}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>${grandTotal.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryHalf, { borderLeftColor: colors.success }]}>
            <Text style={styles.summaryLabel}>Necessary</Text>
            <Text style={[styles.summaryValue, { fontSize: 18 }]}>${necessaryTotal.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryHalf, { borderLeftColor: colors.danger }]}>
            <Text style={styles.summaryLabel}>Unnecessary</Text>
            <Text style={[styles.summaryValue, { fontSize: 18 }]}>${unnecessaryTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Expense list by date */}
        {sortedDates.length === 0 ? (
          <Text style={styles.empty}>No expenses this month.</Text>
        ) : (
          sortedDates.map(d => (
            <View key={d}>
              <Text style={styles.dateHeader}>
                {new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                <Text style={styles.dateTotalInline}>
                  {' '}— ${grouped[d].reduce((s, e) => s + parseFloat(e.amount), 0).toFixed(2)}
                </Text>
              </Text>
              {grouped[d].map(e => (
                <TouchableOpacity key={e.id} style={styles.expenseItem} onLongPress={() => deleteExpense(e.id)}>
                  <View style={styles.expenseLeft}>
                    <View style={[styles.catDot, { backgroundColor: e.category_type === 'necessary' ? colors.success : colors.danger }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expenseSub}>{e.subcategory}</Text>
                      {e.note ? <Text style={styles.expenseNote}>{e.note}</Text> : null}
                    </View>
                  </View>
                  <Text style={styles.expenseAmount}>${parseFloat(e.amount).toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Expense Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Expense</Text>
            <TouchableOpacity onPress={addExpense}>
              <Text style={styles.saveBtn}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* Amount */}
            <Text style={styles.label}>AMOUNT</Text>
            <TextInput style={styles.amountInput} value={amount} onChangeText={setAmount}
              keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} />

            {/* Date */}
            <Text style={styles.label}>DATE</Text>
            <TextInput style={styles.input} value={date} onChangeText={setDate}
              placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />

            {/* Type toggle */}
            <Text style={styles.label}>TYPE</Text>
            <View style={styles.toggleRow}>
              {['necessary', 'unnecessary'].map(t => (
                <TouchableOpacity key={t}
                  style={[styles.toggleBtn, catType === t && styles.toggleActive]}
                  onPress={() => {
                    setCatType(t);
                    setSubcategory(t === 'necessary' ? NECESSARY_SUBS[0] : (unnecessarySubs[0] || ''));
                  }}>
                  <Text style={[styles.toggleText, catType === t && styles.toggleTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subcategory */}
            <Text style={styles.label}>CATEGORY</Text>
            {catType === 'necessary' ? (
              <View style={styles.pillWrap}>
                {NECESSARY_SUBS.map(s => (
                  <TouchableOpacity key={s}
                    style={[styles.pill, subcategory === s && styles.pillActive]}
                    onPress={() => setSubcategory(s)}>
                    <Text style={[styles.pillText, subcategory === s && styles.pillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View>
                <View style={styles.pillWrap}>
                  {unnecessarySubs.map(s => (
                    <TouchableOpacity key={s}
                      style={[styles.pill, subcategory === s && styles.pillActive]}
                      onPress={() => setSubcategory(s)}>
                      <Text style={[styles.pillText, subcategory === s && styles.pillTextActive]}>{s}</Text>
                      <TouchableOpacity onPress={() => deleteCategory(customCats.find(c => c.name === s)?.id)} hitSlop={8}>
                        <Ionicons name="close-circle" size={14} color={subcategory === s ? colors.accent : colors.muted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.addCatBtn} onPress={() => setShowNewCat(true)}>
                    <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
                    <Text style={styles.addCatText}>Add</Text>
                  </TouchableOpacity>
                </View>
                {showNewCat && (
                  <View style={styles.newCatRow}>
                    <TextInput style={[styles.input, { flex: 1 }]} value={newCatName} onChangeText={setNewCatName}
                      placeholder="Category name" placeholderTextColor={colors.muted} autoFocus />
                    <TouchableOpacity style={styles.newCatSave} onPress={addCustomCategory}>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
                {unnecessarySubs.length === 0 && !showNewCat && (
                  <Text style={styles.emptyHint}>No custom categories yet. Tap "Add" to create one.</Text>
                )}
              </View>
            )}

            {/* Note */}
            <Text style={styles.label}>NOTE (OPTIONAL)</Text>
            <TextInput style={[styles.input, { minHeight: 60 }]} value={note} onChangeText={setNote}
              placeholder="Add a note..." placeholderTextColor={colors.muted} multiline />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 16 },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 },
  monthArrow: { padding: 8, backgroundColor: colors.card, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  monthText: { fontSize: 16, fontWeight: '600', color: colors.text, minWidth: 160, textAlign: 'center' },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  summaryCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 16,
    borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  summaryHalf: { flex: 1 },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: colors.textDim, letterSpacing: 0.5 },
  summaryValue: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 4 },

  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 32 },

  dateHeader: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 20, marginBottom: 8 },
  dateTotalInline: { fontWeight: '400', color: colors.textDim },

  expenseItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 6,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  expenseLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  expenseSub: { fontSize: 14, fontWeight: '600', color: colors.text },
  expenseNote: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  expenseAmount: { fontSize: 15, fontWeight: '700', color: colors.text, marginLeft: 12 },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  saveBtn: { fontSize: 15, fontWeight: '700', color: colors.accent },
  modalBody: { padding: 20 },

  label: { fontSize: 11, fontWeight: '600', color: colors.textDim, letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, color: colors.text, fontSize: 14,
  },
  amountInput: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, color: colors.text, fontSize: 28, fontWeight: '700', textAlign: 'center',
  },

  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1, padding: 12, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  toggleActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  toggleText: { color: colors.textDim, fontWeight: '600', fontSize: 14 },
  toggleTextActive: { color: colors.accent },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  pillActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  pillText: { fontSize: 13, color: colors.textDim, fontWeight: '500' },
  pillTextActive: { color: colors.accent, fontWeight: '600' },

  addCatBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8 },
  addCatText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  newCatRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  newCatSave: { backgroundColor: colors.accent, borderRadius: 12, width: 44, justifyContent: 'center', alignItems: 'center' },
  emptyHint: { color: colors.textDim, fontSize: 12, marginTop: 8 },
});
