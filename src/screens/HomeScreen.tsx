// Home tab — switches between B-01 (Manager) and C-01 (Player) based on role.

import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Pressable, Linking, Modal,
  FlatList, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { doc, setDoc, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { navy, teams, status, fonts, radius, spacing } from '../theme';
import AvatarPill from '../components/AvatarPill';
import { useNotifications } from '../context/NotificationContext';
import { sendPushNotification } from '../firebase/sendNotification';
import { useUserContext } from '../context/UserContext';
import { db } from '../firebase';
import { useEvents } from '../firebase/hooks/useEvents';
import { useTeam } from '../firebase/hooks/useTeam';
import { useResponses } from '../firebase/hooks/useResponses';
import { useMembers } from '../firebase/hooks/useMembers';
import { useAnnouncements } from '../firebase/hooks/useAnnouncements';
import type { Event as TeamEvent, Announcement, UserTeam } from '../firebase/schema';
import { useUserTeams } from '../firebase/hooks/useUserTeams';

type Response = 'in' | 'out' | 'maybe' | null;

const TEAM = teams.trashdogs; // StyleSheet fallback — dynamic overrides applied inline in components

interface AvailCounts {
  in: number;
  out: number;
  maybe: number;
  noResp: number;
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  console.log('HOMESCREEN MOUNTED');
  const { isManager } = useUserContext();
  return isManager ? <ManagerHomeScreen /> : <PlayerHomeScreen />;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  B-01 · Manager Home                                                     ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function ManagerHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const { unreadCount } = useNotifications();
  const { user, activeTeamId, activeTeamPalette, setActiveTeamId, setActiveTeamPalette } = useUserContext();
  const { teams: userTeams } = useUserTeams(user?.uid ?? null);
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { team }            = useTeam(activeTeamId);
  const { events, loading } = useEvents(activeTeamId);
  const { members }         = useMembers(activeTeamId);
  const { announcements }   = useAnnouncements(activeTeamId);

  const upcomingEvents = events.filter(
    e => e.startsAt.toDate() > new Date() && e.status !== 'cancelled',
  );
  const hasEvent   = upcomingEvents.length > 0;
  const safeIndex  = Math.min(activeIndex, Math.max(0, upcomingEvents.length - 1));
  const activeEvent = upcomingEvents[safeIndex] ?? null;
  const uid         = user?.uid;

  const { responses } = useResponses(activeTeamId, activeEvent?.id ?? null);

  const avail: AvailCounts = { in: 0, out: 0, maybe: 0, noResp: 0 };
  members.forEach(m => {
    const r = responses[m.userId];
    if (m.role === 'spare' && !r) return;
    if      (r === 'in')    avail.in++;
    else if (r === 'out')   avail.out++;
    else if (r === 'maybe') avail.maybe++;
    else                    avail.noResp++;
  });

  console.log('Home event id:', activeEvent?.id, 'members:', members.length,
    'counts — in:', avail.in, 'out:', avail.out, 'maybe:', avail.maybe, 'noResp:', avail.noResp);

  const managerResponse: Response = (responses[uid ?? ''] as Response) ?? null;

  const handleManagerRespond = async (r: Response, event: TeamEvent) => {
    if (!r || !event || !uid) {
      console.warn('[HomeScreen] cannot write manager response: missing r/event/uid');
      return;
    }
    const responseRef = doc(db, 'teams', activeTeamId, 'events', event.id, 'responses', uid);
    try {
      await setDoc(responseRef, {
        userId: uid,
        displayName: user?.displayName ?? 'Player',
        response: r,
        respondedAt: Timestamp.now(),
        setByManager: true,
      });
    } catch (err) {
      console.error('[HomeScreen] manager response write failed:', err);
    }
  };

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const handleRemind = async () => {
    if (!activeEvent) return;
    const nonResponders = members.filter(m => m.role !== 'spare' && !responses[m.userId]);
    const targets = nonResponders.filter(m => m.pushToken && m.notificationsEnabled !== false);
    console.log('[HomeScreen] reminding', targets.length, 'non-responders for event', activeEvent.id);
    for (const m of targets) {
      sendPushNotification(
        m.pushToken!,
        `Are you in for ${activeEvent.opponent ?? activeEvent.title}?`,
        `${formatRelativeDay(activeEvent.startsAt)} ${formatTime(activeEvent.startsAt)} — Swipe ↓ or hold to reply`,
        { eventId: activeEvent.id, teamId: activeTeamId, userId: m.userId, displayName: m.displayName },
      ).catch(err => console.error('[HomeScreen] remind push failed for', m.userId, err));
    }
    showToast(`Reminded ${targets.length} player${targets.length !== 1 ? 's' : ''}`);
  };

  const goToCreateEvent   = () => navigation.navigate('CreateEvent');
  const goToProfile       = () => navigation.navigate('Profile');
  const goToGameday       = () => navigation.navigate('Gameday');
  const goToTeam          = () => navigation.navigate('Team');
  const goToNotifications = () => navigation.navigate('Notifications');

  const cardWidth = screenWidth - spacing[16] * 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ManagerPageHeader
          teamName={team?.name ?? 'Trash Dogs'}
          hasEvent={hasEvent}
          onAdd={goToCreateEvent}
          onProfile={goToProfile}
          onNotifications={goToNotifications}
          unreadCount={unreadCount}
          onTeamSwitch={userTeams.length > 1 ? () => setSwitcherVisible(true) : undefined}
        />

        {/* Region 1: hero or empty state */}
        <View style={styles.heroWrapper}>
          {loading ? (
            <HeroSkeleton />
          ) : hasEvent ? (
            <>
              <FlatList
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                data={upcomingEvents}
                keyExtractor={e => e.id}
                renderItem={({ item, index }) => (
                  <View style={{ width: cardWidth }}>
                    <ManagerHeroCard
                      event={item}
                      avail={index === safeIndex ? avail : { in: 0, out: 0, maybe: 0, noResp: 0 }}
                      response={index === safeIndex ? managerResponse : null}
                      onRespond={r => handleManagerRespond(r, item)}
                      onGameday={isEventToday(item.startsAt) ? goToGameday : undefined}
                      onPress={() => navigation.navigate('EventDetail', { eventId: item.id, title: item.title })}
                    />
                  </View>
                )}
                onMomentumScrollEnd={ev => {
                  setActiveIndex(Math.round(ev.nativeEvent.contentOffset.x / cardWidth));
                }}
                scrollEventThrottle={16}
              />
              {upcomingEvents.length > 1 && (
                <EventDots count={upcomingEvents.length} activeIndex={safeIndex} />
              )}
            </>
          ) : (
            <ManagerEmptyCard />
          )}
        </View>

        {/* Region 2: quick actions */}
        {!loading && hasEvent && (
          <ManagerQuickActions noRespCount={avail.noResp} onAdd={goToCreateEvent} onRemind={handleRemind} />
        )}

        {/* Region 3: announcements */}
        <AnnouncementsSection
          announcements={announcements}
          onViewAll={goToTeam}
          onNavigateTo={id => navigation.navigate('AnnouncementThread', { announcementId: id })}
        />

        <View style={{ height: spacing[24] }} />
      </ScrollView>
      <TeamSwitcherSheet
        visible={switcherVisible}
        userTeams={userTeams}
        activeTeamId={activeTeamId}
        onSelect={(id, palette) => {
          setActiveTeamId(id);
          setActiveTeamPalette(palette);
          setSwitcherVisible(false);
        }}
        onClose={() => setSwitcherVisible(false)}
      />
      {toast !== null && (
        <View style={[styles.toast, { bottom: Math.max(insets.bottom, spacing[12]) + spacing[16] }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Manager header ───────────────────────────────────────────────────────────

function ManagerPageHeader({
  teamName, hasEvent, onAdd, onProfile, onNotifications, unreadCount, onTeamSwitch,
}: {
  teamName: string;
  hasEvent: boolean;
  onAdd: () => void;
  onProfile: () => void;
  onNotifications: () => void;
  unreadCount: number;
  onTeamSwitch?: () => void;
}) {
  const { activeTeamPalette } = useUserContext();
  const activeTeam = teams[activeTeamPalette];
  const pillContent = (
    <>
      <View style={[styles.teamDot, { backgroundColor: activeTeam[300] }]} />
      <Text style={[styles.teamPillText, { color: activeTeam[300] }]}>{teamName}</Text>
      <Text style={[styles.teamPillChevron, { color: activeTeam[300] }]}>›</Text>
    </>
  );
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <BellButton onPress={onNotifications} unreadCount={unreadCount} />
        <View>
          {onTeamSwitch ? (
            <Pressable
              style={({ pressed }) => [styles.teamPill, pressed && { opacity: 0.7 }]}
              onPress={onTeamSwitch}
            >
              {pillContent}
            </Pressable>
          ) : (
            <View style={styles.teamPill}>{pillContent}</View>
          )}
          <Text style={styles.pageTitle}>
            {hasEvent ? 'Next up' : 'No games yet'}
          </Text>
        </View>
      </View>

      <View style={styles.headerButtons}>
        <Pressable
          style={[styles.addEventBtn, { backgroundColor: activeTeam[500], shadowColor: activeTeam[500] }]}
          onPress={onAdd}
          android_ripple={{ color: 'rgba(255,255,255,0.15)', borderless: true }}
        >
          <Text style={[styles.addEventBtnText, { color: activeTeam.on }]}>+</Text>
        </Pressable>
        <AvatarPill onPress={onProfile} />
      </View>
    </View>
  );
}

// ─── Manager hero card ────────────────────────────────────────────────────────

function ManagerHeroCard({ event, avail, response, onRespond, onGameday, onPress }: {
  event: TeamEvent;
  avail: AvailCounts;
  response: Response;
  onRespond: (r: Response) => void;
  onGameday?: () => void;
  onPress: () => void;
}) {
  const { prefix, name } = parseTitleDisplay(event);
  const responded = avail.in + avail.out + avail.maybe;
  const total     = responded + avail.noResp;

  return (
    <Pressable onPress={onPress}>
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

      {/* Manager's own availability toggle */}
      <View style={[styles.dividerRow, { marginTop: spacing[12] }]}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>Your status</Text>
        <View style={styles.dividerLine} />
      </View>
      <InOutMaybeToggle response={response} onRespond={onRespond} />

      {/* Gameday shortcut */}
      {onGameday && (
        <Pressable style={styles.gamedayLink} onPress={onGameday}>
          <Text style={styles.gamedayLinkText}>Who's here →</Text>
        </Pressable>
      )}
    </View>
    </Pressable>
  );
}

// ─── Availability bar ─────────────────────────────────────────────────────────

function AvailabilityBar({ avail }: { avail: AvailCounts }) {
  const { activeTeamPalette } = useUserContext();
  const activeTeam = teams[activeTeamPalette];
  const chips: { key: keyof AvailCounts; label: string; dot: string; bg: string; border: string; text: string }[] = [
    {
      key: 'in',
      label: 'In',
      dot: activeTeam[300],
      bg: `rgba(${hexToRgbVals(activeTeam[500])}, 0.16)`,
      border: `rgba(${hexToRgbVals(activeTeam[500])}, 0.38)`,
      text: activeTeam[300],
    },
    { key: 'out',    label: 'Out',      dot: status.error.pure, bg: status.error.subtle,  border: 'rgba(239,68,68,0.38)',   text: status.error.light },
    { key: 'maybe',  label: 'Maybe',    dot: status.alert.pure, bg: status.alert.subtle,  border: 'rgba(245,158,11,0.38)',  text: status.alert.light },
    { key: 'noResp', label: 'No resp.', dot: navy[400],          bg: 'rgba(95,107,133,0.14)', border: 'rgba(95,107,133,0.28)', text: navy[300] },
  ];
  return (
    <View style={styles.availRow}>
      {chips.map((chip) => (
        <View
          key={chip.key}
          style={[styles.availChip, { backgroundColor: chip.bg, borderColor: chip.border }]}
        >
          <View style={[styles.availDot, { backgroundColor: chip.dot }]} />
          <Text style={[styles.availLabel, { color: chip.text }]}>{chip.label}</Text>
          <Text style={[styles.availCount, { color: chip.text }]}>{avail[chip.key]}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Manager quick actions ────────────────────────────────────────────────────

function ManagerQuickActions({ noRespCount, onAdd, onRemind }: { noRespCount: number; onAdd: () => void; onRemind: () => void }) {
  const { activeTeamPalette } = useUserContext();
  const activeTeam = teams[activeTeamPalette];
  return (
    <View style={styles.quickActions}>
      {noRespCount > 0 && (
        <Pressable
          style={[styles.remindBtn, {
            borderColor: `rgba(${hexToRgbVals(activeTeam[500])}, 0.45)`,
            backgroundColor: `rgba(${hexToRgbVals(activeTeam[500])}, 0.08)`,
          }]}
          android_ripple={{ color: `rgba(${hexToRgbVals(activeTeam[500])}, 0.15)` }}
          onPress={onRemind}
        >
          <Text style={[styles.remindBtnText, { color: activeTeam[300] }]}>
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
  const { width: screenWidth } = useWindowDimensions();
  const { unreadCount } = useNotifications();
  const { user, activeTeamId, activeTeamPalette, setActiveTeamId, setActiveTeamPalette } = useUserContext();
  const { teams: userTeams } = useUserTeams(user?.uid ?? null);
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const { team }            = useTeam(activeTeamId);
  const { events, loading } = useEvents(activeTeamId);
  const { announcements }   = useAnnouncements(activeTeamId);

  const upcomingEvents = events.filter(
    e => e.startsAt.toDate() > new Date() && e.status !== 'cancelled',
  );
  const hasEvent   = upcomingEvents.length > 0;
  const safeIndex  = Math.min(activeIndex, Math.max(0, upcomingEvents.length - 1));
  const activeEvent = upcomingEvents[safeIndex] ?? null;

  const uid = user?.uid;
  const { responses: firestoreResponses } = useResponses(activeTeamId, activeEvent?.id ?? null);
  const response: Response = (firestoreResponses[uid ?? ''] as Response) ?? null;
  const inCount  = Object.values(firestoreResponses).filter(r => r === 'in').length;
  const outCount = Object.values(firestoreResponses).filter(r => r === 'out').length;

  console.log('Home event id:', activeEvent?.id, 'counts:', inCount, outCount);

  const [subSheetVisible, setSubSheetVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  const handleRespond = async (r: Response, event: TeamEvent) => {
    console.log('TOGGLE TAPPED', r, '— event:', event?.id ?? 'null');
    if (!r || !event) {
      console.warn('[HomeScreen] handleRespond bailed — r:', r, 'event:', event?.id ?? 'null');
      return;
    }
    if (!uid) {
      console.warn('[HomeScreen] cannot write response: user.uid is undefined');
      return;
    }
    if (r === 'out' || r === 'maybe') setSubSheetVisible(true);
    const responseRef = doc(db, 'teams', activeTeamId, 'events', event.id, 'responses', uid);
    console.log('[HomeScreen] writing response', r, 'to', responseRef.path);
    try {
      await setDoc(responseRef, {
        userId:       uid,
        displayName:  user?.displayName ?? 'Player',
        response:     r,
        respondedAt:  Timestamp.now(),
        setByManager: false,
      });
      console.log('[HomeScreen] response write succeeded');
    } catch (err) {
      console.error('[HomeScreen] response write failed:', err);
    }
  };

  const WEEKDAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const MONTH_ABBR   = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const handleSubRequest = async () => {
    if (!activeEvent || !uid) {
      console.warn('[HomeScreen] handleSubRequest: missing activeEvent or uid');
      return;
    }
    setSubSheetVisible(false);
    showToast('Request sent to manager');
    const d = activeEvent.startsAt.toDate();
    const h = d.getHours();
    const m = d.getMinutes();
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h >= 12 ? 'PM' : 'AM';
    try {
      await addDoc(collection(db, 'teams', activeTeamId, 'subRequests'), {
        eventId:         activeEvent.id,
        requestedBy:     uid,
        requestedByName: user?.displayName ?? 'Player',
        reason:          null,
        status:          'pending',
        createdAt:       serverTimestamp(),
        opponent:        activeEvent.opponent ?? activeEvent.title,
        gameWeekday:     WEEKDAY_ABBR[d.getDay()],
        gameDay:         String(d.getDate()).padStart(2, '0'),
        gameMonth:       MONTH_ABBR[d.getMonth()],
        gameVenue:       activeEvent.venue,
        gameTime:        `${h12}:${String(m).padStart(2, '0')} ${ampm}`,
      });
    } catch (err) {
      console.error('[HomeScreen] sub request write failed:', err);
    }
  };

  const goToProfile       = () => navigation.navigate('Profile');
  const goToGameday       = () => navigation.navigate('Gameday');
  const goToTeam          = () => navigation.navigate('Team');
  const goToNotifications = () => navigation.navigate('Notifications');

  const cardWidth = screenWidth - spacing[16] * 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <PlayerPageHeader
          teamName={team?.name ?? 'Trash Dogs'}
          hasEvent={hasEvent}
          onProfile={goToProfile}
          onNotifications={goToNotifications}
          unreadCount={unreadCount}
          onTeamSwitch={userTeams.length > 1 ? () => setSwitcherVisible(true) : undefined}
        />

        <View style={styles.heroWrapper}>
          {loading ? (
            <HeroSkeleton />
          ) : hasEvent ? (
            <>
              <FlatList
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                data={upcomingEvents}
                keyExtractor={e => e.id}
                renderItem={({ item, index }) => (
                  <View style={{ width: cardWidth }}>
                    <PlayerHeroCard
                      event={item}
                      response={index === safeIndex ? response : null}
                      inCount={index === safeIndex ? inCount : 0}
                      onRespond={r => handleRespond(r, item)}
                      onGameday={isEventToday(item.startsAt) ? goToGameday : undefined}
                      onPress={() => navigation.navigate('EventDetail', { eventId: item.id, title: item.title })}
                    />
                  </View>
                )}
                onMomentumScrollEnd={ev => {
                  setActiveIndex(Math.round(ev.nativeEvent.contentOffset.x / cardWidth));
                }}
                scrollEventThrottle={16}
              />
              {upcomingEvents.length > 1 && (
                <EventDots count={upcomingEvents.length} activeIndex={safeIndex} />
              )}
            </>
          ) : (
            <PlayerEmptyCard />
          )}
        </View>

        <AnnouncementsSection
          announcements={announcements}
          onViewAll={goToTeam}
          onNavigateTo={id => navigation.navigate('AnnouncementThread', { announcementId: id })}
        />

        <View style={{ height: spacing[24] }} />
      </ScrollView>

      <TeamSwitcherSheet
        visible={switcherVisible}
        userTeams={userTeams}
        activeTeamId={activeTeamId}
        onSelect={(id, palette) => {
          setActiveTeamId(id);
          setActiveTeamPalette(palette);
          setSwitcherVisible(false);
        }}
        onClose={() => setSwitcherVisible(false)}
      />
      <SubRequestSheet
        visible={subSheetVisible}
        gameName={activeEvent?.title ?? ''}
        onYes={handleSubRequest}
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
  teamName, hasEvent, onProfile, onNotifications, unreadCount, onTeamSwitch,
}: {
  teamName: string;
  hasEvent: boolean;
  onProfile: () => void;
  onNotifications: () => void;
  unreadCount: number;
  onTeamSwitch?: () => void;
}) {
  const { activeTeamPalette } = useUserContext();
  const activeTeam = teams[activeTeamPalette];
  const pillContent = (
    <>
      <View style={[styles.teamDot, { backgroundColor: activeTeam[300] }]} />
      <Text style={[styles.teamPillText, { color: activeTeam[300] }]}>{teamName}</Text>
      <Text style={[styles.teamPillChevron, { color: activeTeam[300] }]}>›</Text>
    </>
  );
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <BellButton onPress={onNotifications} unreadCount={unreadCount} />
        <View>
          {onTeamSwitch ? (
            <Pressable
              style={({ pressed }) => [styles.teamPill, pressed && { opacity: 0.7 }]}
              onPress={onTeamSwitch}
            >
              {pillContent}
            </Pressable>
          ) : (
            <View style={styles.teamPill}>{pillContent}</View>
          )}
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

function PlayerHeroCard({ event, response, inCount, onRespond, onGameday, onPress }: {
  event: TeamEvent;
  response: Response;
  inCount: number;
  onRespond: (r: Response) => void;
  onGameday?: () => void;
  onPress: () => void;
}) {
  const { prefix, name } = parseTitleDisplay(event);
  return (
    <Pressable onPress={onPress}>
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
          <Text style={styles.inCountText}>{inCount} in</Text>
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
    </Pressable>
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

// ─── Event page dots ──────────────────────────────────────────────────────────

function EventDots({ count, activeIndex }: { count: number; activeIndex: number }) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  return (
    <View style={styles.dotRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === activeIndex
              ? { width: 16, backgroundColor: TEAM[300] }
              : { width: 6,  backgroundColor: navy[500] },
          ]}
        />
      ))}
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

function InOutMaybeToggle({ response, onRespond }: {
  response: Response;
  onRespond: (r: Response) => void;
}) {
  const { activeTeamPalette } = useUserContext();
  const activeTeam = teams[activeTeamPalette];
  const RESPONSE_TINTS: Record<NonNullable<Response>, string> = {
    in: activeTeam[500], out: status.error.pure, maybe: status.alert.pure,
  };
  const RESPONSE_ON: Record<NonNullable<Response>, string> = {
    in: activeTeam.on, out: '#FFFFFF', maybe: '#0B1220',
  };
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
            onPress={() => { console.log('TOGGLE TAPPED', opt.id); onRespond(opt.id); }}
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

function AnnouncementsSection({
  announcements,
  onViewAll,
  onNavigateTo,
}: {
  announcements: Announcement[];
  onViewAll: () => void;
  onNavigateTo: (id: string) => void;
}) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const latest = announcements.slice(0, 2);

  return (
    <View style={styles.announcements}>
      <View style={styles.announcementsHeader}>
        <Text style={styles.announcementsLabel}>From your manager</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={[styles.announcementsAll, { color: TEAM[300] }]}>All →</Text>
        </TouchableOpacity>
      </View>
      {latest.length === 0 && (
        <View style={[styles.announcementCard, { justifyContent: 'center' }]}>
          <Text style={[styles.announcementMeta, { textAlign: 'center', paddingVertical: 4 }]}>
            No announcements yet
          </Text>
        </View>
      )}
      {latest.map(ann => (
        <TouchableOpacity
          key={ann.id}
          style={[styles.announcementCard, latest.indexOf(ann) > 0 && { marginTop: 8 }]}
          activeOpacity={0.75}
          onPress={() => onNavigateTo(ann.id)}
        >
          <View style={[styles.announcementIcon, {
            backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.22)`,
            borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`,
          }]}>
            <Text>📣</Text>
          </View>
          <View style={styles.announcementBody}>
            <Text style={styles.announcementTitle} numberOfLines={1}>
              {ann.body}
            </Text>
            <Text style={styles.announcementMeta}>
              {formatAnnAuthor(ann.authorName)} · {formatAnnTime(ann.createdAt)}
            </Text>
          </View>
          <Text style={styles.announcementChevron}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Team switcher sheet ──────────────────────────────────────────────────────

function TeamSwitcherSheet({
  visible, userTeams, activeTeamId, onSelect, onClose,
}: {
  visible: boolean;
  userTeams: UserTeam[];
  activeTeamId: string;
  onSelect: (teamId: string, palette: UserTeam['palette']) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[styles.subRequestSheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.switcherTitle}>Switch Team</Text>
          {userTeams.map(t => {
            const isActive = t.teamId === activeTeamId;
            const dotColor = teams[t.palette][300];
            return (
              <Pressable
                key={t.teamId}
                style={({ pressed }) => [styles.switcherRow, pressed && { backgroundColor: navy[600] }]}
                onPress={() => onSelect(t.teamId, t.palette)}
              >
                <View style={[styles.switcherDot, { backgroundColor: dotColor }]} />
                <Text style={styles.switcherTeamName}>{t.teamName}</Text>
                {isActive && <Text style={[styles.switcherCheck, { color: dotColor }]}>✓</Text>}
              </Pressable>
            );
          })}
          <Pressable
            style={({ pressed }) => [styles.switcherCancel, pressed && { opacity: 0.7 }]}
            onPress={onClose}
          >
            <Text style={styles.switcherCancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
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
            style={({ pressed }) => [styles.subRequestYesBtn, {
              backgroundColor: TEAM[500],
              shadowColor: TEAM[500],
            }, pressed && { opacity: 0.85 }]}
            onPress={onYes}
          >
            <Text style={[styles.subRequestYesBtnText, { color: TEAM.on }]}>Yes, request a sub</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.subRequestNoBtn, {
              borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`,
              backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
            }, pressed && { opacity: 0.75 }]}
            onPress={onDismiss}
          >
            <Text style={[styles.subRequestNoBtnText, { color: TEAM[300] }]}>No thanks</Text>
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

  // ── Event pagination dots ─────────────────────────────────────────────────
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[6],
    paddingTop: spacing[10],
    paddingBottom: spacing[4],
  },
  dot: {
    height: 6,
    borderRadius: 3,
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

  // ── Team switcher ─────────────────────────────────────────────────────────
  switcherTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing[16],
  },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[4],
    borderRadius: radius.s,
    gap: spacing[12],
  },
  switcherDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  switcherTeamName: {
    flex: 1,
    fontFamily: fonts.uiMedium,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  switcherCheck: {
    fontFamily: fonts.uiBold,
    fontSize: 16,
    fontWeight: '700',
  },
  switcherCancel: {
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: radius.s,
    alignItems: 'center',
  },
  switcherCancelText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    fontWeight: '600',
    color: navy[300],
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

function formatAnnAuthor(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function formatAnnTime(ts: { toDate(): Date } | undefined): string {
  if (!ts) return 'Just now';
  const diffMs    = Date.now() - ts.toDate().getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays  = Math.floor(diffMs / 86_400_000);
  if (diffHours < 1)  return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
