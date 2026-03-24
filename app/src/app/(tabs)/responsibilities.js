import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

export default function Responsibilities() {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('12:00');
  const [priority, setPriority] = useState('normal');

  const fetchData = useCallback(async () => {
    try {
      const data = await api('/api/responsibilities');
      setItems(data.items || []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  function openAdd() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setTitle('');
    setNote('');
    setDueDate(tomorrow.toISOString().split('T')[0]);
    setDueTime('12:00');
    setPriority('normal');
    setShowAdd(true);
  }

  async function addItem() {
    if (!title.trim()) return;
    if (!dueDate) return;
    const due = new Date(`${dueDate}T${dueTime || '12:00'}:00`);
    if (isNaN(due.getTime())) return;
    try {
      await api('/api/responsibilities', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), note, due_date: due.toISOString(), priority }),
      });
      setShowAdd(false);
      await fetchData();
    } catch {}
  }

  async function toggleComplete(item) {
    try {
      await api(`/api/responsibilities/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !item.completed }),
      });
      await fetchData();
    } catch {}
  }

  async function deleteItem(id) {
    Alert.alert('Delete', 'Remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api(`/api/responsibilities/${id}`, { method: 'DELETE' }); await fetchData(); } catch {}
      }},
    ]);
  }

  const pending = items.filter(i => !i.completed);
  const completed = items.filter(i => i.completed);

  // Group pending by urgency
  const now = new Date();
  const overdue = pending.filter(i => new Date(i.due_date) < now);
  const upcoming = pending.filter(i => {
    const d = new Date(i.due_date);
    return d >= now && d <= new Date(now.getTime() + 7 * 86400000);
  });
  const later = pending.filter(i => new Date(i.due_date) > new Date(now.getTime() + 7 * 86400000));

  function fmtDue(str) {
    const d = new Date(str);
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / 86400000);
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return `Today at ${timeStr}`;
    if (days === 1) return `Tomorrow at ${timeStr}`;
    if (days <= 7) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} at ${timeStr}`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
  }

  function renderItem(item) {
    const isOverdue = new Date(item.due_date) < now && !item.completed;
    return (
      <View key={item.id} style={[styles.itemCard, isOverdue && styles.itemOverdue]}>
        <TouchableOpacity style={styles.checkWrap} onPress={() => toggleComplete(item)}>
          <Ionicons
            name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={item.completed ? colors.success : isOverdue ? colors.danger : colors.muted}
          />
        </TouchableOpacity>
        <View style={styles.itemContent}>
          <View style={styles.itemTitleRow}>
            <Text style={[styles.itemTitle, item.completed && styles.itemTitleDone]} numberOfLines={2}>
              {item.title}
            </Text>
            {item.priority === 'high' && (
              <View style={styles.highBadge}>
                <Text style={styles.highBadgeText}>HIGH</Text>
              </View>
            )}
          </View>
          {item.note ? <Text style={styles.itemNote} numberOfLines={2}>{item.note}</Text> : null}
          <View style={styles.itemMeta}>
            <Ionicons name="time-outline" size={12} color={isOverdue ? colors.danger : colors.textDim} />
            <Text style={[styles.itemDue, isOverdue && { color: colors.danger }]}>
              {fmtDue(item.due_date)}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>
    );
  }

  function renderSection(label, icon, items, color) {
    if (items.length === 0) return null;
    return (
      <View key={label}>
        <View style={styles.sectionHeader}>
          <Ionicons name={icon} size={14} color={color} />
          <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
          <View style={[styles.countBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.countText, { color }]}>{items.length}</Text>
          </View>
        </View>
        {items.map(renderItem)}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}>

        <Text style={styles.heading}>Responsibilities</Text>
        <Text style={styles.sub}>Don't forget what matters</Text>

        {pending.length === 0 && completed.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyText}>Nothing to do!</Text>
            <Text style={styles.emptySub}>Tap + to add a responsibility</Text>
          </View>
        )}

        {renderSection('OVERDUE', 'alert-circle', overdue, colors.danger)}
        {renderSection('THIS WEEK', 'calendar', upcoming, colors.accent)}
        {renderSection('LATER', 'time-outline', later, colors.textDim)}

        {/* Completed toggle */}
        {completed.length > 0 && (
          <View>
            <TouchableOpacity style={styles.completedToggle} onPress={() => setShowCompleted(!showCompleted)}>
              <Text style={styles.completedToggleText}>
                Completed ({completed.length})
              </Text>
              <Ionicons name={showCompleted ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
            </TouchableOpacity>
            {showCompleted && completed.map(renderItem)}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Responsibility</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* Title */}
            <Text style={styles.label}>WHAT NEEDS TO BE DONE?</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle}
              placeholder="e.g. Pick up package from post office" placeholderTextColor={colors.muted} autoFocus />

            {/* Note */}
            <Text style={styles.label}>DETAILS (OPTIONAL)</Text>
            <TextInput style={[styles.input, { minHeight: 70 }]} value={note} onChangeText={setNote}
              placeholder="Any extra info..." placeholderTextColor={colors.muted} multiline />

            {/* Due date + time */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>DUE DATE</Text>
                <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate}
                  placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>TIME</Text>
                <TextInput style={styles.input} value={dueTime} onChangeText={setDueTime}
                  placeholder="HH:MM" placeholderTextColor={colors.muted} />
              </View>
            </View>

            {/* Quick date buttons */}
            <View style={styles.quickDates}>
              {quickDateOptions().map(opt => (
                <TouchableOpacity key={opt.label} style={styles.quickBtn}
                  onPress={() => setDueDate(opt.date)}>
                  <Text style={styles.quickBtnText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Priority */}
            <Text style={styles.label}>PRIORITY</Text>
            <View style={styles.priorityRow}>
              <TouchableOpacity
                style={[styles.priorityBtn, priority === 'normal' && styles.priorityNormalActive]}
                onPress={() => setPriority('normal')}>
                <Ionicons name="notifications-outline" size={18} color={priority === 'normal' ? colors.accent : colors.muted} />
                <Text style={[styles.priorityText, priority === 'normal' && { color: colors.accent }]}>Normal</Text>
                <Text style={styles.priorityHint}>Push 24h before</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.priorityBtn, priority === 'high' && styles.priorityHighActive]}
                onPress={() => setPriority('high')}>
                <Ionicons name="alert-circle" size={18} color={priority === 'high' ? colors.danger : colors.muted} />
                <Text style={[styles.priorityText, priority === 'high' && { color: colors.danger }]}>High</Text>
                <Text style={styles.priorityHint}>Email 1 week + push 24h</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Bottom action buttons */}
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtnBottom} onPress={addItem}>
              <Text style={styles.saveBtnBottomText}>Save Task</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function quickDateOptions() {
  const dates = [];
  const now = new Date();
  const add = (label, days) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    dates.push({ label, date: d.toISOString().split('T')[0] });
  };
  add('Today', 0);
  add('Tomorrow', 1);
  add('In 3 days', 3);
  add('Next week', 7);
  add('In 2 weeks', 14);
  add('Next month', 30);
  return dates;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  sub: { fontSize: 13, color: colors.textDim, marginBottom: 20 },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptySub: { fontSize: 13, color: colors.textDim },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 11, fontWeight: '700' },

  itemCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  itemOverdue: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  checkWrap: { paddingTop: 2 },
  itemContent: { flex: 1 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  itemTitleDone: { textDecorationLine: 'line-through', color: colors.muted },
  highBadge: {
    backgroundColor: 'rgba(226,92,92,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  highBadgeText: { fontSize: 9, fontWeight: '800', color: colors.danger, letterSpacing: 0.5 },
  itemNote: { fontSize: 12, color: colors.textDim, marginTop: 4 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  itemDue: { fontSize: 11, color: colors.textDim, fontWeight: '500' },

  completedToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 24, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  completedToggleText: { color: colors.muted, fontSize: 13, fontWeight: '600' },

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
  row: { flexDirection: 'row', gap: 12 },

  quickDates: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  quickBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  quickBtnText: { fontSize: 12, color: colors.textDim, fontWeight: '500' },

  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityBtn: {
    flex: 1, padding: 14, borderRadius: 14, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  priorityNormalActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  priorityHighActive: { backgroundColor: 'rgba(226,92,92,0.08)', borderColor: colors.danger },
  priorityText: { fontSize: 14, fontWeight: '600', color: colors.textDim },
  priorityHint: { fontSize: 10, color: colors.muted, textAlign: 'center' },

  bottomActions: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  cancelBtnText: { color: colors.textDim, fontWeight: '600', fontSize: 15 },
  saveBtnBottom: {
    flex: 2, padding: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: colors.accent,
  },
  saveBtnBottomText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
