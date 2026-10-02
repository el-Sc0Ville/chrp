// B-03 / C-03 · Event Detail
// Flip IS_MANAGER to preview each role's view.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, TouchableOpacity, Modal,
  TextInput, KeyboardAvoidingView, Platform, Linking, Alert, StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { navy, teams, status, fonts, type as T, spacing, radius } from '../theme';
import { doc, setDoc, updateDoc, addDoc, getDocs, onSnapshot, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import * as haptics from '../lib/haptics';
import { sendPushNotification } from '../firebase/sendNotification';
import { replyHint } from '../firebase/notifications';
import type { AvailabilityResponse, Member } from '../firebase/schema';
import { useUserContext } from '../context/UserContext';
import { scoreResult, type Score } from '../context/ScoreContext';
import ErrorState from '../components/ErrorState';
import { useEvents } from '../firebase/hooks/useEvents';
import { useMembers } from '../firebase/hooks/useMembers';
import { useResponses } from '../firebase/hooks/useResponses';
import { useTeam } from '../firebase/hooks/useTeam';
import type { Event as FirestoreEvent } from '../firebase/schema';

const TEAM = teams.trashdogs; // StyleSheet fallback — dynamic overrides applied inline in components

// Per-event acknowledgement of the "updated after you responded" banner. The
// stored value is the acknowledged event.updatedAt in millis, not a flag: a
// later edit produces a different stamp, so the banner comes back on its own
// while one key per event is all that ever accumulates.
const UPDATE_ACK_PREFIX = 'chrp_event_update_ack_';

type EventDetailRouteProp = RouteProp<RootStackParamList, 'EventDetail'>;
type EventDetailNavProp   = NativeStackNavigationProp<RootStackParamList, 'EventDetail'>;
type PlayerResponse       = 'in' | 'out' | 'maybe' | null;
type GroupKey             = 'in' | 'out' | 'maybe' | 'noResp';

interface Player {
  id: string;
  name: string;
  jersey: number;
  respondedAt?: string;
}

// ─── Calendar helper ──────────────────────────────────────────────────────────

function formatGCalDate(d: Date): string {
  // YYYYMMDDTHHmmssZ format required by Google Calendar URL API
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function buildCalendarUrl(firestoreEvent: FirestoreEvent): string {
  const startDate = firestoreEvent.startsAt.toDate();
  const endDate   = firestoreEvent.endsAt.toDate();
  return [
    'https://calendar.google.com/calendar/render?action=TEMPLATE',
    `&text=${encodeURIComponent(firestoreEvent.title)}`,
    `&dates=${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`,
    `&location=${encodeURIComponent(firestoreEvent.venue ?? '')}`,
    `&details=${encodeURIComponent(firestoreEvent.notes ?? '')}`,
  ].join('');
}

function addEventToCalendar(firestoreEvent: FirestoreEvent): void {
  // TODO Phase 2b: use expo-calendar in custom dev build for native calendar integration
  Linking.openURL(buildCalendarUrl(firestoreEvent));
}

function updateEventInCalendar(firestoreEvent: FirestoreEvent): void {
  Alert.alert(
    'Update calendar entry',
    'This will add an updated entry to your calendar. You may want to remove the old one.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', onPress: () => Linking.openURL(buildCalendarUrl(firestoreEvent)) },
    ],
  );
}

// ─── Toggle config ────────────────────────────────────────────────────────────

const TOGGLE_OPTS: { id: NonNullable<PlayerResponse>; label: string; glyph: string }[] = [
  { id: 'in',    label: "I'm in", glyph: '✓' },
  { id: 'out',   label: 'Out',    glyph: '✕' },
  { id: 'maybe', label: 'Maybe',  glyph: '?' },
];

// ─── Root export ──────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { isManager } = useUserContext();
  return isManager ? <ManagerEventDetail /> : <PlayerEventDetail />;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  B-03 · Manager Event Detail                                             ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function ManagerEventDetail() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<EventDetailNavProp>();
  const route = useRoute<EventDetailRouteProp>();
  const { title: fallbackTitle, eventId, isPast = false } = route.params;
  const { user, activeTeamId, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const [scoreSheetVisible,  setScoreSheetVisible]  = useState(false);
  const [cancelSheetVisible, setCancelSheetVisible] = useState(false);
  const [cancelling,         setCancelling]         = useState(false);
  // Same reason as savingRef in CreateEventScreen: `cancelling` is read from the
  // render closure and setCancelling is async, so two taps in one render both
  // pass the check and fire the cancel — and its pinned announcement — twice.
  const cancellingRef = useRef(false);

  const handleSaveScore = async (s: Score) => {
    try {
      await updateDoc(doc(db, 'teams', activeTeamId, 'events', eventId), {
        scoreUs: s.us, scoreThem: s.them,
      });
    } catch (err) {
      console.error('[EventDetail] score write failed:', err);
    }
  };

  const handleEdit = () => {
    navigation.navigate('CreateEvent', { editEventId: eventId });
  };

  const handleCancelEvent = async (reason: string) => {
    if (cancellingRef.current) return;
    cancellingRef.current = true;
    setCancelling(true);
    const reasonValue = reason.trim();
    try {
      await updateDoc(doc(db, 'teams', activeTeamId, 'events', eventId), {
        status: 'cancelled',
        // Omitted when blank rather than written as '' — nothing downstream
        // should have to tell "no reason given" from "empty reason given".
        ...(reasonValue ? { cancelReason: reasonValue } : {}),
      });
      if (event) {
        const cancelBody = `🚫 ${event.title} on ${formatEventDate(event.startsAt)} has been cancelled.`
          + (reasonValue ? ` Reason: ${reasonValue}` : '');
        await addDoc(collection(db, 'teams', activeTeamId, 'announcements'), {
          body:       cancelBody,
          authorId:   user?.uid ?? 'manager',
          authorName: user?.displayName ?? 'Manager',
          pinned:     true,
          createdAt:  serverTimestamp(),
        });
        // TODO Phase 2b: move to Firebase Cloud Function for reliability
        const membersSnap = await getDocs(collection(db, 'teams', activeTeamId, 'members'));
        for (const memberDoc of membersSnap.docs) {
          const m = memberDoc.data() as Member;
          if (m.pushToken) {
            sendPushNotification(
              m.pushToken,
              'Event cancelled',
              cancelBody,
            ).catch(console.error);
          }
        }
      }
      haptics.warning();
      setCancelSheetVisible(false);
      navigation.goBack();
    } catch (err) {
      console.error('[EventDetail] cancel event failed:', err);
      haptics.error();
      Alert.alert("Couldn't cancel this game", 'Something went wrong. Please try again.');
      // Only released on failure — on success the screen is already gone and
      // the latch keeps a queued second tap from firing into the unmount.
      cancellingRef.current = false;
      setCancelling(false);
    }
  };

  const { events, loading: eventsLoading, error: eventsError, retry: retryEvents } = useEvents(activeTeamId);
  const { members, error: membersError, retry: retryMembers } = useMembers(activeTeamId);
  const { responses, error: responsesError, retry: retryResponses } = useResponses(activeTeamId, eventId);
  const event = events.find(e => e.id === eventId) ?? null;
  const loadError = eventsError ?? membersError ?? responsesError;
  const retryAll  = () => { retryEvents(); retryMembers(); retryResponses(); };

  const handleRemind = () => {
    const targets = members.filter(
      m => m.role !== 'spare' && !responses[m.userId] && m.pushToken && m.notificationsEnabled !== false,
    );
    for (const m of targets) {
      sendPushNotification(
        m.pushToken!,
        `Are you in for ${event?.opponent ?? event?.title ?? 'next game'}?`,
        `${event ? formatEventDate(event.startsAt) : ''} — ${replyHint(m.pushPlatform)}`,
        { eventId, teamId: activeTeamId, userId: m.userId, displayName: m.displayName, categoryId: 'AVAILABILITY_REQUEST' },
      ).catch(err => console.error('[EventDetail] remind push failed for', m.userId, err));
    }
  };

  const [groups, setGroups] = useState<Record<GroupKey, Player[]>>({
    in: [], out: [], maybe: [], noResp: [],
  });
  const [editTarget, setEditTarget] = useState<{ player: Player; fromGroup: GroupKey } | null>(null);

  useEffect(() => {
    if (members.length === 0) return;
    const g: Record<GroupKey, Player[]> = { in: [], out: [], maybe: [], noResp: [] };
    members.forEach(m => {
      const r = responses[m.userId];
      if (m.role === 'spare' && !r) return;
      const p: Player = { id: m.userId, name: m.displayName, jersey: m.jerseyNumber };
      if      (r === 'in')    g.in.push(p);
      else if (r === 'out')   g.out.push(p);
      else if (r === 'maybe') g.maybe.push(p);
      else                    g.noResp.push(p);
    });
    setGroups(g);
  }, [members, responses]);

  const markAs = async (toGroup: 'in' | 'out' | 'maybe') => {
    if (!editTarget) return;
    const { player, fromGroup } = editTarget;
    setGroups(prev => {
      const from = prev[fromGroup].filter(p => p.id !== player.id);
      const to   = [...prev[toGroup], { ...player, respondedAt: 'just now' }];
      return { ...prev, [fromGroup]: from, [toGroup]: to };
    });
    setEditTarget(null);
    try {
      await setDoc(doc(db, 'teams', activeTeamId, 'events', eventId, 'responses', player.id), {
        userId:      player.id,
        displayName: player.name,
        response:    toGroup,
        respondedAt: Timestamp.now(),
        setByManager: true,
      });
    } catch (err) { console.error('[EventDetail] override write failed:', err); }
  };

  if (!eventsLoading && loadError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <NavHeader onBack={() => navigation.goBack()} onEdit={handleEdit} />
        <ErrorState message="Couldn't load this event." onRetry={retryAll} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <NavHeader onBack={() => navigation.goBack()} onEdit={handleEdit} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[48] }}
      >
        <EventSummary event={event} fallbackTitle={fallbackTitle} />

        {isPast && (
          <View style={styles.scoreActionRow}>
            <Pressable
              style={({ pressed }) => [styles.enterScoreBtn, { borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.50)`, backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)` }, pressed && { opacity: 0.8 }]}
              onPress={() => setScoreSheetVisible(true)}
            >
              <Text style={[styles.enterScoreBtnText, { color: TEAM[300] }]}>
                {event?.scoreUs !== undefined ? 'Edit score' : '+ Enter score'}
              </Text>
            </Pressable>
          </View>
        )}
        {!isPast && (
          <View style={[styles.scoreActionRow, { flexDirection: 'row', gap: spacing[8] }]}>
            <Pressable
              style={({ pressed }) => [styles.ghostBtn, { flex: 1, borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`, backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)` }, pressed && { opacity: 0.75 }]}
              onPress={() => event && addEventToCalendar(event)}
            >
              <Text style={[styles.ghostBtnText, { color: TEAM[300] }]}>Add to calendar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.ghostBtn, { flex: 1, borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`, backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)` }, pressed && { opacity: 0.75 }]}
              onPress={() => event && updateEventInCalendar(event)}
            >
              <Text style={[styles.ghostBtnText, { color: TEAM[300] }]}>Update calendar</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Availability</Text>
          <AvailGroup
            label="In" dotColor={status.success.pure}
            players={groups.in}
            onEditPlayer={(p) => setEditTarget({ player: p, fromGroup: 'in' })}
          />
          <AvailGroup
            label="Out" dotColor={status.error.pure}
            players={groups.out}
            onEditPlayer={(p) => setEditTarget({ player: p, fromGroup: 'out' })}
          />
          <AvailGroup
            label="Maybe" dotColor={status.alert.pure}
            players={groups.maybe}
            onEditPlayer={(p) => setEditTarget({ player: p, fromGroup: 'maybe' })}
          />
          <AvailGroup
            label="No response" dotColor={navy[400]}
            players={groups.noResp}
            showRemind={!isPast}
            onEditPlayer={(p) => setEditTarget({ player: p, fromGroup: 'noResp' })}
            onRemind={handleRemind}
          />
        </View>

        {!isPast && (
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.75 }]}
              onPress={() => setCancelSheetVisible(true)}
            >
              <Text style={styles.cancelBtnText}>Cancel event</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <ScoreSheet
        visible={scoreSheetVisible}
        initial={event?.scoreUs !== undefined && event?.scoreThem !== undefined ? { us: event.scoreUs, them: event.scoreThem } : undefined}
        onSave={handleSaveScore}
        onClose={() => setScoreSheetVisible(false)}
      />
      <AvailEditSheet
        visible={editTarget !== null}
        player={editTarget?.player ?? null}
        onMark={markAs}
        onClose={() => setEditTarget(null)}
      />
      <CancelEventSheet
        visible={cancelSheetVisible}
        event={event}
        fallbackTitle={fallbackTitle}
        respondedCount={Object.keys(responses).length}
        cancelling={cancelling}
        onConfirm={handleCancelEvent}
        onClose={() => { if (!cancellingRef.current) setCancelSheetVisible(false); }}
      />
    </View>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  C-03 · Player Event Detail                                              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const WEEKDAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_ABBR   = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function PlayerEventDetail() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<EventDetailNavProp>();
  const route = useRoute<EventDetailRouteProp>();
  const { title: fallbackTitle, eventId, isPast = false } = route.params;
  const { user, activeTeamId, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];

  const { events, loading: eventsLoading, error: eventsError, retry: retryEvents } = useEvents(activeTeamId);
  const { members, error: membersError, retry: retryMembers } = useMembers(activeTeamId);
  const { responses: firestoreResponses, error: responsesError, retry: retryResponses } = useResponses(activeTeamId, eventId);
  const event = events.find(e => e.id === eventId) ?? null;
  const loadError = eventsError ?? membersError ?? responsesError;
  const retryAll  = () => { retryEvents(); retryMembers(); retryResponses(); };

  const uid      = user?.uid ?? 'anon';
  const response: PlayerResponse = (firestoreResponses[uid] as PlayerResponse) ?? null;

  // ── "Updated after you responded" banner ──────────────────────────────────
  // useResponses only carries the response value, so this player's own doc is
  // read directly for its respondedAt stamp. respondedAt can be null on a
  // freshly written doc: the auto-in batch uses serverTimestamp(), which the
  // local snapshot reports as null until the server round-trip lands.
  const [respondedAt, setRespondedAt] = useState<Timestamp | null>(null);

  useEffect(() => {
    if (!activeTeamId || uid === 'anon') { setRespondedAt(null); return; }
    return onSnapshot(
      doc(db, 'teams', activeTeamId, 'events', eventId, 'responses', uid),
      snap => {
        const data = snap.data() as AvailabilityResponse | undefined;
        setRespondedAt(data?.respondedAt ?? null);
      },
      err => console.error('[EventDetail] respondedAt listen failed:', err),
    );
  }, [activeTeamId, eventId, uid]);

  // Both stamps are optional, so the banner stays hidden unless both exist:
  // no response means there is nothing to review against, and no updatedAt
  // means the event has never been edited.
  const updatedAtMs   = event?.updatedAt?.toMillis() ?? null;
  const respondedAtMs = respondedAt?.toMillis() ?? null;
  const wasUpdatedAfterResponse =
    updatedAtMs !== null && respondedAtMs !== null && updatedAtMs > respondedAtMs;

  const [ackedUpdateAt, setAckedUpdateAt] = useState<string | null>(null);
  const [ackLoaded,     setAckLoaded]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(`${UPDATE_ACK_PREFIX}${eventId}`)
      .then(v => { if (!cancelled) setAckedUpdateAt(v); })
      .catch(err => console.warn('[EventDetail] update ack read failed:', err))
      // Held back until the read settles so a dismissed banner never flashes
      // back in on every visit.
      .finally(() => { if (!cancelled) setAckLoaded(true); });
    return () => { cancelled = true; };
  }, [eventId]);

  const showUpdateBanner =
    ackLoaded && wasUpdatedAfterResponse && ackedUpdateAt !== String(updatedAtMs);

  const dismissUpdateBanner = () => {
    if (updatedAtMs === null) return;
    const stamp = String(updatedAtMs);
    setAckedUpdateAt(stamp);
    AsyncStorage.setItem(`${UPDATE_ACK_PREFIX}${eventId}`, stamp)
      .catch(err => console.warn('[EventDetail] update ack write failed:', err));
  };

  const availGroups = useMemo(() => {
    const g: Record<'in' | 'out' | 'maybe', Player[]> = { in: [], out: [], maybe: [] };
    members.forEach(m => {
      const r = firestoreResponses[m.userId];
      if (r === 'in' || r === 'out' || r === 'maybe') {
        g[r].push({ id: m.userId, name: m.displayName, jersey: m.jerseyNumber });
      }
    });
    return g;
  }, [members, firestoreResponses]);

  const [subSheetVisible, setSubSheetVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  const handleSubRequest = async () => {
    if (!event || !uid || uid === 'anon') return;
    setSubSheetVisible(false);
    haptics.success();
    showToast('Request sent to manager');
    const d = event.startsAt.toDate();
    const h = d.getHours();
    const m = d.getMinutes();
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h >= 12 ? 'PM' : 'AM';
    try {
      await addDoc(collection(db, 'teams', activeTeamId, 'subRequests'), {
        eventId:         event.id,
        requestedBy:     uid,
        requestedByName: user?.displayName ?? 'Player',
        reason:          null,
        status:          'pending',
        createdAt:       serverTimestamp(),
        opponent:        event.opponent ?? event.title,
        gameWeekday:     WEEKDAY_ABBR[d.getDay()],
        gameDay:         String(d.getDate()).padStart(2, '0'),
        gameMonth:       MONTH_ABBR[d.getMonth()],
        gameVenue:       event.venue,
        gameTime:        `${h12}:${String(m).padStart(2, '0')} ${ampm}`,
      });
    } catch (err) {
      console.error('[EventDetail] sub request write failed:', err);
    }
  };

  const handleRespond = async (r: NonNullable<PlayerResponse>) => {
    if (!event) return;
    if (r === 'out' || r === 'maybe') setSubSheetVisible(true);
    const responseRef = doc(db, 'teams', activeTeamId, 'events', event.id, 'responses', uid);
    try {
      await setDoc(responseRef, {
        userId:       uid,
        displayName:  user?.displayName ?? 'Player',
        response:     r,
        respondedAt:  Timestamp.now(),
        setByManager: false,
      });
    } catch (err) {
      console.error('[EventDetail] response write failed:', err);
    }
  };

  if (!eventsLoading && loadError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <NavHeader onBack={() => navigation.goBack()} />
        <ErrorState message="Couldn't load this event." onRetry={retryAll} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <NavHeader onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[48] }}
      >
        {showUpdateBanner && <EventUpdatedBanner onDismiss={dismissUpdateBanner} />}

        <EventSummary event={event} fallbackTitle={fallbackTitle} />

        {!isPast && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Are you in?</Text>
            <InOutMaybeToggle response={response} onRespond={handleRespond} />
          </View>
        )}
        {!isPast && <View style={styles.sectionDivider} />}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Availability</Text>
          <AvailGroup label="In"    dotColor={status.success.pure} players={availGroups.in} />
          <AvailGroup label="Out"   dotColor={status.error.pure}   players={availGroups.out} />
          <AvailGroup label="Maybe" dotColor={status.alert.pure}   players={availGroups.maybe} />
        </View>

        {!isPast && (
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.ghostBtn, { borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`, backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)` }, pressed && { opacity: 0.75 }]}
              onPress={() => event && addEventToCalendar(event)}
            >
              <Text style={[styles.ghostBtnText, { color: TEAM[300] }]}>Add to calendar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.ghostBtn, { borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`, backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)` }, pressed && { opacity: 0.75 }]}
              onPress={() => event && updateEventInCalendar(event)}
            >
              <Text style={[styles.ghostBtnText, { color: TEAM[300] }]}>Update calendar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.ghostBtn, { borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`, backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)` }, pressed && { opacity: 0.75 }]}
              onPress={() => navigation.navigate('Subs')}
            >
              <Text style={[styles.ghostBtnText, { color: TEAM[300] }]}>Need a sub?</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <SubRequestSheet
        visible={subSheetVisible}
        gameName={event?.title ?? fallbackTitle}
        onYes={handleSubRequest}
        onDismiss={() => setSubSheetVisible(false)}
      />
      {toast !== null && (
        <View
          style={[styles.toast, { bottom: Math.max(insets.bottom, spacing[12]) + spacing[16] }, { borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)` }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  Shared components                                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// ─── "Updated after you responded" banner ────────────────────────────────────

function EventUpdatedBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View style={styles.updateBanner}>
      <Text style={styles.updateBannerGlyph}>⚠</Text>
      <View style={styles.updateBannerCopy}>
        <Text style={styles.updateBannerTitle}>
          This event was updated after you responded.
        </Text>
        <Text style={styles.updateBannerBody}>
          Review the new details — your response was kept the same.
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        style={({ pressed }) => [styles.updateBannerAck, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.updateBannerAckText}>GOT IT</Text>
      </Pressable>
    </View>
  );
}

// ─── Nav header ───────────────────────────────────────────────────────────────

function NavHeader({ onBack, onEdit }: { onBack: () => void; onEdit?: () => void }) {
  const { isManager, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  return (
    <View style={styles.navHeader}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        hitSlop={12}
      >
        <Text style={[styles.backChevron, { color: TEAM[300] }]}>‹</Text>
        <Text style={[styles.backLabel, { color: TEAM[300] }]}>Schedule</Text>
      </Pressable>
      {isManager && onEdit && (
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
          hitSlop={12}
        >
          <Text style={[styles.editLabel, { color: TEAM[300] }]}>Edit</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Event summary block ──────────────────────────────────────────────────────

function formatEventDate(ts: Timestamp): string {
  const d = ts.toDate();
  const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function formatEventTime(ts: Timestamp): string {
  return ts.toDate().toLocaleTimeString('en-CA', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).toLowerCase();
}

function EventSummary({ event, fallbackTitle }: {
  event: FirestoreEvent | null;
  fallbackTitle: string;
}) {
  const { activeTeamId, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const { team } = useTeam(activeTeamId);
  const title     = event?.title   ?? fallbackTitle;
  const typeBadge = (event?.type   ?? 'game').toUpperCase();
  const venue     = event?.venue   ?? 'TBD';
  const dateStr   = event ? formatEventDate(event.startsAt) : '';
  const timeStr   = event ? formatEventTime(event.startsAt) : '';

  const displayScore = event?.scoreUs !== undefined && event?.scoreThem !== undefined
    ? { us: event.scoreUs, them: event.scoreThem }
    : undefined;

  return (
    <View style={styles.eventSummary}>
      <View style={styles.teamPill}>
        <View style={[styles.teamDot, { backgroundColor: TEAM[300] }]} />
        <Text style={[styles.teamPillText, { color: TEAM[300] }]}>{team?.name ?? 'Trash Dogs'}</Text>
      </View>

      <View style={[styles.kindBadge, { backgroundColor: TEAM[900] }]}>
        <Text style={[styles.kindBadgeText, { color: TEAM[300] }]}>{typeBadge}</Text>
      </View>

      <Text style={styles.eventName} numberOfLines={2}>{title}</Text>

      {(dateStr || timeStr) && (
        <View style={styles.dateTimeRow}>
          {dateStr ? <Text style={[styles.dateText, { color: TEAM[300] }]}>{dateStr}</Text> : null}
          {dateStr && timeStr ? <Text style={styles.dateTimeSep}>·</Text> : null}
          {timeStr ? <Text style={styles.timeText}>{timeStr}</Text> : null}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.venueRow, pressed && { opacity: 0.7 }]}
        onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(venue)}`)}
      >
        <PinIcon />
        <Text style={styles.venueText}>{venue}</Text>
      </Pressable>

      {displayScore && (
        <View style={styles.scoreBlock}>
          <View style={styles.scoreNumbers}>
            <Text style={styles.scoreNum}>{displayScore.us}</Text>
            <Text style={styles.scoreSep}>–</Text>
            <Text style={styles.scoreNum}>{displayScore.them}</Text>
          </View>
          <ResultPill us={displayScore.us} them={displayScore.them} />
        </View>
      )}

      {event?.notes ? (
        <View style={styles.notesBlock}>
          <Text style={styles.notesLabel}>NOTES</Text>
          <Text style={styles.notesText}>{event.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PinIcon() {
  return (
    <View style={{ width: 12, height: 15, alignItems: 'center' }}>
      <View style={{
        width: 10, height: 10, borderRadius: 5,
        borderWidth: 1.5, borderColor: navy[400],
      }} />
      <View style={{ width: 1.5, height: 5, backgroundColor: navy[400], marginTop: -1 }} />
    </View>
  );
}

// ─── Result pill ─────────────────────────────────────────────────────────────

function ResultPill({ us, them }: { us: number; them: number }) {
  const result = scoreResult(us, them);
  const config = {
    win:  { bg: status.success.subtle, text: status.success.pure, label: 'Win'  },
    loss: { bg: status.error.subtle,   text: status.error.pure,   label: 'Loss' },
    tie:  { bg: 'rgba(95,107,133,0.14)', text: navy[300],          label: 'Tie'  },
  }[result];
  return (
    <View style={[styles.resultPill, { backgroundColor: config.bg }]}>
      <Text style={[styles.resultPillText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

// ─── Score entry sheet (manager only) ────────────────────────────────────────

function ScoreSheet({
  visible, initial, onSave, onClose,
}: {
  visible: boolean;
  initial?: Score;
  onSave: (s: Score) => void;
  onClose: () => void;
}) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const insets = useSafeAreaInsets();
  const [us,   setUs]   = useState('');
  const [them, setThem] = useState('');

  useEffect(() => {
    if (visible) {
      setUs(initial !== undefined ? String(initial.us) : '');
      setThem(initial !== undefined ? String(initial.them) : '');
    }
  }, [visible]);

  const usNum   = parseInt(us)   || 0;
  const themNum = parseInt(them) || 0;
  const hasValues = us !== '' && them !== '';

  const result = usNum > themNum ? 'win' : usNum < themNum ? 'loss' : 'tie';
  const resultConfig = {
    win:  { bg: status.success.subtle, text: status.success.pure, label: 'Win'  },
    loss: { bg: status.error.subtle,   text: status.error.pure,   label: 'Loss' },
    tie:  { bg: 'rgba(95,107,133,0.14)', text: navy[300],          label: 'Tie'  },
  }[result];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
          <Pressable
            onPress={() => {}}
            style={[styles.scoreSheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Enter score</Text>

            <View style={styles.scoreInputRow}>
              <View style={styles.scoreInputGroup}>
                <TextInput
                  style={styles.scoreInput}
                  value={us}
                  onChangeText={v => setUs(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="0"
                  placeholderTextColor={navy[500]}
                  textAlign="center"
                  selectTextOnFocus
                />
                <Text style={styles.scoreInputLabel}>Us</Text>
              </View>

              <Text style={styles.scoreInputDash}>–</Text>

              <View style={styles.scoreInputGroup}>
                <TextInput
                  style={styles.scoreInput}
                  value={them}
                  onChangeText={v => setThem(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="0"
                  placeholderTextColor={navy[500]}
                  textAlign="center"
                  selectTextOnFocus
                />
                <Text style={styles.scoreInputLabel}>Them</Text>
              </View>
            </View>

            {hasValues && (
              <View style={styles.resultAutoRow}>
                <View style={[styles.resultAutoPill, { backgroundColor: resultConfig.bg }]}>
                  <Text style={[styles.resultAutoPillText, { color: resultConfig.text }]}>
                    {resultConfig.label}
                  </Text>
                </View>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.saveScoreBtn,
                hasValues && { backgroundColor: TEAM[500], shadowColor: TEAM[500] },
                !hasValues && styles.saveScoreBtnDisabled,
                pressed && hasValues && { opacity: 0.85 },
              ]}
              onPress={hasValues ? () => { onSave({ us: usNum, them: themNum }); onClose(); } : undefined}
            >
              <Text style={[styles.saveScoreBtnText, hasValues && { color: TEAM.on }, !hasValues && styles.saveScoreBtnTextDisabled]}>
                Save score
              </Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Cancel game sheet (manager only) ────────────────────────────────────────

const MAX_CANCEL_REASON = 140;

// "VS. ICE SHARKS · FRI 7:30 PM" — the opponent when there is one, since the
// title is already in the heading's blast radius, plus the weekday and time so
// the manager can tell two fixtures against the same team apart.
function formatCancelMeta(event: FirestoreEvent): string {
  const d    = event.startsAt.toDate();
  const h    = d.getHours();
  const h12  = h % 12 === 0 ? 12 : h % 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const who  = event.opponent ? `vs. ${event.opponent}` : event.title;
  return `${who} · ${WEEKDAY_ABBR[d.getDay()]} ${h12}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

function CancelEventSheet({
  visible, event, fallbackTitle, respondedCount, cancelling, onConfirm, onClose,
}: {
  visible: boolean;
  event: FirestoreEvent | null;
  fallbackTitle: string;
  respondedCount: number;
  cancelling: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
          <Pressable onPress={() => {}}>
            <View style={[styles.cancelSheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}>
              <View style={styles.sheetHandle} />

              <Text style={styles.cancelSheetGlyph}>⚠</Text>
              <Text style={[styles.sheetTitle, styles.cancelSheetTitle]}>Cancel this game?</Text>
              <Text style={styles.cancelSheetMeta}>
                {event ? formatCancelMeta(event) : fallbackTitle}
              </Text>

              {/* Never "All 0 players" — with no responses the push still goes
                  to the whole roster, so say that instead. */}
              {/* The push goes to every member with notifications on, not just
                  those who responded, so don't imply a count. */}
              <Text style={styles.cancelSheetBody}>
                The whole team will be notified immediately.
              </Text>

              <View style={styles.cancelReasonLabelRow}>
                <Text style={styles.cancelReasonLabel}>Add a reason</Text>
                <View style={styles.cancelReasonOptional}>
                  <Text style={styles.cancelReasonOptionalText}>OPTIONAL</Text>
                </View>
              </View>
              <TextInput
                style={styles.cancelReasonInput}
                value={reason}
                onChangeText={t => setReason(t.slice(0, MAX_CANCEL_REASON))}
                placeholder="e.g. Rink flooded — no ice tonight"
                placeholderTextColor={navy[400]}
                multiline
                maxLength={MAX_CANCEL_REASON}
                textAlignVertical="top"
                editable={!cancelling}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.cancelConfirmBtn,
                  cancelling && styles.cancelConfirmBtnDisabled,
                  pressed && !cancelling && { opacity: 0.85 },
                ]}
                disabled={cancelling}
                onPress={() => onConfirm(reason)}
              >
                <Text style={styles.cancelConfirmBtnText}>
                  {cancelling ? 'Cancelling…' : 'Yes, cancel game'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelKeepBtn,
                  { borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`, backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)` },
                  pressed && { opacity: 0.75 },
                ]}
                disabled={cancelling}
                onPress={onClose}
              >
                <Text style={[styles.cancelKeepBtnText, { color: TEAM[300] }]}>Keep it</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Availability group (collapsible) ─────────────────────────────────────────

function AvailGroup({
  label, dotColor, players, showRemind = false, onEditPlayer, onRemind,
}: {
  label: string;
  dotColor: string;
  players: Player[];
  showRemind?: boolean;
  onEditPlayer?: (player: Player) => void;
  onRemind?: () => void;
}) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.availGroup}>
      <Pressable
        onPress={() => setExpanded(v => !v)}
        style={({ pressed }) => [styles.groupHeader, pressed && { opacity: 0.8 }]}
      >
        <View style={styles.groupLeft}>
          <View style={[styles.groupDot, { backgroundColor: dotColor }]} />
          <Text style={styles.groupLabel}>{label}</Text>
          <Text style={styles.groupCount}>{players.length}</Text>
        </View>
        <View style={styles.groupRight}>
          {showRemind && (
            <TouchableOpacity style={[styles.remindInlineBtn, { borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.50)`, backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.12)` }]} hitSlop={8} onPress={onRemind}>
              <Text style={[styles.remindInlineText, { color: TEAM[300] }]}>Remind</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.groupChevron, expanded && styles.groupChevronOpen]}>›</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.groupBody}>
          {players.map(p => <PlayerRow key={p.id} player={p} onEditPlayer={onEditPlayer} />)}
        </View>
      )}
    </View>
  );
}

function PlayerRow({ player, onEditPlayer }: { player: Player; onEditPlayer?: (player: Player) => void }) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  return (
    <View style={styles.playerRow}>
      <View style={styles.jerseyBadge}>
        <Text style={[styles.jerseyText, { color: TEAM[300] }]}>#{player.jersey}</Text>
      </View>
      <Text style={styles.playerName}>{player.name}</Text>
      {player.respondedAt && (
        <Text style={styles.playerTime}>{player.respondedAt}</Text>
      )}
      {onEditPlayer && (
        <Pressable onPress={() => onEditPlayer(player)} hitSlop={10} style={styles.editPlayerBtn}>
          <Text style={styles.editPlayerIcon}>✎</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Manager availability edit sheet ─────────────────────────────────────────

function AvailEditSheet({
  visible, player, onMark, onClose,
}: {
  visible: boolean;
  player: Player | null;
  onMark: (group: 'in' | 'out' | 'maybe') => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const MARK_OPTS: { id: 'in' | 'out' | 'maybe'; label: string; color: string }[] = [
    { id: 'in',    label: 'Mark as In',    color: status.success.pure },
    { id: 'out',   label: 'Mark as Out',   color: status.error.pure   },
    { id: 'maybe', label: 'Mark as Maybe', color: status.alert.pure   },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[styles.availEditSheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}
        >
          <View style={styles.sheetHandle} />
          {player && <Text style={styles.availEditName}>{player.name}</Text>}
          {MARK_OPTS.map(opt => (
            <Pressable
              key={opt.id}
              style={({ pressed }) => [styles.availEditOption, pressed && { opacity: 0.75 }]}
              onPress={() => onMark(opt.id)}
            >
              <Text style={[styles.availEditOptionText, { color: opt.color }]}>{opt.label}</Text>
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [styles.availEditOption, pressed && { opacity: 0.75 }]}
            onPress={onClose}
          >
            <Text style={[styles.availEditOptionText, { color: navy[400] }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Sub request sheet (player only) ─────────────────────────────────────────

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
            style={({ pressed }) => [styles.subRequestYesBtn, { backgroundColor: TEAM[500], shadowColor: TEAM[500] }, pressed && { opacity: 0.85 }]}
            onPress={onYes}
          >
            <Text style={[styles.subRequestYesBtnText, { color: TEAM.on }]}>Yes, request a sub</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.subRequestNoBtn, { borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`, backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)` }, pressed && { opacity: 0.75 }]}
            onPress={onDismiss}
          >
            <Text style={[styles.subRequestNoBtnText, { color: TEAM[300] }]}>No thanks</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── In / Out / Maybe toggle (player only) ────────────────────────────────────

function InOutMaybeToggle({
  response, onRespond,
}: {
  response: PlayerResponse;
  onRespond: (r: NonNullable<PlayerResponse>) => void;
}) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const RESPONSE_TINTS: Record<NonNullable<PlayerResponse>, string> = {
    in:    TEAM[500],
    out:   status.error.pure,
    maybe: status.alert.pure,
  };
  const RESPONSE_ON: Record<NonNullable<PlayerResponse>, string> = {
    in:    TEAM.on,
    out:   '#FFFFFF',
    maybe: '#0B1220',
  };
  const activeIdx = TOGGLE_OPTS.findIndex(o => o.id === response);

  return (
    <View style={styles.toggleContainer}>
      {response && (
        <View style={[
          styles.togglePill,
          {
            left: `${(Math.max(0, activeIdx) / TOGGLE_OPTS.length) * 100}%` as any,
            width: `${(1 / TOGGLE_OPTS.length) * 100}%` as any,
            backgroundColor: RESPONSE_TINTS[response],
          },
        ]} />
      )}
      {TOGGLE_OPTS.map(opt => {
        const isActive = response === opt.id;
        const textColor = isActive ? RESPONSE_ON[opt.id] : 'rgba(255,255,255,0.70)';
        return (
          <Pressable
            key={opt.id}
            style={styles.toggleSegment}
            onPress={() => { haptics.selection(); onRespond(opt.id); }}
            android_ripple={{ color: 'rgba(255,255,255,0.10)', borderless: true }}
          >
            <View style={[
              styles.toggleGlyph,
              { backgroundColor: isActive ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)' },
            ]}>
              <Text style={[styles.toggleGlyphText, { color: textColor }]}>{opt.glyph}</Text>
            </View>
            <Text style={[styles.toggleLabel, { color: textColor }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  Styles                                                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: navy[800] },

  // ── Nav header ────────────────────────────────────────────────────────────
  navHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingTop: spacing[10],
    paddingBottom: spacing[6],
    minHeight: 48,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start',
  },
  backChevron: {
    fontFamily: fonts.display, fontSize: 26, lineHeight: 30,
    color: TEAM[300], marginTop: -2,
  },
  backLabel: {
    fontFamily: fonts.uiMedium, fontSize: 15, color: TEAM[300],
  },
  editLabel: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, color: TEAM[300],
  },

  // ── Event summary ─────────────────────────────────────────────────────────
  eventSummary: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
    paddingBottom: spacing[20],
    borderBottomWidth: 1,
    borderBottomColor: navy[700],
  },
  teamPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing[10],
  },
  teamDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: TEAM[300] },
  teamPillText: {
    fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2, color: TEAM[300],
  },
  kindBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.xs,
    backgroundColor: TEAM[900],
    marginBottom: spacing[8],
  },
  kindBadgeText: {
    fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.4, color: TEAM[300],
  },
  eventName: {
    fontFamily: fonts.display, fontSize: 34, lineHeight: 38,
    letterSpacing: -0.8, fontWeight: '700', color: '#FFFFFF',
    marginBottom: spacing[14],
  },
  dateTimeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[8], marginBottom: spacing[10],
  },
  dateText: {
    fontFamily: fonts.mono, fontSize: 14, letterSpacing: 0.5, color: TEAM[300],
  },
  dateTimeSep: {
    fontFamily: fonts.mono, fontSize: 14, color: navy[500],
  },
  timeText: {
    fontFamily: fonts.mono, fontSize: 14, letterSpacing: 0.5, color: navy[100],
  },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[6], alignSelf: 'flex-start' },
  venueText: { fontFamily: fonts.uiMedium, fontSize: 14, color: navy[300] },

  // Score display in event summary
  scoreBlock: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[12], marginTop: spacing[16],
  },
  scoreNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[8] },
  scoreNum: {
    fontFamily: fonts.monoBold, fontSize: 36, fontWeight: '700',
    color: '#FFFFFF', lineHeight: 40,
  },
  scoreSep: {
    fontFamily: fonts.mono, fontSize: 24, color: navy[400], lineHeight: 28,
  },
  resultPill: {
    paddingHorizontal: spacing[10], paddingVertical: 4, borderRadius: radius.pill,
  },
  resultPillText: { fontFamily: fonts.uiSemiBold, fontSize: 13 },

  // Notes block
  notesBlock: {
    marginTop: spacing[14],
    backgroundColor: navy[700],
    borderRadius: radius.m,
    padding: spacing[14],
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  notesLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: navy[400],
    marginBottom: spacing[6],
  },
  notesText: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: navy[300],
  },

  // "Enter score" / "Edit score" row
  scoreActionRow: {
    paddingHorizontal: spacing[20], paddingTop: spacing[12], paddingBottom: spacing[4],
  },
  enterScoreBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[14], paddingVertical: spacing[6],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.50)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
  },
  enterScoreBtnText: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: TEAM[300] },

  // Score entry sheet
  sheetBackdrop: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.60)',
  },
  scoreSheet: {
    backgroundColor: navy[700],
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing[24], paddingTop: spacing[16],
    borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: navy[500],
    alignSelf: 'center', marginBottom: spacing[20],
  },
  sheetTitle: {
    fontFamily: fonts.display, fontSize: 20, fontWeight: '700',
    letterSpacing: -0.3, color: '#FFFFFF',
    textAlign: 'center', marginBottom: spacing[28],
  },
  scoreInputRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[16], marginBottom: spacing[20],
  },
  scoreInputGroup: { alignItems: 'center', gap: spacing[6] },
  scoreInput: {
    width: 90, height: 72,
    backgroundColor: navy[600],
    borderRadius: radius.l,
    borderWidth: 0.5, borderColor: navy[500],
    fontFamily: fonts.monoBold, fontSize: 36, fontWeight: '700',
    color: '#FFFFFF', textAlign: 'center',
  },
  scoreInputLabel: {
    fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.0,
    color: navy[400], textTransform: 'uppercase',
  },
  scoreInputDash: {
    fontFamily: fonts.mono, fontSize: 28, color: navy[400], marginTop: -12,
  },
  resultAutoRow: {
    alignItems: 'center', marginBottom: spacing[20],
  },
  resultAutoPill: {
    paddingHorizontal: spacing[16], paddingVertical: spacing[6],
    borderRadius: radius.pill,
  },
  resultAutoPillText: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600',
  },
  saveScoreBtn: {
    height: 52, borderRadius: radius.l,
    backgroundColor: TEAM[500],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[4],
    shadowColor: TEAM[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  saveScoreBtnDisabled: {
    backgroundColor: navy[600], shadowOpacity: 0, elevation: 0,
  },
  saveScoreBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600', color: TEAM.on,
  },
  saveScoreBtnTextDisabled: { color: navy[400] },

  // ── Cancel game sheet ─────────────────────────────────────────────────────
  cancelSheet: {
    backgroundColor: navy[700],
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing[24], paddingTop: spacing[16],
    borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  cancelSheetGlyph: {
    fontFamily: fonts.display, fontSize: 26, lineHeight: 30,
    color: status.error.pure, textAlign: 'center', marginBottom: spacing[8],
  },
  cancelSheetTitle: { marginBottom: spacing[6] },
  cancelSheetMeta: {
    fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2,
    color: navy[400], textTransform: 'uppercase',
    textAlign: 'center', marginBottom: spacing[12],
  },
  cancelSheetBody: {
    fontFamily: fonts.ui, fontSize: 14, lineHeight: 20,
    color: navy[300], textAlign: 'center', marginBottom: spacing[20],
  },
  cancelSheetBodyStrong: {
    fontFamily: fonts.uiBold, fontWeight: '700', color: '#FFFFFF',
  },
  cancelReasonLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[8],
    marginBottom: spacing[6],
  },
  cancelReasonLabel: {
    fontFamily: fonts.uiMedium, fontSize: 13, color: navy[100],
  },
  cancelReasonOptional: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.xs, backgroundColor: navy[600],
  },
  cancelReasonOptionalText: {
    fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.2, color: navy[400],
  },
  cancelReasonInput: {
    minHeight: 64,
    backgroundColor: navy[600],
    borderRadius: radius.m,
    borderWidth: 0.5, borderColor: navy[500],
    paddingHorizontal: spacing[12], paddingVertical: spacing[10],
    fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: navy[50],
    marginBottom: spacing[20],
  },
  cancelConfirmBtn: {
    height: 52, borderRadius: radius.l,
    backgroundColor: status.error.pure,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[10],
    shadowColor: status.error.pure,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  cancelConfirmBtnDisabled: {
    backgroundColor: navy[600], shadowOpacity: 0, elevation: 0,
  },
  cancelConfirmBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600', color: '#FFFFFF',
  },
  cancelKeepBtn: {
    height: 52, borderRadius: radius.l, borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4],
  },
  cancelKeepBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600', color: TEAM[300],
  },

  // ── "Updated after you responded" banner ──────────────────────────────────
  updateBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[10],
    marginHorizontal: spacing[16], marginTop: spacing[8],
    paddingHorizontal: spacing[14], paddingVertical: spacing[12],
    borderRadius: radius.m,
    backgroundColor: status.alert.subtle,
    borderWidth: 0.5,
    borderColor: `rgba(${hexToRgbVals(status.alert.pure)}, 0.40)`,
  },
  updateBannerGlyph: {
    fontFamily: fonts.display, fontSize: 15, lineHeight: 20,
    color: status.alert.pure,
  },
  updateBannerCopy: { flex: 1, gap: 2 },
  updateBannerTitle: {
    fontFamily: fonts.uiSemiBold, fontSize: 13.5, lineHeight: 19,
    fontWeight: '600', color: '#FFFFFF',
  },
  updateBannerBody: {
    fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 17, color: navy[300],
  },
  updateBannerAck: {
    paddingHorizontal: spacing[10], paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    borderColor: `rgba(${hexToRgbVals(status.alert.pure)}, 0.50)`,
    backgroundColor: `rgba(${hexToRgbVals(status.alert.pure)}, 0.14)`,
  },
  updateBannerAckText: {
    fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1.2,
    color: status.alert.light,
  },

  // ── Section wrapper ───────────────────────────────────────────────────────
  section: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[20],
    paddingBottom: spacing[4],
  },
  sectionLabel: {
    fontFamily: fonts.uiMedium, fontSize: 11, letterSpacing: 1.2,
    color: navy[400], textTransform: 'uppercase',
    marginBottom: spacing[12],
  },
  sectionDivider: {
    height: 1, backgroundColor: navy[700],
    marginHorizontal: spacing[16], marginVertical: spacing[4],
  },

  // ── Availability group ────────────────────────────────────────────────────
  availGroup: {
    borderRadius: radius.m,
    backgroundColor: navy[700],
    marginBottom: spacing[4],
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[14], paddingHorizontal: spacing[14],
  },
  groupLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[10] },
  groupRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupLabel: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: navy[100] },
  groupCount: {
    fontFamily: fonts.monoBold, fontSize: 15, lineHeight: 18, color: navy[300],
  },
  groupChevron: {
    fontFamily: fonts.display, fontSize: 20, lineHeight: 22, color: navy[400],
    transform: [{ rotate: '90deg' }],
  },
  groupChevronOpen: {
    transform: [{ rotate: '270deg' }],
  },

  // ── Player rows (inside expanded group) ──────────────────────────────────
  groupBody: { borderTopWidth: 0.5, borderTopColor: navy[600] },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[12],
    paddingVertical: spacing[10], paddingHorizontal: spacing[14],
    borderBottomWidth: 0.5, borderBottomColor: navy[600],
  },
  jerseyBadge: {
    width: 30, height: 30, borderRadius: radius.xs,
    backgroundColor: navy[600],
    borderWidth: 0.5, borderColor: navy[500],
    alignItems: 'center', justifyContent: 'center',
  },
  jerseyText: { fontFamily: fonts.monoBold, fontSize: 11, color: TEAM[300] },
  playerName: { flex: 1, fontFamily: fonts.uiMedium, fontSize: 14, color: navy[100] },
  playerTime: {
    fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.3, color: navy[400],
  },

  // ── Remind inline button ──────────────────────────────────────────────────
  remindInlineBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.50)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.12)`,
  },
  remindInlineText: { fontFamily: fonts.uiMedium, fontSize: 12, color: TEAM[300] },

  // ── In/Out/Maybe toggle (C-03) ────────────────────────────────────────────
  toggleContainer: {
    flexDirection: 'row', height: 64,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    padding: 4, position: 'relative', overflow: 'hidden',
  },
  togglePill: { position: 'absolute', top: 4, bottom: 4, borderRadius: 10 },
  toggleSegment: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, zIndex: 1,
  },
  toggleGlyph: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  toggleGlyphText: { fontFamily: fonts.display, fontSize: 12, fontWeight: '700' },
  toggleLabel: { fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600' },

  // ── Footer buttons ────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: spacing[16], paddingTop: spacing[24], gap: spacing[10],
  },
  cancelBtn: {
    height: 52, borderRadius: radius.l,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.40)',
    backgroundColor: 'rgba(239,68,68,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: status.error.pure },
  ghostBtn: {
    height: 52, borderRadius: radius.l,
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
    alignItems: 'center', justifyContent: 'center',
  },
  ghostBtnText: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: TEAM[300] },

  // ── Player edit button ────────────────────────────────────────────────────
  editPlayerBtn: { padding: 4 },
  editPlayerIcon: { fontSize: 15, color: navy[400], fontFamily: fonts.ui },

  // ── Avail edit sheet ──────────────────────────────────────────────────────
  availEditSheet: {
    backgroundColor: navy[700],
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing[24], paddingTop: spacing[16],
    borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  availEditName: {
    fontFamily: fonts.uiSemiBold, fontSize: 14, color: navy[300],
    textAlign: 'center', marginBottom: spacing[16],
  },
  availEditOption: {
    height: 52, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  availEditOptionText: { fontFamily: fonts.uiSemiBold, fontSize: 16, fontWeight: '600' },

  // ── Sub request sheet ─────────────────────────────────────────────────────
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
  subRequestYesBtnText: { fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600', color: TEAM.on },
  subRequestNoBtn: {
    height: 52, borderRadius: radius.l, borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[8],
  },
  subRequestNoBtnText: { fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600', color: TEAM[300] },

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

// ─── Utility ──────────────────────────────────────────────────────────────────

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
