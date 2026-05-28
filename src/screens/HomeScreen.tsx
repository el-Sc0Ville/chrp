// C-01 · Player Home
// Primary job: "Do I have a game coming up, and am I in?"
// Three UI regions:
//   1. Hero event card — date, opponent, venue, In/Out/Maybe toggle
//   2. Announcements section — manager messages
//   3. (Tab bar lives in the navigator)

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navy, ice, teams, fonts, radius, spacing } from '../theme';

type Response = 'in' | 'out' | 'maybe' | null;

const TEAM = teams.trashdogs;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [response, setResponse] = useState<Response>('in');
  const hasEvent = true; // swap to false to preview empty state

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title strip */}
        <PageHeader hasEvent={hasEvent} />

        {/* Region 1: Hero or empty state */}
        <View style={styles.heroWrapper}>
          {hasEvent ? (
            <HeroEventCard
              response={response}
              onRespond={setResponse}
            />
          ) : (
            <EmptyEventCard />
          )}
        </View>

        {/* Region 2: Announcements */}
        <AnnouncementsSection hasEvent={hasEvent} />

        <View style={{ height: spacing[24] }} />
      </ScrollView>
    </View>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────

function PageHeader({ hasEvent }: { hasEvent: boolean }) {
  return (
    <View style={styles.header}>
      <View>
        {/* Team switcher pill */}
        <View style={styles.teamPill}>
          <View style={styles.teamDot} />
          <Text style={styles.teamPillText}>Trashdogs</Text>
          <Text style={styles.teamPillChevron}>›</Text>
        </View>

        <Text style={styles.pageTitle}>
          {hasEvent ? 'Next up' : 'No games yet'}
        </Text>
      </View>

      {/* Avatar shortcut */}
      <View style={styles.avatarChip}>
        <Text style={styles.avatarText}>JM</Text>
      </View>
    </View>
  );
}

// ─── Hero event card ──────────────────────────────────────────────────────────

function HeroEventCard({ response, onRespond }: {
  response: Response;
  onRespond: (r: Response) => void;
}) {
  return (
    <View style={styles.heroCard}>
      {/* Meta row */}
      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <View style={styles.gamePill}>
            <Text style={styles.gamePillText}>Game</Text>
          </View>
          <Text style={styles.metaSubtext}>In 2 days</Text>
        </View>
        <View style={styles.inCount}>
          <View style={styles.inCountDot} />
          <Text style={styles.inCountText}>10 in</Text>
        </View>
      </View>

      {/* Day + time */}
      <View style={styles.daytimeRow}>
        <Text style={styles.dayText}>Friday</Text>
        <Text style={styles.timeText}>7:30 pm</Text>
      </View>

      {/* Opponent */}
      <Text style={styles.vsLabel}>vs.</Text>
      <Text style={styles.opponentText}>Ice Sharks</Text>

      {/* Venue pill */}
      <View style={styles.venuePill}>
        <Text style={styles.venuePin}>📍</Text>
        <Text style={styles.venueText}>The Barn — Rink 2</Text>
      </View>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>Are you in?</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* The toggle */}
      <InOutMaybeToggle response={response} onRespond={onRespond} />
    </View>
  );
}

// ─── In/Out/Maybe toggle ──────────────────────────────────────────────────────

const OPTS: { id: Response; label: string; glyph: string }[] = [
  { id: 'in',    label: "I'm in", glyph: '✓' },
  { id: 'out',   label: 'Out',    glyph: '✕' },
  { id: 'maybe', label: 'Maybe',  glyph: '?' },
];

const TINTS: Record<NonNullable<Response>, string> = {
  in:    TEAM[500],
  out:   '#D6253F',
  maybe: '#F59E0B',
};

const ON_TINTS: Record<NonNullable<Response>, string> = {
  in:    TEAM.on,
  out:   '#FFFFFF',
  maybe: '#0B1220',
};

function InOutMaybeToggle({ response, onRespond }: {
  response: Response;
  onRespond: (r: Response) => void;
}) {
  const activeIdx = OPTS.findIndex(o => o.id === response);

  return (
    <View style={styles.toggleContainer}>
      {/* Sliding pill indicator */}
      {response && (
        <View
          style={[
            styles.togglePill,
            {
              left: `${(Math.max(0, activeIdx) / OPTS.length) * 100}%` as any,
              width: `${(1 / OPTS.length) * 100}%` as any,
              backgroundColor: TINTS[response],
            },
          ]}
        />
      )}

      {OPTS.map((opt) => {
        const isActive = response === opt.id;
        const textColor = isActive && opt.id
          ? ON_TINTS[opt.id]
          : 'rgba(255,255,255,0.70)';

        return (
          <Pressable
            key={opt.id}
            style={styles.toggleSegment}
            onPress={() => onRespond(opt.id)}
            android_ripple={{ color: 'rgba(255,255,255,0.1)', borderless: true }}
          >
            <View style={[
              styles.toggleGlyph,
              { backgroundColor: isActive ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)' },
            ]}>
              <Text style={[styles.toggleGlyphText, { color: textColor }]}>
                {opt.glyph}
              </Text>
            </View>
            <Text style={[styles.toggleLabel, { color: textColor }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyEventCard() {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>📅</Text>
      </View>
      <Text style={styles.emptyTitle}>Nothing scheduled yet.</Text>
      <Text style={styles.emptyBody}>
        Ask your manager to add a game — you'll get a notification the moment it's posted.
      </Text>
    </View>
  );
}

// ─── Announcements ────────────────────────────────────────────────────────────

function AnnouncementsSection({ hasEvent }: { hasEvent: boolean }) {
  const ann = hasEvent
    ? { title: 'Jerseys — wear white on Friday', meta: 'Pat N. · 2h ago' }
    : { title: 'Welcome to Trashdogs — first game posts soon', meta: 'Pat N. · yesterday' };

  return (
    <View style={styles.announcements}>
      <View style={styles.announcementsHeader}>
        <Text style={styles.announcementsLabel}>From your manager</Text>
        <TouchableOpacity>
          <Text style={styles.announcementsAll}>All →</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.announcementCard} activeOpacity={0.75}>
        <View style={styles.announcementIcon}>
          <Text>📣</Text>
        </View>
        <View style={styles.announcementBody}>
          <Text style={styles.announcementTitle} numberOfLines={1}>
            {ann.title}
          </Text>
          <Text style={styles.announcementMeta}>{ann.meta}</Text>
        </View>
        <Text style={styles.announcementChevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[800],
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
    paddingBottom: spacing[14],
  },
  teamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  teamDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: TEAM[300],
  },
  teamPillText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: TEAM[300],
    fontWeight: '600',
  },
  teamPillChevron: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: TEAM[300],
    lineHeight: 14,
  },
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  avatarChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TEAM[700],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  avatarText: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Hero wrapper
  heroWrapper: {
    paddingHorizontal: spacing[16],
  },

  // Hero card
  heroCard: {
    borderRadius: radius.xxl,
    padding: 18,
    backgroundColor: navy[700],
    borderWidth: 0.5,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.38)`,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[16],
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gamePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  gamePillText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  metaSubtext: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  inCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  inCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7AE6B1',
  },
  inCountText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#7AE6B1',
    fontWeight: '600',
  },

  // Day/time
  daytimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 14,
  },
  dayText: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  timeText: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    lineHeight: 22,
  },

  // Opponent
  vsLabel: {
    fontFamily: fonts.displayRegular,
    fontSize: 17,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: -0.2,
    lineHeight: 18,
    marginBottom: 2,
  },
  opponentText: {
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.9,
    color: '#FFFFFF',
    lineHeight: 38,
    marginBottom: 12,
  },

  // Venue
  venuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 18,
  },
  venuePin: {
    fontSize: 11,
  },
  venueText: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.90)',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  dividerLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  togglePill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 10,
  },
  toggleSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    zIndex: 1,
  },
  toggleGlyph: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleGlyphText: {
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    fontWeight: '600',
  },

  // Empty state
  emptyCard: {
    borderRadius: radius.xxl,
    padding: spacing[40],
    paddingVertical: spacing[48],
    backgroundColor: navy[700],
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    minHeight: 280,
    justifyContent: 'center',
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(229,234,242,0.55)',
    textAlign: 'center',
    maxWidth: 240,
  },

  // Announcements
  announcements: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
  announcementsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  announcementsLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: 'rgba(229,234,242,0.55)',
    fontWeight: '600',
  },
  announcementsAll: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: TEAM[300],
    fontWeight: '600',
  },
  announcementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: navy[700],
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.m,
    padding: 12,
  },
  announcementIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.22)`,
    borderWidth: 0.5,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementBody: {
    flex: 1,
    minWidth: 0,
  },
  announcementTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 18,
    marginBottom: 2,
  },
  announcementMeta: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: 'rgba(229,234,242,0.55)',
  },
  announcementChevron: {
    fontFamily: fonts.ui,
    fontSize: 18,
    color: 'rgba(229,234,242,0.40)',
    lineHeight: 20,
  },
});

// Helper: convert hex to "r, g, b" string for rgba() usage in StyleSheet
function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
