// Home tab — switches between B-01 (Manager) and C-01 (Player) based on role.

import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Pressable, Linking, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { navy, teams, status, fonts, radius, spacing } from '../theme';
import AvatarPill from '../components/AvatarPill';
import { useNotifications } from '../context/NotificationContext';
import { useUserContext } from '../context/UserContext';
import { db } from '../firebase';
import { useEvents } from '../firebase/hooks/useEvents';
import { useTeam } from '../firebase/hooks/useTeam';
import { useResponses } from '../firebase/hooks/useResponses';
import type { Event as TeamEvent } from '../firebase/schema';

type Response = 'in' | 'out' | 'maybe' | null;

const TEAM_ID = 'trashdogs';
const TEAM    = teams.trashdogs;

// Placeholder availability counts — Phase 2: subscribe to responses subcollection
interface AvailCounts {
  in: number;
  out: number;
  maybe: number;
  noResp: number;
}
const AVAIL: AvailCounts = { in: 7, out: 2, maybe: 1, noResp: 3 };

// ─── Root export ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { isManager } = useUserContext();
  return isManager ? <ManagerHomeScreen /> : <PlayerHomeScreen />;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  B-01 · Manager Home                                                     ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function ManagerHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { unreadCount } = useNotifications();

  const { team }            = useTeam(TEAM_ID);
  const { events, loading } = useEvents(TEAM_ID);

  const nextEvent = events.find(e => e.startsAt.toDate() > new Date()) ?? null;
  const hasEvent  = nextEvent !== null;

  const goToCreateEvent   = () => navigation.navigate('CreateEvent');
  const goToProfile       = () => navigation.navigate('Profile');
  const goToGameday       = () => navigation.navigate('Gameday');
  const goToTeam          = () => navigation.navigate('Team');
  const goToNotifications = () => navigation.navigate('Notifications');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ManagerPageHeader
          teamName={team?.name ?? 'Trashdogs'}
          hasEvent={hasEvent}
          onAdd={goToCreateEvent}
          onProfile={goToProfile}
          onNotifications={goToNotifications}
          unreadCount={unreadCount}
        />

        {/* Region 1: hero or empty state */}
        <View style={styles.heroWrapper}>
          {loading ? (
            <HeroSkeleton />
          ) : hasEvent ? (
            <ManagerHeroCard
              event={nextEvent!}
              avail={AVAIL}
              onGameday={isEventToday(nextEvent!.startsAt) ? goToGameday : undefined}
            />
          ) : (
            <ManagerEmptyCard />
          )}
        </View>

        {/* Region 2: quick actions */}
        {!loading && hasEvent && (
          <ManagerQuickActions noRespCount={AVAIL.noResp} onAdd={goToCreateEvent} />
        )}

        {/* Region 3: announcements */}
        <AnnouncementsSection hasEvent={hasEvent} onViewAll={goToTeam} />

        <View style={{ height: spacing[24] }} />
      </ScrollView>
    </View>
  );
}

// ─── Manager header ───────────────────────────────────────────────────────────

function ManagerPageHeader({
  teamName, hasEvent, onAdd, onProfile, onNotifications, unreadCount,
}: {
  teamName: string;
  hasEvent: boolean;
  onAdd: () => void;
  onProfile: () => void;
  onNotifications: () => void;
  unreadCount: number;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <BellButton onPress={onNotifications} unreadCount={unreadCount} />
        <View>
          <View style={styles.teamPill}>
            <View style={styles.teamDot} />
            <Text style={styles.teamPillText}>{teamName}</Text>
            <Text style={styles.teamPillChevron}>›</Text>
          </View>
          <Text style={styles.pageTitle}>
            {hasEvent ? 'Next up' : 'No games yet'}
          </Text>
        </View>
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

// ─── Manager hero card ────────────────────────────────────────────────────────

function ManagerHeroCard({ event, avail, onGameday }: {
  event: TeamEvent;
  avail: AvailCounts;
  onGameday?: () => void;
}) {
  const { prefix, name } = parseTitleDisplay(event);
  const responded = avail.in + avail.out + avail.maybe;
  const total     = responded + avail.noResp;

  return (
    <View style={styles.heroCard}>
      {/* Meta row */}
      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <View style={styles.gamePill}>
            <Text style={styles.gamePillText}>{EVENT_TYPE_LABEL[event.type]}</Text>
          </View>
          <Text style={styles.metaSubtext}>{formatRelativeDay(event.startsAt)}</Text>
        </View>
        <Text style={styles.respondedTally}>{responded} / {total} responded</Text>
      </View>

      {/* Day + time */}
      <View style={styles.daytimeRow}>
        <Text style={styles.dayText}>{formatDay(event.startsAt)}</Text>
        <Text style={styles.timeText}>{formatTime(event.startsAt)}</Text>
      </View>

      {/* Opponent / title */}
      {prefix ? <Text style={styles.vsLabel}>{prefix}</Text> : null}
      <Text style={styles.opponentText}>{name}</Text>

      {/* Venue pill */}
      <Pressable
        style={({ pressed }) => [styles.venuePill, pressed && { opacity: 0.7 }]}
        onPress={() => Linking.openURL('https://maps.google.com/?q=' + encodeURIComponent(event.venue))}
      >
        <Text style={styles.venuePin}>📍</Text>
        <Text style={styles.venueText}>{event.venue}</Text>
      </Pressable>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>Availability</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Availability summary */}
      <AvailabilityBar avail={avail} />

      {/* Gameday shortcut */}
      {onGameday && (
        <Pressable style={styles.gamedayLink} onPress={onGameday}>
          <Text style={styles.gamedayLinkText}>Who's here →</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Availability bar ─────────────────────────────────────────────────────────

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
  const { unreadCount } = useNotifications();
  const { user } = useUserContext();

  const { team }            = useTeam(TEAM_ID);
  const { events, loading } = useEvents(TEAM_ID);

  const nextEvent = events.find(e => e.startsAt.toDate() > new Date()) ?? null;
  const hasEvent  = nextEvent !== null;

  // TODO Phase 2b: replace mockUserId with real Firebase Auth uid
  const uid = user?.uid ?? 'anon';
  const { responses: firestoreResponses } = useResponses(TEAM_ID, nextEvent?.id ?? null);
  const response: Response = (firestoreResponses[uid] as Response) ?? null;

  const [subSheetVisible, setSubSheetVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  const handleRespond = async (r: Response) => {
    if (!r || !nextEvent) return;
    if (r === 'out' || r === 'maybe') setSubSheetVisible(true);
    // TODO Phase 2b: replace mockUserId with real Firebase Auth uid
    const responseRef = doc(db, 'teams', TEAM_ID, 'events', nextEvent.id, 'responses', uid);
    console.log('[HomeScreen] writing response', r, 'to', responseRef.path);
    try {
      await setDoc(responseRef, {
        userId:       uid,
        displayName:  user?.email ?? 'Player',
        response:     r,
        respondedAt:  Timestamp.now(),
        setByManager: false,
      });
      console.log('[HomeScreen] response write succeeded');
    } catch (err) {
      console.error('[HomeScreen] response write failed:', err);
    }
  };

  const goToProfile       = () => navigation.navigate('Profile');
  const goToGameday       = () => navigation.navigate('Gameday');
  const goToTeam          = () => navigation.navigate('Team');
  const goToNotifications = () => navigation.navigate('Notifications');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <PlayerPageHeader
          teamName={team?.name ?? 'Trashdogs'}
          hasEvent={hasEvent}
          onProfile={goToProfile}
          onNotifications={goToNotifications}
          unreadCount={unreadCount}
        />

        <View style={styles.heroWrapper}>
          {loading ? (
            <HeroSkeleton />
          ) : hasEvent ? (
            <PlayerHeroCard
              event={nextEvent!}
              response={response}
              onRespond={handleRespond}
              onGameday={isEventToday(nextEvent!.startsAt) ? goToGameday : undefined}
            />
          ) : (
            <PlayerEmptyCard />
          )}
        </View>

        <AnnouncementsSection hasEvent={hasEvent} onViewAll={goToTeam} />

        <View style={{ height: spacing[24] }} />
      </ScrollView>

      <SubRequestSheet
        visible={subSheetVisible}
        gameName={nextEvent?.title ?? ''}
        onYes={() => {
          setSubSheetVisible(false);
          showToast('Request sent to manager');
          // TODO Phase 2: wire sub request to Firestore + trigger manager push notification
        }}
        onDismiss={() => setSubSheetVisible(false)}
      />
      {toast !== null && (
        <View
          style={[styles.toast, { bottom: Math.max(insets.bottom, spacing[12]) + spacing[16] }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function PlayerPageHeader({
  teamName, hasEvent, onProfile, onNotifications, unreadCount,
}: {
  teamName: string;
  hasEvent: boolean;
  onProfile: () => void;
  onNotifications: () => void;
  unreadCount: number;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <BellButton onPress={onNotifications} unreadCount={unreadCount} />
        <View>
          <View style={styles.teamPill}>
            <View style={styles.teamDot} />
            <Text style={styles.teamPillText}>{teamName}</Text>
            <Text style={styles.teamPillChevron}>›</Text>
          </View>
          <Text style={styles.pageTitle}>
            {hasEvent ? 'Next up' : 'No games yet'}
          </Text>
        </View>
      </View>
      <View style={styles.avatarOffset}>
        <AvatarPill onPress={onProfile} />
      </View>
    </View>
  );
}

function PlayerHeroCard({ event, response, onRespond, onGameday }: {
  event: TeamEvent;
  response: Response;
  onRespond: (r: Response) => void;
  onGameday?: () => void;
}) {
  const { prefix, name } = parseTitleDisplay(event);
  return (
    <View style={styles.heroCard}>
      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <View style={styles.gamePill}>
            <Text style={styles.gamePillText}>{EVENT_TYPE_LABEL[event.type]}</Text>
          </View>
          <Text style={styles.metaSubtext}>{formatRelativeDay(event.startsAt)}</Text>
        </View>
        <View style={styles.inCount}>
          <View style={styles.inCountDot} />
          <Text style={styles.inCountText}>{AVAIL.in} in</Text>
        </View>
      </View>

      <View style={styles.daytimeRow}>
        <Text style={styles.dayText}>{formatDay(event.startsAt)}</Text>
        <Text style={styles.timeText}>{formatTime(event.startsAt)}</Text>
      </View>

      {prefix ? <Text style={styles.vsLabel}>{prefix}</Text> : null}
      <Text style={styles.opponentText}>{name}</Text>

      <View style={styles.venuePill}>
        <Text style={styles.venuePin}>📍</Text>
        <Text style={styles.venueText}>{event.venue}</Text>
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

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <View style={[styles.heroCard, { minHeight: 280 }]}>
      <View style={[styles.skeletonLine, { width: '40%', height: 20, marginBottom: spacing[16] }]} />
      <View style={[styles.skeletonLine, { width: '55%', height: 26, marginBottom: spacing[8]  }]} />
      <View style={[styles.skeletonLine, { width: '70%', height: 42, marginBottom: spacing[12] }]} />
      <View style={[styles.skeletonLine, { width: '45%', height: 28, marginBottom: spacing[20] }]} />
      <View style={[styles.skeletonLine, { width: '100%', height: 48 }]} />
    </View>
  );
}

// ─── Bell button ─────────────────────────────────────────────────────────────

function BellButton({ onPress, unreadCount }: { onPress: () => void; unreadCount: number }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <BellIcon />
      {unreadCount > 0 && (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
        </View>
      )}
    </Pressable>
  );
}

function BellIcon() {
  const color = 'rgba(229,234,242,0.75)';
  return (
    <View style={{ width: 22, height: 24 }}>
      {/* stem */}
      <View style={{
        position: 'absolute', top: 0, left: 10,
        width: 2, height: 4, backgroundColor: color, borderRadius: 1,
      }} />
      {/* dome */}
      <View style={{
        position: 'absolute', top: 3, left: 2,
        width: 18, height: 13,
        borderTopLeftRadius: 9, borderTopRightRadius: 9,
        borderWidth: 1.5, borderColor: color, borderBottomWidth: 0,
      }} />
      {/* rim */}
      <View style={{
        position: 'absolute', top: 15, left: 1,
        width: 20, height: 2, backgroundColor: color, borderRadius: 1,
      }} />
      {/* clapper */}
      <View style={{
        position: 'absolute', bottom: 0, left: 9,
        width: 4, height: 4, borderRadius: 2, backgroundColor: color,
      }} />
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

// ─── Sub request sheet ────────────────────────────────────────────────────────

function SubRequestSheet({
  visible, gameName, onYes, onDismiss,
}: {
  visible: boolean;
  gameName: string;
  onYes: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.sheetBackdrop} onPress={onDismiss}>
        <Pressable
          onPress={() => {}}
          style={[styles.subRequestSheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.subRequestTitle}>Need a sub?</Text>
          <Text style={styles.subRequestBody}>
            Want us to let your manager know you need a replacement for {gameName}?
          </Text>
          <Pressable
            style={({ pressed }) => [styles.subRequestYesBtn, pressed && { opacity: 0.85 }]}
            onPress={onYes}
          >
            <Text style={styles.subRequestYesBtnText}>Yes, request a sub</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.subRequestNoBtn, pressed && { opacity: 0.75 }]}
            onPress={onDismiss}
          >
            <Text style={styles.subRequestNoBtnText}>No thanks</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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

  // ── Header (shared shell) ─────────────────────────────────────────────────
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[10],
    flex: 1,
  },
  bellBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bellBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: navy[800],
  },
  bellBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 10,
  },
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
  avatarOffset: {
    marginTop: 24,
  },

  // ── Hero card ─────────────────────────────────────────────────────────────
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

  // ── Availability bar ──────────────────────────────────────────────────────
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

  // ── Quick actions ─────────────────────────────────────────────────────────
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

  // ── Player toggle ─────────────────────────────────────────────────────────
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

  // ── Empty state ───────────────────────────────────────────────────────────
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

  // ── Loading skeleton ──────────────────────────────────────────────────────
  skeletonLine: {
    backgroundColor: navy[600],
    borderRadius: radius.s,
  },

  // ── Announcements ─────────────────────────────────────────────────────────
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

  // ── Sub request sheet ─────────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.60)',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: navy[500],
    alignSelf: 'center', marginBottom: spacing[20],
  },
  subRequestSheet: {
    backgroundColor: navy[700],
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing[24], paddingTop: spacing[16],
    borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  subRequestTitle: {
    fontFamily: fonts.display, fontSize: 20, fontWeight: '700',
    letterSpacing: -0.3, color: '#FFFFFF',
    textAlign: 'center', marginBottom: spacing[10],
  },
  subRequestBody: {
    fontFamily: fonts.ui, fontSize: 14, lineHeight: 20,
    color: navy[300], textAlign: 'center', marginBottom: spacing[24],
  },
  subRequestYesBtn: {
    height: 52, borderRadius: radius.l, backgroundColor: TEAM[500],
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[10],
    shadowColor: TEAM[500], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  subRequestYesBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600', color: TEAM.on,
  },
  subRequestNoBtn: {
    height: 52, borderRadius: radius.l, borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[8],
  },
  subRequestNoBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600', color: TEAM[300],
  },

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: {
    position: 'absolute', left: spacing[20], right: spacing[20],
    backgroundColor: navy[700], borderRadius: radius.pill,
    borderWidth: 0.5, borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`,
    paddingVertical: spacing[12], paddingHorizontal: spacing[20],
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 10,
  },
  toastText: { fontFamily: fonts.uiSemiBold, fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABEL: Record<string, string> = {
  game: 'Game', practice: 'Practice', social: 'Social',
};

function isEventToday(ts: Timestamp): boolean {
  const d = ts.toDate();
  const n = new Date();
  return d.getFullYear() === n.getFullYear() &&
         d.getMonth()    === n.getMonth()    &&
         d.getDate()     === n.getDate();
}

function formatDay(ts: Timestamp): string {
  const d     = ts.toDate();
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const evDay = new Date(d.getFullYear(),   d.getMonth(),   d.getDate());
  const diff  = Math.round((evDay.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-CA', { weekday: 'long' });
}

function formatRelativeDay(ts: Timestamp): string {
  const d     = ts.toDate();
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const evDay = new Date(d.getFullYear(),   d.getMonth(),   d.getDate());
  const diff  = Math.round((evDay.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Tonight';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

function formatTime(ts: Timestamp): string {
  return ts.toDate().toLocaleTimeString('en-CA', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).toLowerCase();
}

function parseTitleDisplay(event: TeamEvent): { prefix: string; name: string } {
  if (event.type !== 'game') return { prefix: '', name: event.title };
  if (event.title.startsWith('vs '))  return { prefix: 'vs.', name: event.title.slice(3) };
  if (event.title.startsWith('@ '))   return { prefix: '@',   name: event.title.slice(2) };
  return { prefix: '', name: event.title };
}

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
