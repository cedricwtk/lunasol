import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

const CAT_COLORS = ['#e8855b', '#5cb886', '#4f8aff', '#d4784e', '#a78bfa', '#f59e0b', '#ec4899', '#06b6d4'];

export default function Stats() {
  const [logs, setLogs] = useState([]);
  const [fasts, setFasts] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState({ breakdown: [], totals: [] });
  const [expenseMonth, setExpenseMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function currentMonth() { return new Date().toISOString().slice(0, 7); }

  const fetchData = useCallback(async (m) => {
    try {
      const [logData, fastData, expData] = await Promise.all([
        api('/api/daily-logs'),
        api('/api/fasts'),
        api(`/api/expenses/summary?month=${m || expenseMonth}`),
      ]);
      setLogs(logData.logs || []);
      setFasts(fastData.fasts || []);
      setExpenseSummary(expData);
    } catch {}
  }, [expenseMonth]);

  useFocusEffect(useCallback(() => {
    fetchData().then(() => setLoading(false));
  }, [fetchData]));

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  function shiftExpenseMonth(dir) {
    const [y, m] = expenseMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setExpenseMonth(newMonth);
    fetchData(newMonth);
  }

  function fmtMonth(m) {
    const [y, mo] = m.split('-');
    return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  // Calorie stats
  const daysLogged = logs.length;
  const totalCalories = logs.reduce((s, l) => s + parseInt(l.total_calories || 0), 0);
  const avgCalories = daysLogged > 0 ? Math.round(totalCalories / daysLogged) : 0;
  const successDays = logs.filter(l => l.success === true).length;
  const successRate = daysLogged > 0 ? Math.round((successDays / daysLogged) * 100) : 0;

  // Streak
  let currentStreak = 0;
  const sorted = [...logs].sort((a, b) => b.log_date.localeCompare(a.log_date));
  for (const l of sorted) {
    if (l.success === true) currentStreak++;
    else break;
  }

  // Fasting stats
  const completedFasts = fasts.filter(f => f.ended_at);
  const totalFasts = completedFasts.length;
  const successfulFasts = completedFasts.filter(f => {
    const actual = (new Date(f.ended_at) - new Date(f.started_at)) / 3600000;
    return actual >= parseFloat(f.target_hours);
  }).length;
  const fastSuccessRate = totalFasts > 0 ? Math.round((successfulFasts / totalFasts) * 100) : 0;
  const totalFastingHours = Math.round(completedFasts.reduce((s, f) => {
    return s + (new Date(f.ended_at) - new Date(f.started_at)) / 3600000;
  }, 0));
  const avgFastHours = totalFasts > 0 ? (totalFastingHours / totalFasts).toFixed(1) : 0;

  // Last 7 days mini chart
  const last7 = logs.slice(0, 7).reverse();

  // Expense stats
  const necTotal = parseFloat(expenseSummary.totals?.find(t => t.category_type === 'necessary')?.total || 0);
  const unnecTotal = parseFloat(expenseSummary.totals?.find(t => t.category_type === 'unnecessary')?.total || 0);
  const expGrandTotal = necTotal + unnecTotal;
  const breakdown = expenseSummary.breakdown || [];

  // Build bar data for expense categories
  const maxSubTotal = Math.max(...breakdown.map(b => parseFloat(b.total)), 1);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.dimText}>Loading stats...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}>
      <Text style={styles.heading}>Your Stats</Text>

      {/* Streak */}
      <View style={styles.streakCard}>
        <View style={styles.streakIcon}>
          <Ionicons name="flame" size={28} color={colors.accent} />
        </View>
        <View>
          <Text style={styles.streakValue}>{currentStreak} day streak</Text>
          <Text style={styles.streakSub}>Keep it going!</Text>
        </View>
      </View>

      {/* Calorie overview */}
      <Text style={styles.sectionLabel}>CALORIE TRACKING</Text>
      <View style={styles.statGrid}>
        <StatCard icon="nutrition-outline" label="Days Logged" value={daysLogged} />
        <StatCard icon="flame-outline" label="Avg Calories" value={`${avgCalories.toLocaleString()}`} unit="kcal" />
        <StatCard icon="checkmark-circle-outline" label="Success Rate" value={`${successRate}%`} accent={successRate >= 70} />
        <StatCard icon="trophy-outline" label="Successful Days" value={successDays} />
      </View>

      {/* Last 7 days bar */}
      {last7.length > 0 && (
        <View style={styles.miniChart}>
          <Text style={styles.miniChartTitle}>Last {last7.length} Days</Text>
          <View style={styles.barRow}>
            {last7.map((l, i) => {
              const cal = parseInt(l.total_calories || 0);
              const maxCal = Math.max(...last7.map(x => parseInt(x.total_calories || 0)), 1);
              const pct = Math.max((cal / maxCal) * 100, 4);
              const day = new Date(l.log_date.split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });
              return (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, {
                      height: `${pct}%`,
                      backgroundColor: l.success === true ? colors.success : l.success === false ? colors.danger : colors.accent,
                    }]} />
                  </View>
                  <Text style={styles.barLabel}>{day}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Fasting overview */}
      <Text style={styles.sectionLabel}>FASTING</Text>
      <View style={styles.statGrid}>
        <StatCard icon="timer-outline" label="Total Fasts" value={totalFasts} />
        <StatCard icon="time-outline" label="Total Hours" value={totalFastingHours} unit="hrs" />
        <StatCard icon="speedometer-outline" label="Avg Duration" value={avgFastHours} unit="hrs" />
        <StatCard icon="ribbon-outline" label="Success Rate" value={`${fastSuccessRate}%`} accent={fastSuccessRate >= 70} />
      </View>

      {/* Expenses */}
      <Text style={styles.sectionLabel}>EXPENSES</Text>

      {/* Month nav for expenses */}
      <View style={styles.expMonthNav}>
        <TouchableOpacity onPress={() => shiftExpenseMonth(-1)}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.expMonthText}>{fmtMonth(expenseMonth)}</Text>
        <TouchableOpacity onPress={() => shiftExpenseMonth(1)} disabled={expenseMonth >= currentMonth()}>
          <Ionicons name="chevron-forward" size={18} color={expenseMonth >= currentMonth() ? colors.border : colors.text} />
        </TouchableOpacity>
      </View>

      {/* Expense totals */}
      <View style={styles.expTotalsCard}>
        <View style={styles.expTotalRow}>
          <Text style={styles.expTotalLabel}>Total Spent</Text>
          <Text style={styles.expTotalValue}>${expGrandTotal.toFixed(2)}</Text>
        </View>
        {/* Necessary vs Unnecessary bar */}
        {expGrandTotal > 0 && (
          <View style={styles.splitBar}>
            <View style={[styles.splitSeg, { flex: necTotal || 0.01, backgroundColor: colors.success, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
            <View style={[styles.splitSeg, { flex: unnecTotal || 0.01, backgroundColor: colors.danger, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
          </View>
        )}
        <View style={styles.expTotalSplit}>
          <View style={styles.expSplitItem}>
            <View style={[styles.expDot, { backgroundColor: colors.success }]} />
            <Text style={styles.expSplitLabel}>Necessary</Text>
            <Text style={styles.expSplitValue}>${necTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.expSplitItem}>
            <View style={[styles.expDot, { backgroundColor: colors.danger }]} />
            <Text style={styles.expSplitLabel}>Unnecessary</Text>
            <Text style={styles.expSplitValue}>${unnecTotal.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Category breakdown horizontal bars */}
      {breakdown.length > 0 && (
        <View style={styles.breakdownCard}>
          <Text style={styles.miniChartTitle}>By Category</Text>
          {breakdown.map((b, i) => {
            const pct = Math.max((parseFloat(b.total) / maxSubTotal) * 100, 4);
            const barColor = b.category_type === 'necessary' ? colors.success : CAT_COLORS[i % CAT_COLORS.length];
            return (
              <View key={i} style={styles.hBarRow}>
                <View style={styles.hBarLabelWrap}>
                  <Text style={styles.hBarLabel} numberOfLines={1}>{b.subcategory}</Text>
                  <Text style={styles.hBarType}>{b.category_type === 'necessary' ? 'NEC' : 'UNN'}</Text>
                </View>
                <View style={styles.hBarTrack}>
                  <View style={[styles.hBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                </View>
                <Text style={styles.hBarValue}>${parseFloat(b.total).toFixed(0)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {expGrandTotal === 0 && (
        <Text style={styles.emptyExp}>No expenses logged for {fmtMonth(expenseMonth)}.</Text>
      )}
    </ScrollView>
  );
}

function StatCard({ icon, label, value, unit, accent }) {
  return (
    <View style={sStyles.card}>
      <Ionicons name={icon} size={20} color={accent ? colors.success : colors.accent} />
      <Text style={sStyles.value}>{value}{unit ? <Text style={sStyles.unit}> {unit}</Text> : null}</Text>
      <Text style={sStyles.label}>{label}</Text>
    </View>
  );
}

const sStyles = StyleSheet.create({
  card: {
    width: '47%', backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  value: { fontSize: 22, fontWeight: '800', color: colors.text },
  unit: { fontSize: 13, fontWeight: '500', color: colors.textDim },
  label: { fontSize: 11, color: colors.textDim, fontWeight: '500' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 20 },
  dimText: { color: colors.textDim, fontSize: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: colors.textDim, letterSpacing: 1, marginBottom: 12, marginTop: 24 },

  streakCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.card, borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  streakIcon: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentGlow,
    justifyContent: 'center', alignItems: 'center',
  },
  streakValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  streakSub: { fontSize: 12, color: colors.textDim, marginTop: 2 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  miniChart: {
    backgroundColor: colors.card, borderRadius: 14, padding: 16, marginTop: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  miniChartTitle: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 12 },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 80, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { width: '100%', height: 60, backgroundColor: colors.input, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 10, color: colors.textDim, fontWeight: '600' },

  // Expense styles
  expMonthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12,
  },
  expMonthText: { fontSize: 14, fontWeight: '600', color: colors.text, minWidth: 100, textAlign: 'center' },

  expTotalsCard: {
    backgroundColor: colors.card, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  expTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  expTotalLabel: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  expTotalValue: { fontSize: 24, fontWeight: '800', color: colors.text },

  splitBar: { flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  splitSeg: { height: '100%' },

  expTotalSplit: { flexDirection: 'row', justifyContent: 'space-between' },
  expSplitItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  expDot: { width: 8, height: 8, borderRadius: 4 },
  expSplitLabel: { fontSize: 12, color: colors.textDim, fontWeight: '500' },
  expSplitValue: { fontSize: 13, fontWeight: '700', color: colors.text },

  breakdownCard: {
    backgroundColor: colors.card, borderRadius: 14, padding: 16, marginTop: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  hBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  hBarLabelWrap: { width: 90 },
  hBarLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
  hBarType: { fontSize: 9, fontWeight: '600', color: colors.textDim, letterSpacing: 0.5 },
  hBarTrack: { flex: 1, height: 16, backgroundColor: colors.input, borderRadius: 4, overflow: 'hidden' },
  hBarFill: { height: '100%', borderRadius: 4 },
  hBarValue: { fontSize: 12, fontWeight: '700', color: colors.text, width: 50, textAlign: 'right' },

  emptyExp: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 12 },
});
