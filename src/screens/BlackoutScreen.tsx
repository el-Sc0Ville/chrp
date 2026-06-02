// B-10 · Blackout Dates — pick dates the player is unavailable for auto-in

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { navy, teams, fonts, spacing, radius } from '../theme';
import { db } from '../firebase';
import { useUserContext } from '../context/UserContext';
import { useBlackouts } from '../firebase/hooks/useBlackouts';

const WEEKDAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildMonths(from: Date) {
  const result = [];
  for (let i = 0; i < 3; i++) {
    const year  = from.getFullYear() + Math.floor((from.getMonth() + i) / 12);
    const month = (from.getMonth() + i) % 12;
    const firstDow    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let p = 0; p < firstDow; p++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    result.push({ year, month, cells });
  }
  return result;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BlackoutScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, activeTeamId, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];

  const [today] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const todayStr = toYMD(today);

  const { dates: existingDates, loading } = useBlackouts(activeTeamId, user?.uid ?? '');
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [saving,   setSaving]       = useState(false);
  const initializedRef              = useRef(false);

  // Pre-populate selection with existing blackouts once first snapshot arrives
  useEffect(() => {
    if (!loading && !initializedRef.current) {
      initializedRef.current = true;
      setSelected(new Set(existingDates));
    }
  }, [loading, existingDates]);

  const months = useMemo(() => buildMonths(today), [today]);

  const toggleDate = (date: Date) => {
    const ymd = toYMD(date);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ymd)) next.delete(ymd);
      else next.add(ymd);
      return next;
    });
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const ref = doc(db, 'teams', activeTeamId, 'members', user!.uid, 'blackouts', 'current');
      await setDoc(ref, {
        dates:     Array.from(selected).sort(),
        createdAt: serverTimestamp(),
      });
      navigation.goBack();
    } catch (err) {
      console.error('[BlackoutScreen] save failed:', err);
      setSaving(false);
    }
  };

  const selectedCount = selected.size;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.backChevron, { color: TEAM[300] }]}>‹</Text>
          <Text style={[styles.backBtnText, { color: TEAM[300] }]}>Back</Text>
        </Pressable>

        <Text style={styles.headerTitle}>Blackout Dates</Text>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          hitSlop={12}
          style={[styles.saveBtn, { backgroundColor: TEAM[500] }, saving && styles.saveBtnDisabled]}
        >
          <Text style={[styles.saveBtnText, { color: TEAM.on }]}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      {/* ── Calendar ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, spacing[16]) + 80 },
        ]}
      >
        <Text style={styles.hint}>
          Tap dates when you know you can't play. Auto-in won't mark you available on these days.
        </Text>

        {months.map(({ year, month, cells }) => (
          <View key={`${year}-${month}`} style={styles.monthSection}>
            <Text style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>

            {/* Weekday headers */}
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map(w => (
                <Text key={w} style={styles.weekdayLabel}>{w}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.daysGrid}>
              {cells.map((cell, idx) => {
                if (!cell) return <View key={idx} style={styles.dayCell} />;
                const isPast     = cell < today;
                const ymd        = toYMD(cell);
                const isSelected = selected.has(ymd);
                const isToday    = ymd === todayStr;
                return (
                  <Pressable
                    key={idx}
                    disabled={isPast}
                    onPress={() => toggleDate(cell)}
                    style={({ pressed }) => [
                      styles.dayCell,
                      isSelected && { backgroundColor: TEAM[500] },
                      isToday && !isSelected && styles.dayCellToday,
                      pressed && !isPast && { opacity: 0.75 },
                    ]}
                  >
                    <Text style={[
                      styles.dayText,
                      isPast     && styles.dayTextPast,
                      isSelected && { color: TEAM.on, fontFamily: fonts.uiSemiBold },
                      isToday && !isSelected && { color: TEAM[300] },
                    ]}>
                      {cell.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── Bottom summary bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing[16]) }]}>
        <Text style={styles.countText}>
          {selectedCount === 0
            ? 'No dates selected'
            : `${selectedCount} date${selectedCount !== 1 ? 's' : ''} blacked out`}
        </Text>
        {selectedCount > 0 && (
          <Pressable
            onPress={() => setSelected(new Set())}
            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.clearBtnText}>Clear all</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[800],
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingTop: spacing[10],
    paddingBottom: spacing[14],
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 64,
  },
  backChevron: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    marginTop: -2,
  },
  backBtnText: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  saveBtn: {
    minWidth: 64,
    alignItems: 'flex-end',
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[8],
    borderRadius: radius.pill,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  hint: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    color: navy[400],
    marginBottom: spacing[24],
    textAlign: 'center',
    paddingHorizontal: spacing[8],
  },

  // ── Month section ─────────────────────────────────────────────────────────
  monthSection: {
    marginBottom: spacing[32],
  },
  monthLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: spacing[12],
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing[6],
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: navy[400],
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // ── Day cell ──────────────────────────────────────────────────────────────
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.s,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  dayText: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: navy[100],
  },
  dayTextPast: {
    color: navy[600],
  },

  // ── Bottom bar ────────────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: navy[800],
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[14],
  },
  countText: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: navy[300],
  },
  clearBtn: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  clearBtnText: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: navy[300],
  },
});
