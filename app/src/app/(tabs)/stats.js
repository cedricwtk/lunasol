import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

export default function Stats() {
  const [logs, setLogs] = useState([]);
  const [fasts, setFasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [logData, fastData] = await Promise.all([
          api('/api/daily-logs'),
          api('/api/fasts'),
        ]);
        setLogs(logData.logs || []);
        setFasts(fastData.fasts || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  // Calorie stats
  const daysLogged = logs.length;
  const totalCalories = logs.reduce((s, l) => s + parseInt(l.total_calories || 0), 0);
  const avgCalories = daysLogged > 0 ? Math.round(totalCalories / daysLogged) : 0;
  const successDays = logs.filter(l => l.success === true).length;
  const failDays = logs.filter(l => l.success === false).length;
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

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.dimText}>Loading stats...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
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
              const day = new Date(l.log_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });
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
});
