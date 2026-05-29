import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { navy, teams, ice, status, fonts, type as T, spacing, radius } from '../theme';
import AvatarPill from '../components/AvatarPill';

const IS_MANAGER = true;
const TEAM = teams.trashdogs;

// ─── Data model ───────────────────────────────────────────────────────────────

type EventKind = 'game' | 'practice' | 'social';
type PlayerResponse = 'in' | 'out' | 'maybe' | null;

interface ChrpEvent {
  id: string;
  weekday: string;
  day: string;
  month: string;
  kind: EventKind;
  title: string;
  venue: string;
  time: string;
  in: number;
  out: number;
  maybe: number;
  noResp: number;
  playerResponse: PlayerResponse;
}

interface PastEvent {
  id: string;
  weekday: string;
  day: string;
  month: string;
  kind: EventKind;
  title: string;
  venue: string;
  score?: string;
  win?: boolean;
}

const UPCOMING: ChrpEvent[] = [
  {
    id: 'e1',
    weekday: 'SAT', day: '31', month: 'MAY',
    kind: 'game',
    title: 'vs Ember FC',
    venue: 'Arena Nord',
    time: '7:30 PM',
    in: 7, out: 2, maybe: 1, noResp: 3,
    playerResponse: 'in',
  },
  {
    id: 'e2',
    weekday: 'WED', day: '04', month: 'JUN',
    kind: 'practice',
    title: 'Team Practice',
    venue: 'Inner Ice Complex',
    time: '6:00 PM',
    in: 9, out: 1, maybe: 2, noResp: 1,
    playerResponse: null,
  },
  {
    id: 'e3',
    weekday: 'SAT', day: '07', month: 'JUN',
    kind: 'game',
    title: '@ Aurora Sky',
    venue: 'Stadium B',
    time: '8:00 PM',
    in: 5, out: 3, maybe: 2, noResp: 3,
    playerResponse: 'maybe',
  },
  {
    id: 'e4',
    weekday: 'FRI', day: '13', month: 'JUN',
    kind: 'social',
    title: 'End of Season Party',
    venue: 'The Penalty Box',
    time: '7:00 PM',
    in: 11, out: 1, maybe: 1, noResp: 0,
    playerResponse: null,
  },
];

const PAST: PastEvent[] = [
  {
    id: 'p1',
    weekday: 'SAT', day: '17', month: 'MAY',
    kind: 'game',
    title: 'vs Verdant FC',
    venue: 'Arena Nord',
    score: 'W 4–2',
    win: true,
  },
  {
    id: 'p2',
    weekday: 'WED', day: '21', month: 'MAY',
    kind: 'practice',
    title: 'Team Practice',
    venue: 'Inner Ice Complex',
  },
];

// ─── Kind tag styles ──────────────────────────────────────────────────────────

const KIND_COLORS: Record<EventKind, { bg: string; text: string }> = {
  game:     { bg: TEAM[900],            text: TEAM[300] },
  practice: { bg: ice[900],             text: ice[300] },
  social:   { bg: status.alert.subtle,  text: status.alert.pure },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function DateChip({
  weekday, day, month, muted = false,
}: {
  weekday: string; day: string; month: string; muted?: boolean;
}) {
  return (
    <View style={[styles.dateChip, muted && styles.dateChipMuted]}>
      <Text style={[styles.dateWeekday, muted && styles.dateLabelMuted]}>{weekday}</Text>
      <Text style={[styles.dateDay, muted && styles.dateDayMuted]}>{day}</Text>
      <Text style={[styles.dateMonth, muted && styles.dateLabelMuted]}>{month}</Text>
    </View>
  );
}

function KindTag({ kind, muted = false }: { kind: EventKind; muted?: boolean }) {
  const c = KIND_COLORS[kind];
  return (
    <View style={[
      styles.kindTag,
      { backgroundColor: muted ? navy[700] : c.bg },
    ]}>
      <Text style={[
        styles.kindText,
        { color: muted ? navy[400] : c.text },
      ]}>
        {kind.toUpperCase()}
      </Text>
    </View>
  );
}

function ManagerPill({ inCount, outCount }: { inCount: number; outCount: number }) {
  return (
    <View style={styles.managerPill}>
      <Text style={styles.managerPillIn}>{inCount} in</Text>
      <Text style={styles.managerPillDot}> · </Text>
      <Text style={styles.managerPillOut}>{outCount} out</Text>
    </View>
  );
}

function PlayerPill({ response }: { response: PlayerResponse }) {
  if (!response) {
    return (
      <View style={[styles.playerPill, { backgroundColor: TEAM[900], borderColor: TEAM[700] }]}>
        <Text style={[styles.playerPillText, { color: TEAM[300] }]}>Respond?</Text>
      </View>
    );
  }
  const configs = {
    in:    { bg: status.success.subtle, border: 'transparent', text: status.success.pure, label: "You're in" },
    out:   { bg: status.error.subtle,   border: 'transparent', text: status.error.pure,   label: "You're out" },
    maybe: { bg: status.alert.subtle,   border: 'transparent', text: status.alert.pure,   label: 'Maybe' },
  };
  const c = configs[response];
  return (
    <View style={[styles.playerPill, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.playerPillText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

function ScoreBadge({ score, win }: { score: string; win?: boolean }) {
  return (
    <View style={[
      styles.scoreBadge,
      { backgroundColor: win ? status.success.subtle : status.error.subtle },
    ]}>
      <Text style={[
        styles.scoreText,
        { color: win ? status.success.pure : status.error.pure },
      ]}>
        {score}
      </Text>
    </View>
  );
}

function EventRow({ event, onPress }: { event: ChrpEvent; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.eventRow, pressed && { backgroundColor: navy[700] }]}
    >
      <DateChip weekday={event.weekday} day={event.day} month={event.month} />
      <View style={styles.eventInfo}>
        <KindTag kind={event.kind} />
        <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.eventMeta} numberOfLines={1}>
          {event.venue} · {event.time}
        </Text>
      </View>
      {IS_MANAGER
        ? <ManagerPill inCount={event.in} outCount={event.out} />
        : <PlayerPill response={event.playerResponse} />
      }
    </Pressable>
  );
}

function PastEventRow({ event }: { event: PastEvent }) {
  return (
    <View style={[styles.eventRow, { opacity: 0.6 }]}>
      <DateChip weekday={event.weekday} day={event.day} month={event.month} muted />
      <View style={styles.eventInfo}>
        <KindTag kind={event.kind} muted />
        <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.eventMeta} numberOfLines={1}>{event.venue}</Text>
      </View>
      {event.score && <ScoreBadge score={event.score} win={event.win} />}
    </View>
  );
}

function PastSection() {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.pastSection}>
      <Pressable
        onPress={() => setExpanded(v => !v)}
        style={({ pressed }) => [styles.pastHeader, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.pastHeaderTitle}>Past events</Text>
        <Text style={[styles.pastChevron, expanded && styles.pastChevronOpen]}>›</Text>
      </Pressable>
      {expanded && PAST.map(e => <PastEventRow key={e.id} event={e} />)}
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No upcoming events</Text>
      <Text style={styles.emptySub}>
        {IS_MANAGER
          ? 'Schedule your first event and notify the team.'
          : "Your manager hasn't added any events yet."}
      </Text>
      {IS_MANAGER && (
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [styles.emptyAddBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.emptyAddBtnText}>+ Add your first event</Text>
        </Pressable>
      )}
    </View>
  );
}

function ScheduleHeader({ onAdd, onProfile }: { onAdd: () => void; onProfile: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.teamPill}>
        <View style={styles.teamDot} />
        <Text style={styles.teamName}>TRASHDOGS</Text>
      </View>
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Schedule</Text>
        <View style={styles.headerRight}>
          {IS_MANAGER && (
            <TouchableOpacity
              style={styles.addBtn}
              activeOpacity={0.75}
              onPress={onAdd}
            >
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          )}
          <AvatarPill onPress={onProfile} />
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const goToCreateEvent = () => navigation.navigate('CreateEvent');
  const goToProfile     = () => navigation.navigate('Profile');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScheduleHeader onAdd={goToCreateEvent} onProfile={goToProfile} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {UPCOMING.length === 0 ? (
          <EmptyState onAdd={goToCreateEvent} />
        ) : (
          <>
            <Text style={styles.sectionLabel}>Upcoming</Text>
            {UPCOMING.map(event => (
              <EventRow
                key={event.id}
                event={event}
                onPress={() =>
                  navigation.navigate('EventDetail', {
                    eventId: event.id,
                    title: event.title,
                  })
                }
              />
            ))}
          </>
        )}
        <PastSection />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[800],
  },

  // Header
  header: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
    paddingBottom: spacing[14],
  },
  teamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing[8],
  },
  teamDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: TEAM[300],
  },
  teamName: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: TEAM[300],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    ...T.headingXXL,
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.s,
    backgroundColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: TEAM.on,
    marginTop: -1,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[32],
  },
  sectionLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: navy[400],
    textTransform: 'uppercase',
    marginBottom: spacing[8],
    marginTop: spacing[4],
  },

  // Event row
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[4],
    borderRadius: radius.m,
    marginBottom: spacing[4],
  },
  eventInfo: {
    flex: 1,
    gap: 3,
  },
  eventTitle: {
    ...T.headingM,
    color: navy[50],
  },
  eventMeta: {
    ...T.bodyS,
    color: navy[300],
  },

  // Date chip
  dateChip: {
    width: 50,
    paddingVertical: 9,
    borderRadius: radius.s,
    backgroundColor: TEAM[700],
    alignItems: 'center',
    gap: 1,
  },
  dateChipMuted: {
    backgroundColor: navy[600],
  },
  dateWeekday: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.2,
    color: TEAM[300],
  },
  dateDay: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  dateMonth: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.2,
    color: TEAM[300],
  },
  dateLabelMuted: {
    color: navy[400],
  },
  dateDayMuted: {
    color: navy[300],
  },

  // Kind tag
  kindTag: {
    alignSelf: 'flex-start',
    borderRadius: radius.xs,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  kindText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.2,
  },

  // Manager pill
  managerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: navy[700],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderWidth: 0.5,
    borderColor: navy[500],
  },
  managerPillIn: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    lineHeight: 14,
    color: status.success.pure,
  },
  managerPillDot: {
    fontFamily: fonts.ui,
    fontSize: 11,
    lineHeight: 14,
    color: navy[400],
  },
  managerPillOut: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    lineHeight: 14,
    color: status.error.pure,
  },

  // Player pill
  playerPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderWidth: 0.5,
  },
  playerPillText: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    lineHeight: 14,
  },

  // Score badge
  scoreBadge: {
    borderRadius: radius.xs,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  scoreText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    lineHeight: 14,
  },

  // Past section
  pastSection: {
    marginTop: spacing[16],
  },
  pastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[4],
    borderTopWidth: 0.5,
    borderTopColor: navy[600],
  },
  pastHeaderTitle: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: navy[400],
    textTransform: 'uppercase',
  },
  pastChevron: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 22,
    color: navy[400],
    transform: [{ rotate: '90deg' }],
  },
  pastChevronOpen: {
    transform: [{ rotate: '270deg' }],
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[64],
    gap: spacing[8],
  },
  emptyTitle: {
    ...T.headingL,
    color: navy[300],
    textAlign: 'center',
  },
  emptySub: {
    ...T.bodyM,
    color: navy[400],
    textAlign: 'center',
    paddingHorizontal: spacing[32],
  },
  emptyAddBtn: {
    marginTop: spacing[8],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.45)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
  },
  emptyAddBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: TEAM[300],
  },
});

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
