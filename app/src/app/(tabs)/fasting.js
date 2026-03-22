import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

const PRESETS = [
  { label: '16 : 8', hours: 16 },
  { label: '18 : 6', hours: 18 },
  { label: '20 : 4', hours: 20 },
  { label: '23 : 1', hours: 23 },
  { label: 'Custom', hours: null },
];

const CUSTOM_OPTIONS = [12, 14, 24, 36, 48, 72];

export default function Fasting() {
  const [activeFast, setActiveFast] = useState(null);
  const [history, setHistory] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [showCustom, setShowCustom] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    loadFasts();
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (activeFast) {
      const tick = () => {
        const ms = Date.now() - new Date(activeFast.started_at).getTime();
        setElapsed(Math.floor(ms / 1000));
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(0);
    }
  }, [activeFast]);

  async function loadFasts() {
    try {
      const data = await api('/api/fasts');
      const fasts = data.fasts || [];
      const active = fasts.find(f => !f.ended_at);
      setActiveFast(active || null);
      setHistory(fasts.filter(f => f.ended_at));
    } catch {}
  }

  async function startFast(hours, presetLabel) {
    try {
      await api('/api/fasts', {
        method: 'POST',
        body: JSON.stringify({ target_hours: hours, preset: presetLabel || `${hours}h` }),
      });
      setShowCustom(false);
      await loadFasts();
    } catch {}
  }

  async function endFast() {
    if (!activeFast) return;
    Alert.alert('End Fast', 'Are you sure you want to end this fast?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Fast', style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/fasts/${activeFast.id}/end`, { method: 'PATCH' });
            await loadFasts();
          } catch {}
        },
      },
    ]);
  }

  async function deleteFast(id) {
    try {
      await api(`/api/fasts/${id}`, { method: 'DELETE' });
      await loadFasts();
    } catch {}
  }

  const targetSec = activeFast ? parseFloat(activeFast.target_hours) * 3600 : 0;
  const progress = targetSec > 0 ? Math.min(elapsed / targetSec, 1) : 0;

  function fmtTimer(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function fmtDuration(startStr, endStr) {
    const ms = new Date(endStr).getTime() - new Date(startStr).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  function fmtDate(str) {
    return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.heading}>Fasting Tracker</Text>

      {activeFast ? (
        <View style={styles.timerCard}>
          <Text style={styles.timerPreset}>{activeFast.preset || `${activeFast.target_hours}h Fast`}</Text>

          {/* Progress ring approximation */}
          <View style={styles.timerRing}>
            <View style={[styles.ringProgress, { height: `${progress * 100}%` }]} />
            <View style={styles.timerInner}>
              <Text style={styles.timerTime}>{fmtTimer(elapsed)}</Text>
              <Text style={styles.timerSub}>
                of {parseFloat(activeFast.target_hours)}h goal
              </Text>
              <Text style={styles.timerPct}>{Math.round(progress * 100)}%</Text>
            </View>
          </View>

          <Text style={styles.timerStarted}>
            Started {fmtDate(activeFast.started_at)}
          </Text>

          {progress >= 1 && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.completedText}>Goal reached!</Text>
            </View>
          )}

          <TouchableOpacity style={styles.endBtn} onPress={endFast}>
            <Text style={styles.endBtnText}>End Fast</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.startSection}>
          <Text style={styles.sub}>Choose a preset or set a custom duration</Text>
          <View style={styles.presetGrid}>
            {PRESETS.map((p, i) => (
              <TouchableOpacity
                key={i}
                style={styles.presetCard}
                onPress={() => {
                  if (p.hours) startFast(p.hours, p.label);
                  else setShowCustom(!showCustom);
                }}
              >
                <Ionicons
                  name={p.hours ? 'timer-outline' : 'options-outline'}
                  size={22}
                  color={colors.accent}
                />
                <Text style={styles.presetLabel}>{p.label}</Text>
                {p.hours && <Text style={styles.presetHours}>{p.hours}h fast / {24 - p.hours}h eat</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {showCustom && (
            <View style={styles.customSection}>
              <Text style={[styles.label, { marginBottom: 10 }]}>SELECT DURATION</Text>
              <View style={styles.customGrid}>
                {CUSTOM_OPTIONS.map(h => (
                  <TouchableOpacity key={h} style={styles.customBtn} onPress={() => startFast(h, `${h}h`)}>
                    <Text style={styles.customBtnText}>{h}h</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* History */}
      {history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={[styles.label, { marginBottom: 12 }]}>RECENT FASTS</Text>
          {history.slice(0, 20).map(f => {
            const dur = fmtDuration(f.started_at, f.ended_at);
            const target = parseFloat(f.target_hours);
            const actualH = (new Date(f.ended_at) - new Date(f.started_at)) / 3600000;
            const hit = actualH >= target;
            return (
              <View key={f.id} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <Ionicons
                    name={hit ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={hit ? colors.success : colors.danger}
                  />
                  <View>
                    <Text style={styles.historyLabel}>{f.preset || `${target}h`}</Text>
                    <Text style={styles.historyMeta}>{fmtDate(f.started_at)} — {dur}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => deleteFast(f.id)}>
                  <Ionicons name="trash-outline" size={16} color={colors.textDim} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  heading: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 16 },
  sub: { fontSize: 13, color: colors.textDim, marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '600', color: colors.textDim, letterSpacing: 1 },

  // Timer
  timerCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 24, alignItems: 'center',
  },
  timerPreset: { fontSize: 14, fontWeight: '600', color: colors.accent, marginBottom: 20, letterSpacing: 1 },
  timerRing: {
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: colors.input, borderWidth: 2, borderColor: colors.border,
    overflow: 'hidden', justifyContent: 'flex-end',
  },
  ringProgress: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.accentGlow,
  },
  timerInner: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  timerTime: { fontSize: 32, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  timerSub: { fontSize: 12, color: colors.textDim, marginTop: 4 },
  timerPct: { fontSize: 18, fontWeight: '700', color: colors.accent, marginTop: 6 },
  timerStarted: { fontSize: 12, color: colors.textDim, marginTop: 16 },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, backgroundColor: 'rgba(52,211,153,0.1)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  completedText: { color: colors.success, fontSize: 13, fontWeight: '600' },
  endBtn: {
    marginTop: 20, backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: 8, paddingHorizontal: 32, paddingVertical: 12,
  },
  endBtnText: { color: colors.danger, fontWeight: '600', fontSize: 14 },

  // Presets
  startSection: {},
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetCard: {
    width: '47%', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 16, gap: 6,
  },
  presetLabel: { fontSize: 18, fontWeight: '700', color: colors.text },
  presetHours: { fontSize: 11, color: colors.textDim },

  // Custom
  customSection: {
    marginTop: 16, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 16,
  },
  customGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  customBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentGlow,
  },
  customBtnText: { color: colors.accent, fontWeight: '700', fontSize: 14 },

  // History
  historySection: { marginTop: 32 },
  historyItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 14, marginBottom: 8,
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  historyMeta: { fontSize: 11, color: colors.textDim, marginTop: 2 },
});
