// Home tab — switches between B-01 (Manager) and C-01 (Player) based on role.
// Temporary scaffolding: flip IS_MANAGER to preview each view.
// Replace with Firebase auth role check when backend is connected.

const IS_MANAGER = true;
const IS_GAME_DAY = true;

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { navy, teams, status, fonts, radius, spacing } from '../theme';
import AvatarPill from '../components/AvatarPill';

type Response = 'in' | 'out' | 'maybe' | null;

const TEAM = teams.trashdogs;

// Placeholder availability counts for B-01
const AVAIL = { in: 7, out: 2, maybe: 1, noResp: 3 } as const;

// ─── Root export ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  return IS_MANAGER ? <ManagerHomeScreen /> : <PlayerHomeScreen />;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  B-01 · Manager Home                                                     ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function ManagerHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const hasEvent = true;

  const goToCreateEvent = () => navigation.navigate('CreateEvent');
  const goToProfile     = () => navigation.navigate('Profile');
  const goToGameday     = () => navigation.navigate('Gameday');
  const goToTeam        = () => navigation.navigate('Team');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ManagerPageHeader hasEvent={hasEvent} onAdd={goToCreateEvent} onProfile={goToProfile} />

        {/* Region 1: hero or empty state */}
        <View style={styles.heroWrapper}>
          {hasEvent
            ? <ManagerHeroCard onGameday={IS_GAME_DAY ? goToGameday : undefined} />
            : <ManagerEmptyCard />
          }
        </View>

        {/* Region 2: quick actions (between card and announcements) */}
        {hasEvent && <ManagerQuickActions noRespCount={AVAIL.noResp} onAdd={goToCreateEvent} />}

        {/* Region 3: announcements */}
        <AnnouncementsSection hasEvent={hasEvent} onViewAll={goToTeam} />

        <View style={{ height: spacing[24] }} />
      </ScrollView>
    </View>
  );
}

// ─── Manager header — team switcher + title + "+" add-event button + avatar ──

function ManagerPageHeader({
  hasEvent, onAdd, onProfile,
}: {
  hasEvent: boolean;
  onAdd: () => void;
  onProfile: () => void;
}) {
  return (
    <View style={styles.header}>
      <View>
        <View style={styles.teamPill}>
          <View style={styles.teamDot} />
          <Text style={styles.teamPillText}>Trashdogs</Text>
          <Text style={styles.teamPillChevron}>›</Text>
        </View>
        <Text style={styles.pageTitle}>
          {hasEvent ? 'Next up' : 'No games yet'}
        </Text>
      </View>

      <View style={styles.headerButtons}>
        <Pressable
          style={styles.addEventBtn}
          onPress={onAdd}
          android_ripple={{ color: 'rgba(255,255,255,0.15)', borderless: true }}
        >
          <Text style={styles.addEventBtnText}>+</Text>
        </Pressable>
        <AvatarPill onPress={onProfile} />
      </View>
    </View>
  );
}

// ─── Manager hero card — event details + availability summary bar ─────────────

function ManagerHeroCard({ onGameday }: { onGameday?: () => void }) {
  return (
    <View style={styles.heroCard}>
      {/* Meta row */}
      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <View style={styles.gamePill}>
            <Text style={styles.gamePillText}>Game</Text>
          </View>
          <Text style={styles.metaSubtext}>{IS_GAME_DAY ? 'Tonight' : 'In 2 days'}</Text>
        </View>
        <Text style={styles.respondedTally}>13 / 16 responded</Text>
      </View>

      {/* Day + time */}
      <View style={styles.daytimeRow}>
        <Text style={styles.dayText}>{IS_GAME_DAY ? 'Today' : 'Friday'}</Text>
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
        <Text style={styles.dividerLabel}>Availability</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Availability summary — 4 chips in a row */}
      <AvailabilityBar avail={AVAIL} />

      {/* Game day shortcut */}
      {onGameday && (
        <Pressable style={styles.gamedayLink} onPress={onGameday}>
          <Text style={styles.gamedayLinkText}>Who's here →</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Availability bar — four status chips in a horizontal row ─────────────────

type AvailCounts = typeof AVAIL;

const AVAIL_CHIPS: {
  key: keyof AvailCounts;
  label: string;
  dot: string;
  bg: string;
  border: string;
  text: string;
}[] = [
  {
    key: 'in',
    label: 'In',
    dot: TEAM[300],
    bg: `rgba(${hexToRgbVals(TEAM[500])}, 0.16)`,
    border: `rgba(${hexToRgbVals(TEAM[500])}, 0.38)`,
    text: TEAM[300],
  },
  {
    key: 'out',
    label: 'Out',
    dot: status.error.pure,
    bg: status.error.subtle,
    border: 'rgba(239,68,68,0.38)',
    text: status.error.light,
  },
  {
    key: 'maybe',
    label: 'Maybe',
    dot: status.alert.pure,
    bg: status.alert.subtle,
    border: 'rgba(245,158,11,0.38)',
    text: status.alert.light,
  },
  {
    key: 'noResp',
    label: 'No resp.',
    dot: navy[400],
    bg: 'rgba(95,107,133,0.14)',
    border: 'rgba(95,107,133,0.28)',
    text: navy[300],
  },
];

function AvailabilityBar({ avail }: { avail: AvailCounts }) {
  return (
    <View style={styles.availRow}>
      {AVAIL_CHIPS.map((chip) => (
        <View
          key={chip.key}
          style={[
            styles.availChip,
            { backgroundColor: chip.bg, borderColor: chip.border },
          ]}
        >
          <View style={[styles.availDot, { backgroundColor: chip.dot }]} />
          <Text style={[styles.availLabel, { color: chip.text }]}>
            {chip.label}
          </Text>
          <Text style={[styles.availCount, { color: chip.text }]}>
            {avail[chip.key]}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Manager quick actions ────────────────────────────────────────────────────

function ManagerQuickActions({ noRespCount, onAdd }: { noRespCount: number; onAdd: () => void }) {
  return (
    <View style={styles.quickActions}>
      {noRespCount > 0 && (
        <Pressable
          style={styles.remindBtn}
          android_ripple={{ color: `rgba(${hexToRgbVals(TEAM[500])}, 0.15)` }}
        >
          <Text style={styles.remindBtnText}>
            🔔  Remind {noRespCount} non-responder{noRespCount !== 1 ? 's' : ''}
          </Text>
        </Pressable>
      )}

      <Pressable
        style={styles.addEventLargeBtn}
        onPress={onAdd}
        android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
      >
        <Text style={styles.addEventLargeBtnText}>+ Add event</Text>
      </Pressable>
    </View>
  );
}

// ─── Manager empty state ──────────────────────────────────────────────────────

function ManagerEmptyCard() {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>📅</Text>
      </View>
      <Text style={styles.emptyTitle}>No games scheduled.</Text>
      <Text style={styles.emptyBody}>
        Add your first event and your team will be notified instantly.
      </Text>
    </View>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  C-01 · Player Home                                                      ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function PlayerHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [response, setResponse] = useState<Response>('in');
  const hasEvent = true;

  const goToProfile = () => navigation.navigate('Profile');
  const goToGameday = () => navigation.navigate('Gameday');
  const goToTeam    = () => navigation.navigate('Team');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <PlayerPageHeader hasEvent={hasEvent} onProfile={goToProfile} />

        <View style={styles.heroWrapper}>
          {hasEvent ? (
            <PlayerHeroCard
              response={response}
              onRespond={setResponse}
              onGameday={IS_GAME_DAY ? goToGameday : undefined}
            />
          ) : (
            <PlayerEmptyCard />
          )}
        </View>

        <AnnouncementsSection hasEvent={hasEvent} onViewAll={goToTeam} />

        <View style={{ height: spacing[24] }} />
      </ScrollView>
    </View>
  );
}

function PlayerPageHeader({ hasEvent, onProfile }: { hasEvent: boolean; onProfile: () => void }) {
  return (
    <View style={styles.header}>
      <View>
        <View style={styles.teamPill}>
          <View style={styles.teamDot} />
          <Text style={styles.teamPillText}>Trashdogs</Text>
          <Text style={styles.teamPillChevron}>›</Text>
        </View>
        <Text style={styles.pageTitle}>
          {hasEvent ? 'Next up' : 'No games yet'}
        </Text>
      </View>
      <View style={styles.avatarOffset}>
        <AvatarPill onPress={onProfile} />
      </View>
    </View>
  );
}

function PlayerHeroCard({ response, onRespond, onGameday }: {
  response: Response;
  onRespond: (r: Response) => void;
  onGameday?: () => void;
}) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <View style={styles.gamePill}>
            <Text style={styles.gamePillText}>Game</Text>
          </View>
          <Text style={styles.metaSubtext}>{IS_GAME_DAY ? 'Tonight' : 'In 2 days'}</Text>
        </View>
        <View style={styles.inCount}>
          <View style={styles.inCountDot} />
          <Text style={styles.inCountText}>10 in</Text>
        </View>
      </View>

      <View style={styles.daytimeRow}>
        <Text style={styles.dayText}>{IS_GAME_DAY ? 'Today' : 'Friday'}</Text>
        <Text style={styles.timeText}>7:30 pm</Text>
      </View>

      <Text style={styles.vsLabel}>vs.</Text>
      <Text style={styles.opponentText}>Ice Sharks</Text>

      <View style={styles.venuePill}>
        <Text style={styles.venuePin}>📍</Text>
        <Text style={styles.venueText}>The Barn — Rink 2</Text>
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>Are you in?</Text>
        <View style={styles.dividerLine} />
      </View>

      <InOutMaybeToggle response={response} onRespond={onRespond} />

      {onGameday && (
        <Pressable style={styles.gamedayLink} onPress={onGameday}>
          <Text style={styles.gamedayLinkText}>Who's here →</Text>
        </Pressable>
      )}
    </View>
  );
}

function PlayerEmptyCard() {
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

// ─── In/Out/Maybe toggle (player only) ───────────────────────────────────────

const OPTS: { id: Response; label: string; glyph: string }[] = [
  { id: 'in',    label: "I'm in", glyph: '✓' },
  { id: 'out',   label: 'Out',    glyph: '✕' },
  { id: 'maybe', label: 'Maybe',  glyph: '?' },
];

const RESPONSE_TINTS: Record<NonNullable<Response>, string> = {
  in:    TEAM[500],
  out:   status.error.pure,
  maybe: status.alert.pure,
};

const RESPONSE_ON: Record<NonNullable<Response>, string> = {
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
      {response && (
        <View
          style={[
            styles.togglePill,
            {
              left: `${(Math.max(0, activeIdx) / OPTS.length) * 100}%` as any,
              width: `${(1 / OPTS.length) * 100}%` as any,
              backgroundColor: RESPONSE_TINTS[response],
            },
          ]}
        />
      )}
      {OPTS.map((opt) => {
        const isActive = response === opt.id;
        const textColor = isActive && opt.id
          ? RESPONSE_ON[opt.id]
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

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  Shared components                                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function AnnouncementsSection({ hasEvent, onViewAll }: { hasEvent: boolean; onViewAll: () => void }) {
  const ann = hasEvent
    ? { title: 'Jerseys — wear white on Friday', meta: 'Pat N. · 2h ago' }
    : { title: 'Welcome to Trashdogs — first game posts soon', meta: 'Pat N. · yesterday' };

  return (
    <View style={styles.announcements}>
      <View style={styles.announcementsHeader}>
        <Text style={styles.announcementsLabel}>From your manager</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.announcementsAll}>All →</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.announcementCard} activeOpacity={0.75} onPress={onViewAll}>
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

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  Styles                                                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[800],
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 8,
  },

  // ── Header (shared shell, different right element per role) ──────────────
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

  // Manager header right: "+" button + avatar pill
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    marginTop: 22,
  },
  addEventBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TEAM[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  addEventBtnText: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: TEAM.on,
    lineHeight: 22,
    marginTop: -1,
  },

  // Player header right: avatar pill (with top offset to match)
  avatarOffset: {
    marginTop: 24,
  },

  // ── Hero card (shared shell) ─────────────────────────────────────────────
  heroWrapper: {
    paddingHorizontal: spacing[16],
  },
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
  respondedTally: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.55)',
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

  // Day / time
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
  venuePin: { fontSize: 11 },
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
    marginBottom: 12,
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

  // ── Availability bar (B-01) ──────────────────────────────────────────────
  availRow: {
    flexDirection: 'row',
    gap: 6,
  },
  availChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radius.s,
    borderWidth: 0.5,
  },
  availDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  availLabel: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.4,
    fontWeight: '600',
  },
  availCount: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 15,
  },

  // ── Gameday link ──────────────────────────────────────────────────────────
  gamedayLink: {
    marginTop: spacing[12],
    alignSelf: 'flex-end',
  },
  gamedayLinkText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: TEAM[300],
  },

  // ── Quick actions (B-01) ─────────────────────────────────────────────────
  quickActions: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
    gap: spacing[8],
  },
  remindBtn: {
    height: 52,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.45)`,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
  },
  remindBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: TEAM[300],
  },
  addEventLargeBtn: {
    height: 52,
    borderRadius: radius.l,
    backgroundColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TEAM[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  addEventLargeBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: TEAM.on,
  },

  // ── Player toggle (C-01) ─────────────────────────────────────────────────
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

  // ── Empty state (shared layout, different copy per role) ─────────────────
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
  emptyIcon: { fontSize: 32 },
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

  // ── Announcements (shared) ───────────────────────────────────────────────
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

// ─── Utility ──────────────────────────────────────────────────────────────────

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
