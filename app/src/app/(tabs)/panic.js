import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  Vibration, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

// ── Constants ───────────────────────────────────────────────────────────────
const MEAL_PRESETS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '3+ hours', minutes: 180 },
];

const INTERVENTIONS = [
  { instruction: 'Stand up and walk outside for 10 minutes.', timerMin: 10, icon: 'walk-outline' },
  { instruction: 'Make a black coffee, tea, or sparkling water. Drink the whole thing.', timerMin: 5, icon: 'cafe-outline' },
  { instruction: 'Do 20 pushups right now.', timerMin: 2, icon: 'fitness-outline' },
  { instruction: 'Open a task that needs your focus. Code, clean, anything demanding.', timerMin: 10, icon: 'flash-outline' },
];

const LOCATIONS = ['home', 'work', 'out', 'other'];
const FEELINGS = ['bored', 'stressed', 'tired', 'anxious', 'social_pressure', 'habit'];
const FEELING_LABELS = { bored: 'Bored', stressed: 'Stressed', tired: 'Tired', anxious: 'Anxious', social_pressure: 'Social Pressure', habit: 'Habit' };

// ── Steps ───────────────────────────────────────────────────────────────────
// idle → entry → intervention → letter → victory / broke → postlog → done
const STEP = { IDLE: 0, ENTRY: 1, INTERVENTION: 2, LETTER: 3, VICTORY: 4, BROKE: 5, POSTLOG: 6, DONE: 7 };

export default function PanicButton() {
  // Flow state
  const [step, setStep] = useState(STEP.IDLE);
  const [mealMinutes, setMealMinutes] = useState(0);
  const [mealCountdown, setMealCountdown] = useState(0);
  const [interventionIdx, setInterventionIdx] = useState(0);
  const [interventionTimer, setInterventionTimer] = useState(0);
  const [customMinutes, setCustomMinutes] = useState('');

  // Data state
  const [stats, setStats] = useState(null);
  const [letter, setLetter] = useState(null);
  const [letterDraft, setLetterDraft] = useState('');
  const [editingLetter, setEditingLetter] = useState(false);

  // Outcome tracking
  const [outcomeResult, setOutcomeResult] = useState(null); // 'survived' or 'broke'

  // Post-log
  const [logLocation, setLogLocation] = useState(null);
  const [logFeeling, setLogFeeling] = useState(null);
  const [logNotes, setLogNotes] = useState('');

  // Timing
  const startTimeRef = useRef(null);
  const mealTimerRef = useRef(null);
  const interventionTimerRef = useRef(null);

  useFocusEffect(useCallback(() => { loadStats(); }, []));

  async function loadStats() {
    try {
      const data = await api('/api/panic/stats');
      setStats(data);
      setLetter(data.letter);
    } catch {}
  }

  // ── Meal countdown timer ──────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(mealTimerRef.current);
    if (step >= STEP.ENTRY && step <= STEP.LETTER && mealMinutes > 0) {
      const endTime = startTimeRef.current + mealMinutes * 60 * 1000;
      const tick = () => {
        const left = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        setMealCountdown(left);
      };
      tick();
      mealTimerRef.current = setInterval(tick, 1000);
    }
    return () => clearInterval(mealTimerRef.current);
  }, [step, mealMinutes]);

  // ── Intervention step timer ───────────────────────────────────────────────
  useEffect(() => {
    clearInterval(interventionTimerRef.current);
    if (step === STEP.INTERVENTION) {
      const dur = INTERVENTIONS[interventionIdx].timerMin * 60;
      setInterventionTimer(dur);
      interventionTimerRef.current = setInterval(() => {
        setInterventionTimer(prev => {
          if (prev <= 1) { clearInterval(interventionTimerRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interventionTimerRef.current);
  }, [step, interventionIdx]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmtTimer(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function fmtLongTimer(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function getDuration() {
    if (!startTimeRef.current) return 0;
    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function startPanic() {
    startTimeRef.current = Date.now();
    setStep(STEP.ENTRY);
    setInterventionIdx(0);
    setLogLocation(null);
    setLogFeeling(null);
    setLogNotes('');
  }

  function selectMealTime(minutes) {
    setMealMinutes(minutes);
    setStep(STEP.INTERVENTION);
  }

  function handleFeelBetter() {
    setOutcomeResult('survived');
    setStep(STEP.VICTORY);
    Vibration.vibrate([0, 200, 100, 200, 100, 400]);
    Notifications.scheduleNotificationAsync({
      content: { title: 'Craving Defeated!', body: 'You powered through it. That takes real strength.', sound: 'default' },
      trigger: null,
    });
  }

  function handleStillStruggling() {
    if (interventionIdx < INTERVENTIONS.length - 1) {
      setInterventionIdx(interventionIdx + 1);
    } else {
      setStep(STEP.LETTER);
    }
  }

  function handleMadeItThrough() {
    setOutcomeResult('survived');
    setStep(STEP.VICTORY);
    Vibration.vibrate([0, 200, 100, 200, 100, 400]);
    Notifications.scheduleNotificationAsync({
      content: { title: 'Craving Defeated!', body: 'You powered through it. That takes real strength.', sound: 'default' },
      trigger: null,
    });
  }

  function handleBrokePlan() {
    setOutcomeResult('broke');
    setStep(STEP.BROKE);
  }

  function goToPostLog() {
    // Auto-fill time of day
    setStep(STEP.POSTLOG);
  }

  async function submitLog(outcome) {
    const dur = getDuration();
    try {
      await api('/api/panic/event', {
        method: 'POST',
        body: JSON.stringify({
          time_until_next_meal: mealMinutes,
          interventions_used: outcome === 'survived' ? interventionIdx + 1 : interventionIdx + 1,
          outcome,
          location: logLocation,
          feeling: logFeeling,
          notes: logNotes.trim() || null,
          duration_seconds: dur,
        }),
      });
    } catch {}
    await loadStats();
    setStep(STEP.DONE);
  }

  async function saveLetter() {
    if (!letterDraft.trim()) return;
    try {
      const data = await api('/api/panic/letter', {
        method: 'PUT',
        body: JSON.stringify({ content: letterDraft.trim() }),
      });
      setLetter(data.letter);
      setEditingLetter(false);
    } catch {}
  }

  function resetFlow() {
    setStep(STEP.IDLE);
    startTimeRef.current = null;
    clearInterval(mealTimerRef.current);
    clearInterval(interventionTimerRef.current);
  }

  const survived = stats?.goal?.total_cravings_survived || 0;
  const broken = stats?.goal?.total_cravings_broken || 0;
  const goalDate = stats?.goal?.event_date;
  const daysUntilGoal = goalDate ? Math.max(0, Math.ceil((new Date(goalDate) - Date.now()) / 86400000)) : null;

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        {/* ── IDLE ────────────────────────────────────────────────────────── */}
        {step === STEP.IDLE && (
          <View style={styles.idleContainer}>
            <Text style={styles.heading}>Panic Button</Text>
            <Text style={styles.idleDesc}>
              Feeling an urge to eat off-plan? Hit the button below. We'll get through this together.
            </Text>

            {/* Stats summary */}
            {stats && (
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{survived}</Text>
                  <Text style={styles.statLabel}>Survived</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{survived + broken > 0 ? Math.round((survived / (survived + broken)) * 100) : 0}%</Text>
                  <Text style={styles.statLabel}>Win Rate</Text>
                </View>
                {daysUntilGoal !== null && (
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{daysUntilGoal}</Text>
                    <Text style={styles.statLabel}>Days to Goal</Text>
                  </View>
                )}
              </View>
            )}

            {/* Big button */}
            <TouchableOpacity style={styles.panicBtn} onPress={startPanic} activeOpacity={0.8}>
              <Ionicons name="alert-circle" size={40} color="#fff" />
              <Text style={styles.panicBtnText}>I'm Having a Craving</Text>
            </TouchableOpacity>

            {/* Letter section */}
            <View style={styles.letterSection}>
              <Text style={styles.sectionLabel}>YOUR LETTER TO YOURSELF</Text>
              {letter ? (
                <View style={styles.letterCard}>
                  <Text style={styles.letterContent}>{letter.content}</Text>
                  <TouchableOpacity onPress={() => { setLetterDraft(letter.content); setEditingLetter(true); }}>
                    <Text style={styles.editLink}>Edit letter</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.writeCta} onPress={() => { setLetterDraft(''); setEditingLetter(true); }}>
                  <Ionicons name="create-outline" size={20} color={colors.accent} />
                  <Text style={styles.writeCtaText}>Write a letter to your future self for when cravings hit</Text>
                </TouchableOpacity>
              )}
              {editingLetter && (
                <View style={styles.letterEditor}>
                  <TextInput
                    style={styles.letterInput}
                    value={letterDraft}
                    onChangeText={setLetterDraft}
                    placeholder="Write to your future self... Why are you doing this? What matters more than this craving?"
                    placeholderTextColor={colors.muted}
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={styles.letterBtns}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingLetter(false)}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={saveLetter}>
                      <Text style={styles.saveBtnText}>Save Letter</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Recent history */}
            {stats?.recent?.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={styles.sectionLabel}>RECENT EVENTS</Text>
                {stats.recent.slice(0, 5).map(e => (
                  <View key={e.id} style={styles.historyItem}>
                    <Ionicons
                      name={e.outcome === 'survived' ? 'shield-checkmark' : 'heart-dislike'}
                      size={18}
                      color={e.outcome === 'survived' ? colors.success : colors.danger}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyOutcome}>
                        {e.outcome === 'survived' ? 'Survived' : 'Broke'} — {e.feeling ? FEELING_LABELS[e.feeling] : 'Unknown trigger'}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {new Date(e.triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {e.duration_seconds ? ` — ${Math.round(e.duration_seconds / 60)}min` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── STEP 1: ENTRY ───────────────────────────────────────────────── */}
        {step === STEP.ENTRY && (
          <View style={styles.stepContainer}>
            <Ionicons name="time-outline" size={48} color={colors.accent} style={{ alignSelf: 'center', marginBottom: 16 }} />
            <Text style={styles.stepTitle}>How long until your next meal?</Text>
            <Text style={styles.stepDesc}>Pick the closest option. This sets your countdown.</Text>

            <View style={styles.presetGrid}>
              {MEAL_PRESETS.map(p => (
                <TouchableOpacity key={p.minutes} style={styles.presetBtn} onPress={() => selectMealTime(p.minutes)}>
                  <Text style={styles.presetBtnText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={customMinutes}
                onChangeText={setCustomMinutes}
                placeholder="Custom minutes"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[styles.customGo, !customMinutes && { opacity: 0.4 }]}
                onPress={() => { const m = parseInt(customMinutes); if (m > 0) selectMealTime(m); }}
                disabled={!customMinutes}
              >
                <Text style={styles.customGoText}>Go</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.backBtn} onPress={resetFlow}>
              <Text style={styles.backBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: INTERVENTION ────────────────────────────────────────── */}
        {step === STEP.INTERVENTION && (
          <View style={styles.stepContainer}>
            {/* Meal countdown banner */}
            {mealCountdown > 0 && (
              <View style={styles.mealBanner}>
                <Text style={styles.mealBannerText}>
                  You eat in <Text style={{ fontWeight: '800' }}>{fmtLongTimer(mealCountdown)}</Text>. Just get through this window.
                </Text>
              </View>
            )}

            <Text style={styles.interventionStep}>
              Step {interventionIdx + 1} of {INTERVENTIONS.length}
            </Text>

            <View style={styles.interventionCard}>
              <Ionicons name={INTERVENTIONS[interventionIdx].icon} size={44} color={colors.accent} style={{ marginBottom: 16 }} />
              <Text style={styles.interventionText}>{INTERVENTIONS[interventionIdx].instruction}</Text>

              {/* Timer ring */}
              <View style={styles.timerCircle}>
                <Text style={styles.timerText}>{fmtTimer(interventionTimer)}</Text>
                <Text style={styles.timerLabel}>
                  {interventionTimer > 0 ? 'remaining' : "time's up"}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.feelBetterBtn} onPress={handleFeelBetter}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.feelBetterBtnText}>Done — I feel better</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.stillStrugglingBtn} onPress={handleStillStruggling}>
              <Text style={styles.stillStrugglingBtnText}>
                {interventionIdx < INTERVENTIONS.length - 1 ? "Can't do this / Still struggling" : "I've tried everything"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 3: LETTER FROM PAST YOU ─────────────────────────────────── */}
        {step === STEP.LETTER && (
          <View style={styles.stepContainer}>
            {mealCountdown > 0 && (
              <View style={styles.mealBanner}>
                <Text style={styles.mealBannerText}>
                  You eat in <Text style={{ fontWeight: '800' }}>{fmtLongTimer(mealCountdown)}</Text>.
                </Text>
              </View>
            )}

            <Ionicons name="mail-open-outline" size={44} color={colors.accent} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={styles.stepTitle}>A letter from past-you</Text>

            {letter ? (
              <View style={styles.letterDisplay}>
                <Text style={styles.letterDisplayText}>"{letter.content}"</Text>
              </View>
            ) : (
              <View style={styles.noLetterCard}>
                <Text style={styles.noLetterText}>You haven't written a letter to yourself yet.</Text>
                <Text style={styles.noLetterSub}>Write one now for the next time you're here.</Text>
                <TextInput
                  style={styles.letterInput}
                  value={letterDraft}
                  onChangeText={setLetterDraft}
                  placeholder="Dear future me..."
                  placeholderTextColor={colors.muted}
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity style={styles.saveBtn} onPress={saveLetter}>
                  <Text style={styles.saveBtnText}>Save for Next Time</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Stats */}
            <View style={styles.letterStats}>
              <View style={styles.letterStatItem}>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                <Text style={styles.letterStatText}>{survived} cravings survived</Text>
              </View>
              {daysUntilGoal !== null && (
                <View style={styles.letterStatItem}>
                  <Ionicons name="flag" size={18} color={colors.accent} />
                  <Text style={styles.letterStatText}>{daysUntilGoal} days to goal</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.feelBetterBtn} onPress={handleMadeItThrough}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.feelBetterBtnText}>I made it through</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.brokeBtn} onPress={handleBrokePlan}>
              <Text style={styles.brokeBtnText}>I broke the plan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 4: VICTORY ─────────────────────────────────────────────── */}
        {step === STEP.VICTORY && (
          <View style={styles.stepContainer}>
            <View style={styles.victoryCard}>
              <Ionicons name="trophy" size={56} color={colors.accent} />
              <Text style={styles.victoryTitle}>Craving Defeated!</Text>
              <Text style={styles.victoryMessage}>
                That's <Text style={{ fontWeight: '800', color: colors.accent }}>{survived + 1}</Text> cravings beaten.
              </Text>
              <Text style={styles.victoryMessage}>
                The urge lasted <Text style={{ fontWeight: '800' }}>{Math.round(getDuration() / 60)}</Text> minutes.
              </Text>
              <Text style={styles.victorySub}>You're stronger than it.</Text>
            </View>

            <TouchableOpacity style={styles.feelBetterBtn} onPress={goToPostLog}>
              <Text style={styles.feelBetterBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 5: BROKE ───────────────────────────────────────────────── */}
        {step === STEP.BROKE && (
          <View style={styles.stepContainer}>
            <View style={styles.brokeCard}>
              <Ionicons name="heart-half-outline" size={48} color={colors.accent} />
              <Text style={styles.brokeTitle}>It happens.</Text>
              <Text style={styles.brokeMessage}>
                Your streak is paused, not erased. Log your next planned meal to resume.
              </Text>
              {stats?.avg_recovery_seconds && (
                <View style={styles.resilienceRow}>
                  <Ionicons name="trending-up" size={18} color={colors.success} />
                  <Text style={styles.resilienceText}>
                    You typically recover in {Math.round(stats.avg_recovery_seconds / 60)} min. You bounce back fast.
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.feelBetterBtn} onPress={goToPostLog}>
              <Text style={styles.feelBetterBtnText}>Log & Move On</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 6: POST-LOG ────────────────────────────────────────────── */}
        {step === STEP.POSTLOG && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Quick Log</Text>
            <Text style={styles.stepDesc}>This helps spot patterns over time.</Text>

            <Text style={styles.tagLabel}>Location</Text>
            <View style={styles.tagRow}>
              {LOCATIONS.map(loc => (
                <TouchableOpacity
                  key={loc}
                  style={[styles.tagChip, logLocation === loc && styles.tagChipActive]}
                  onPress={() => setLogLocation(loc)}
                >
                  <Text style={[styles.tagChipText, logLocation === loc && styles.tagChipTextActive]}>
                    {loc.charAt(0).toUpperCase() + loc.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.tagLabel}>What triggered it?</Text>
            <View style={styles.tagRow}>
              {FEELINGS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.tagChip, logFeeling === f && styles.tagChipActive]}
                  onPress={() => setLogFeeling(f)}
                >
                  <Text style={[styles.tagChipText, logFeeling === f && styles.tagChipTextActive]}>
                    {FEELING_LABELS[f]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.tagLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={logNotes}
              onChangeText={setLogNotes}
              placeholder="What happened?"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={styles.feelBetterBtn}
              onPress={() => submitLog(outcomeResult || 'survived')}
            >
              <Text style={styles.feelBetterBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 7: DONE ────────────────────────────────────────────────── */}
        {step === STEP.DONE && (
          <View style={styles.stepContainer}>
            <View style={styles.doneCard}>
              <Ionicons name="checkmark-done-circle" size={48} color={colors.success} />
              <Text style={styles.doneTitle}>Logged.</Text>
              <Text style={styles.doneSub}>Take care of yourself. You're doing great.</Text>
            </View>

            <TouchableOpacity style={styles.feelBetterBtn} onPress={resetFlow}>
              <Text style={styles.feelBetterBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },

  // Idle
  idleContainer: {},
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 },
  idleDesc: { fontSize: 14, color: colors.textDim, lineHeight: 20, marginBottom: 24 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statBox: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statNumber: { fontSize: 24, fontWeight: '800', color: colors.accent },
  statLabel: { fontSize: 11, color: colors.textDim, marginTop: 4, fontWeight: '500' },

  panicBtn: {
    backgroundColor: '#d94040', borderRadius: 20, padding: 24, alignItems: 'center', gap: 10,
    shadowColor: '#d94040', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  panicBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  // Letter section
  letterSection: { marginTop: 28 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: colors.textDim, letterSpacing: 1, marginBottom: 10 },
  letterCard: {
    backgroundColor: colors.card, borderRadius: 14, padding: 18, borderLeftWidth: 3, borderLeftColor: colors.accent,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  letterContent: { fontSize: 14, color: colors.text, lineHeight: 22, fontStyle: 'italic' },
  editLink: { color: colors.accent, fontSize: 12, marginTop: 10, fontWeight: '600' },
  writeCta: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  writeCtaText: { flex: 1, fontSize: 13, color: colors.textDim, lineHeight: 19 },
  letterEditor: { marginTop: 12 },
  letterInput: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 14, color: colors.text, fontSize: 14, minHeight: 120, lineHeight: 22,
  },
  letterBtns: { flexDirection: 'row', gap: 10, marginTop: 10, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelBtnText: { color: colors.textDim, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  saveBtnText: { color: '#fff', fontWeight: '700' },

  // History
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  historyOutcome: { fontSize: 13, fontWeight: '600', color: colors.text },
  historyMeta: { fontSize: 11, color: colors.textDim, marginTop: 2 },

  // Step containers
  stepContainer: { paddingTop: 20 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 },
  stepDesc: { fontSize: 14, color: colors.textDim, textAlign: 'center', marginBottom: 24 },

  // Entry presets
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  presetBtn: {
    width: '47%', backgroundColor: colors.card, borderRadius: 14, padding: 18, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.accent,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  presetBtnText: { fontSize: 16, fontWeight: '700', color: colors.accent },
  customRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  customInput: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 14, color: colors.text, fontSize: 14,
  },
  customGo: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  customGoText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  backBtn: { alignSelf: 'center', marginTop: 8 },
  backBtnText: { color: colors.textDim, fontSize: 14 },

  // Meal banner
  mealBanner: {
    backgroundColor: 'rgba(232,133,91,0.1)', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(232,133,91,0.2)',
  },
  mealBannerText: { color: colors.accent, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Intervention
  interventionStep: { fontSize: 12, color: colors.textDim, textAlign: 'center', letterSpacing: 1, fontWeight: '600', marginBottom: 16 },
  interventionCard: {
    backgroundColor: colors.card, borderRadius: 20, padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
    marginBottom: 24,
  },
  interventionText: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center', lineHeight: 26, marginBottom: 24 },
  timerCircle: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: colors.input,
    borderWidth: 3, borderColor: colors.accent, justifyContent: 'center', alignItems: 'center',
  },
  timerText: { fontSize: 28, fontWeight: '800', color: colors.accent, fontVariant: ['tabular-nums'] },
  timerLabel: { fontSize: 11, color: colors.textDim, marginTop: 2 },

  feelBetterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.success, borderRadius: 14, padding: 16,
    shadowColor: colors.success, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
  },
  feelBetterBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  stillStrugglingBtn: {
    alignItems: 'center', padding: 14, marginTop: 10,
    backgroundColor: 'rgba(226,92,92,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(226,92,92,0.2)',
  },
  stillStrugglingBtnText: { color: colors.danger, fontWeight: '600', fontSize: 14 },

  // Letter display (step 3)
  letterDisplay: {
    backgroundColor: colors.card, borderRadius: 16, padding: 24, borderLeftWidth: 4, borderLeftColor: colors.accent, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  letterDisplayText: { fontSize: 16, color: colors.text, lineHeight: 26, fontStyle: 'italic' },
  noLetterCard: { backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 20 },
  noLetterText: { fontSize: 14, color: colors.text, fontWeight: '600', marginBottom: 4 },
  noLetterSub: { fontSize: 13, color: colors.textDim, marginBottom: 14 },
  letterStats: { flexDirection: 'column', gap: 8, marginBottom: 24 },
  letterStatItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  letterStatText: { fontSize: 14, color: colors.text, fontWeight: '500' },

  brokeBtn: { alignItems: 'center', padding: 14, marginTop: 10 },
  brokeBtnText: { color: colors.textDim, fontSize: 14 },

  // Victory
  victoryCard: {
    backgroundColor: colors.card, borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  victoryTitle: { fontSize: 26, fontWeight: '800', color: colors.accent, marginTop: 16, marginBottom: 12 },
  victoryMessage: { fontSize: 16, color: colors.text, textAlign: 'center', lineHeight: 24, marginBottom: 4 },
  victorySub: { fontSize: 14, color: colors.textDim, marginTop: 12, fontWeight: '500' },

  // Broke
  brokeCard: {
    backgroundColor: colors.card, borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  brokeTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 10 },
  brokeMessage: { fontSize: 15, color: colors.textDim, textAlign: 'center', lineHeight: 24 },
  resilienceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20,
    backgroundColor: 'rgba(92,184,134,0.08)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  resilienceText: { fontSize: 13, color: colors.success, fontWeight: '500', flex: 1 },

  // Post-log
  tagLabel: { fontSize: 12, fontWeight: '600', color: colors.textDim, letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  tagChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(232,133,91,0.1)' },
  tagChipText: { fontSize: 13, fontWeight: '500', color: colors.textDim },
  tagChipTextActive: { color: colors.accent, fontWeight: '600' },
  notesInput: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 14, color: colors.text, fontSize: 14, minHeight: 80, marginTop: 8, marginBottom: 24,
  },

  // Done
  doneCard: {
    backgroundColor: colors.card, borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  doneTitle: { fontSize: 24, fontWeight: '700', color: colors.success, marginTop: 12, marginBottom: 8 },
  doneSub: { fontSize: 14, color: colors.textDim, textAlign: 'center' },
});
