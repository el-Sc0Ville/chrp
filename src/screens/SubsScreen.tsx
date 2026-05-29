// Subs screen — B-11 Manager Sub Requests / C-11 Player Sub Requests.
// Flip IS_MANAGER to preview each view. Replace with Firebase when backend is wired.

import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  Modal, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { addDoc, collection, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { navy, teams, status, fonts, type as T, spacing, radius } from '../theme';
import { db } from '../firebase';
import { useUserContext } from '../context/UserContext';
import { useSubRequests } from '../firebase/hooks/useSubRequests';
import type { SubRequest as FirestoreSubRequest } from '../firebase/schema';

const TEAM    = teams.trashdogs;
const TEAM_ID = 'trashdogs';
const SPARE_FEE = 20; // $ per game

// ─── Types ────────────────────────────────────────────────────────────────────

type SubStatus = 'pending' | 'filled' | 'cancelled';

interface SubRequest {
  id: string;
  playerId: string;
  playerName: string;
  playerInitials: string;
  playerJersey: number;
  gameWeekday: string;
  gameDay: string;
  gameMonth: string;
  opponent: string;
  venue: string;
  gameTime: string;
  reason?: string;
  status: SubStatus;
  filledBy?: string;
}

interface Spare {
  id: string;
  name: string;
  initials: string;
  position: string;
  gamesPlayed: number;
}

interface UpcomingEvent {
  id: string;
  weekday: string;
  day: string;
  month: string;
  opponent: string;
  venue: string;
  time: string;
  myResponse: 'out' | null;
}

// ─── Hardcoded data ───────────────────────────────────────────────────────────

const SPARES: Spare[] = [
  { id: 's1', name: 'François Lapointe', initials: 'FL', position: 'Defence', gamesPlayed: 3 },
  { id: 's2', name: 'Keegan Murphy',     initials: 'KM', position: 'Forward', gamesPlayed: 7 },
  { id: 's3', name: 'Isabelle Tran',     initials: 'IT', position: 'Goalie',  gamesPlayed: 1 },
  { id: 's4', name: 'Dex Hartmann',      initials: 'DH', position: 'Forward', gamesPlayed: 5 },
  { id: 's5', name: 'Rania Osei',        initials: 'RO', position: 'Defence', gamesPlayed: 2 },
];

const SUB_REQUESTS_SEED: SubRequest[] = [
  {
    id: 'sr1',
    playerId: 'r4', playerName: 'Jake Kowalski', playerInitials: 'JK', playerJersey: 44,
    gameWeekday: 'SAT', gameDay: '31', gameMonth: 'MAY',
    opponent: 'vs Ember FC', venue: 'Arena Nord', gameTime: '7:30 PM',
    reason: 'Out of town for a work trip',
    status: 'pending',
  },
  {
    id: 'sr2',
    playerId: 'r9', playerName: 'Sam Delacroix', playerInitials: 'SD', playerJersey: 67,
    gameWeekday: 'SAT', gameDay: '07', gameMonth: 'JUN',
    opponent: '@ Aurora Sky', venue: 'Stadium B', gameTime: '8:00 PM',
    status: 'pending',
  },
  {
    id: 'sr3',
    playerId: 'r7', playerName: 'Nina Petrov', playerInitials: 'NP', playerJersey: 3,
    gameWeekday: 'WED', gameDay: '04', gameMonth: 'JUN',
    opponent: 'Team Practice', venue: 'Inner Ice Complex', gameTime: '6:00 PM',
    reason: 'Knee physio appointment',
    status: 'filled',
    filledBy: 'Keegan Murphy',
  },
];

// Upcoming games the player hasn't responded to or is Out for
const PLAYER_UPCOMING: UpcomingEvent[] = [
  {
    id: 'e3', weekday: 'SAT', day: '07', month: 'JUN',
    opponent: '@ Aurora Sky', venue: 'Stadium B', time: '8:00 PM',
    myResponse: null,
  },
];

// Player's own submitted requests (Pat Normandin has 1 pending)
const PLAYER_OWN_SEED: SubRequest[] = [
  {
    id: 'sr4',
    playerId: 'r1', playerName: 'Pat Normandin', playerInitials: 'PN', playerJersey: 17,
    gameWeekday: 'SAT', gameDay: '31', gameMonth: 'MAY',
    opponent: 'vs Ember FC', venue: 'Arena Nord', gameTime: '7:30 PM',
    reason: 'Work event',
    status: 'pending',
  },
];

// ─── Firestore → display mapper ───────────────────────────────────────────────

function toDisplaySubRequest(r: FirestoreSubRequest): SubRequest {
  const parts    = r.requestedByName.trim().split(' ');
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : r.requestedByName.slice(0, 2).toUpperCase();
  return {
    id: r.id,
    playerId: r.requestedBy, playerName: r.requestedByName,
    playerInitials: initials, playerJersey: 0,
    gameWeekday: r.gameWeekday, gameDay: r.gameDay, gameMonth: r.gameMonth,
    opponent: r.opponent, venue: r.gameVenue, gameTime: r.gameTime,
    reason: r.reason, status: r.status, filledBy: r.filledBy,
  };
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function SubsScreen() {
  const { isManager } = useUserContext();
  return isManager ? <ManagerSubsScreen /> : <PlayerSubsScreen />;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  B-11 · Manager Sub Requests                                             ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function ManagerSubsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { subRequests: firestoreRequests } = useSubRequests(TEAM_ID);
  const requests     = firestoreRequests.map(toDisplaySubRequest);
  const [findSubTarget,  setFindSubTarget]  = useState<SubRequest | null>(null);
  const [invitedSpares,  setInvitedSpares]  = useState<Set<string>>(new Set());
  const [filledExpanded, setFilledExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openRequests   = requests.filter(r => r.status === 'pending');
  const filledRequests = requests.filter(r => r.status === 'filled');

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const handleInvite = async (spare: Spare) => {
    if (!findSubTarget) return;
    const key = `${findSubTarget.id}:${spare.id}`;
    setInvitedSpares(prev => new Set([...prev, key]));
    showToast(`Invite sent to ${spare.name.split(' ')[0]}`);
    try {
      await updateDoc(doc(db, 'teams', TEAM_ID, 'subRequests', findSubTarget.id), {
        status: 'filled', filledBy: spare.name,
      });
    } catch (err) {
      console.error('[SubsScreen] invite write failed:', err);
    }
  };

  const isInvited = (spare: Spare) =>
    !!findSubTarget && invitedSpares.has(`${findSubTarget.id}:${spare.id}`);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Nav header ── */}
      <View style={styles.navHeader}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>‹ Team</Text>
        </Pressable>
        <View style={styles.navCenter}>
          <Text style={styles.navTitle}>Sub requests</Text>
          {openRequests.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{openRequests.length}</Text>
            </View>
          )}
        </View>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing[32]) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Open requests ── */}
        {openRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No open requests</Text>
            <Text style={styles.emptyBody}>
              When a player requests a sub, it'll show up here.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Open</Text>
            <View style={styles.card}>
              {openRequests.map((req, idx) => (
                <React.Fragment key={req.id}>
                  {idx > 0 && <View style={styles.rowDivider} />}
                  <ManagerRequestRow request={req} onFindSub={() => setFindSubTarget(req)} />
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* ── Filled requests (collapsible) ── */}
        {filledRequests.length > 0 && (
          <>
            <Pressable
              style={({ pressed }) => [styles.filledToggle, pressed && { opacity: 0.7 }]}
              onPress={() => setFilledExpanded(v => !v)}
            >
              <Text style={styles.filledToggleLabel}>Filled ({filledRequests.length})</Text>
              <Text style={[styles.filledChevron, filledExpanded && styles.filledChevronOpen]}>›</Text>
            </Pressable>
            {filledExpanded && (
              <View style={styles.card}>
                {filledRequests.map((req, idx) => (
                  <React.Fragment key={req.id}>
                    {idx > 0 && <View style={styles.rowDivider} />}
                    <FilledRequestRow request={req} />
                  </React.Fragment>
                ))}
              </View>
            )}
          </>
        )}

        <Text style={styles.spareNote}>Spares are charged ${SPARE_FEE}/game</Text>
      </ScrollView>

      {/* ── Find Sub Sheet ── */}
      {findSubTarget && (
        <FindSubSheet
          request={findSubTarget}
          spares={SPARES}
          isInvited={isInvited}
          onInvite={handleInvite}
          onClose={() => setFindSubTarget(null)}
        />
      )}

      {/* ── Toast ── */}
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

// ─── Manager sub-components ───────────────────────────────────────────────────

function ManagerRequestRow({ request, onFindSub }: { request: SubRequest; onFindSub: () => void }) {
  return (
    <View style={styles.requestRow}>
      <View style={styles.requestTop}>
        <PlayerAvatar initials={request.playerInitials} />
        <View style={styles.requestInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.playerName}>{request.playerName}</Text>
            <Text style={styles.playerJersey}>#{request.playerJersey}</Text>
          </View>
          <View style={styles.gameMetaRow}>
            <Text style={styles.gameDate}>
              {request.gameWeekday} {request.gameDay} {request.gameMonth}
            </Text>
            <Text style={styles.gameSep}>·</Text>
            <Text style={styles.gameOpponent}>{request.opponent}</Text>
          </View>
          {request.reason != null && (
            <Text style={styles.requestReason} numberOfLines={1}>
              "{request.reason}"
            </Text>
          )}
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [styles.findSubBtn, pressed && { opacity: 0.8 }]}
        onPress={onFindSub}
      >
        <Text style={styles.findSubBtnText}>Find a sub</Text>
      </Pressable>
    </View>
  );
}

function FilledRequestRow({ request }: { request: SubRequest }) {
  return (
    <View style={styles.filledRow}>
      <PlayerAvatar initials={request.playerInitials} />
      <View style={styles.requestInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.playerName}>{request.playerName}</Text>
          <Text style={styles.playerJersey}>#{request.playerJersey}</Text>
        </View>
        <Text style={styles.gameDate}>
          {request.gameWeekday} {request.gameDay} {request.gameMonth} · {request.opponent}
        </Text>
      </View>
      <View style={styles.filledByBlock}>
        <Text style={styles.filledByLabel}>Filled by</Text>
        <Text style={styles.filledByName}>{request.filledBy}</Text>
      </View>
    </View>
  );
}

function FindSubSheet({
  request, spares, isInvited, onInvite, onClose,
}: {
  request: SubRequest;
  spares: Spare[];
  isInvited: (s: Spare) => boolean;
  onInvite: (s: Spare) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Find a sub</Text>
            <Text style={styles.sheetSub}>
              {request.opponent} · {request.gameWeekday} {request.gameDay} {request.gameMonth}
            </Text>

            <View style={styles.spareList}>
              {spares.map((spare, idx) => {
                const invited = isInvited(spare);
                return (
                  <React.Fragment key={spare.id}>
                    {idx > 0 && <View style={styles.rowDivider} />}
                    <View style={styles.spareRow}>
                      <View style={styles.spareAvatar}>
                        <Text style={styles.spareAvatarText}>{spare.initials}</Text>
                      </View>
                      <View style={styles.spareInfo}>
                        <Text style={styles.spareName}>{spare.name}</Text>
                        <Text style={styles.spareMeta}>
                          {spare.position} · {spare.gamesPlayed} game{spare.gamesPlayed !== 1 ? 's' : ''} as spare
                        </Text>
                      </View>
                      <Pressable
                        style={[styles.inviteBtn, invited && styles.inviteBtnSent]}
                        onPress={() => !invited && onInvite(spare)}
                      >
                        <Text style={[styles.inviteBtnText, invited && styles.inviteBtnTextSent]}>
                          {invited ? '✓ Sent' : 'Invite'}
                        </Text>
                      </Pressable>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>

            <Text style={styles.spareFeeCaption}>Spares are charged ${SPARE_FEE}/game</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  C-11 · Player Sub Requests                                              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function PlayerSubsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useUserContext();
  const { subRequests: firestoreRequests } = useSubRequests(TEAM_ID);
  const ownRequests = firestoreRequests
    .filter(r => r.requestedBy === (user?.uid ?? ''))
    .map(toDisplaySubRequest);
  const [requestTarget,  setRequestTarget]  = useState<UpcomingEvent | null>(null);
  const [noteText,       setNoteText]       = useState('');
  const [toast,          setToast]          = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Events the player hasn't submitted a request for yet
  const availableEvents = PLAYER_UPCOMING.filter(
    e => !firestoreRequests.some(r => r.eventId === e.id && r.requestedBy === (user?.uid ?? '')),
  );

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const handleSubmitRequest = async () => {
    if (!requestTarget) return;
    const reason = noteText.trim() || undefined;
    setNoteText('');
    setRequestTarget(null);
    showToast('Request sent to your manager');
    try {
      await addDoc(collection(db, 'teams', TEAM_ID, 'subRequests'), {
        eventId:         requestTarget.id,
        requestedBy:     user?.uid ?? 'anon',
        requestedByName: user?.displayName ?? 'Player',
        reason:          reason ?? null,
        status:          'pending',
        createdAt:       serverTimestamp(),
        opponent:        requestTarget.opponent,
        gameWeekday:     requestTarget.weekday,
        gameDay:         requestTarget.day,
        gameMonth:       requestTarget.month,
        gameVenue:       requestTarget.venue,
        gameTime:        requestTarget.time,
      });
    } catch (err) {
      console.error('[SubsScreen] sub request write failed:', err);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Nav header ── */}
      <View style={styles.navHeader}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.navTitle}>Need a sub?</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing[32]) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Upcoming games ── */}
        {availableEvents.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Upcoming games</Text>
            <View style={styles.card}>
              {availableEvents.map((event, idx) => (
                <React.Fragment key={event.id}>
                  {idx > 0 && <View style={styles.rowDivider} />}
                  <PlayerEventRow event={event} onRequest={() => setRequestTarget(event)} />
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* ── Player's own requests ── */}
        {ownRequests.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Your requests</Text>
            <View style={styles.card}>
              {ownRequests.map((req, idx) => (
                <React.Fragment key={req.id}>
                  {idx > 0 && <View style={styles.rowDivider} />}
                  <PlayerOwnRequestRow request={req} />
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {availableEvents.length === 0 && ownRequests.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No games need a sub</Text>
            <Text style={styles.emptyBody}>
              Games where you're Out or haven't responded will appear here.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Request Sub Sheet ── */}
      {requestTarget && (
        <RequestSubSheet
          event={requestTarget}
          note={noteText}
          onChangeNote={setNoteText}
          onSubmit={handleSubmitRequest}
          onClose={() => { setRequestTarget(null); setNoteText(''); }}
        />
      )}

      {/* ── Toast ── */}
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

// ─── Player sub-components ────────────────────────────────────────────────────

function PlayerEventRow({ event, onRequest }: { event: UpcomingEvent; onRequest: () => void }) {
  return (
    <View style={styles.playerEventRow}>
      <View style={styles.dateChip}>
        <Text style={styles.dateWeekday}>{event.weekday}</Text>
        <Text style={styles.dateDay}>{event.day}</Text>
        <Text style={styles.dateMonth}>{event.month}</Text>
      </View>
      <View style={styles.playerEventInfo}>
        <Text style={styles.playerEventOpponent} numberOfLines={1}>{event.opponent}</Text>
        <Text style={styles.playerEventMeta}>{event.venue} · {event.time}</Text>
        {event.myResponse === 'out' && (
          <View style={styles.outPill}>
            <Text style={styles.outPillText}>You're out</Text>
          </View>
        )}
      </View>
      <Pressable
        style={({ pressed }) => [styles.requestSubBtn, pressed && { opacity: 0.75 }]}
        onPress={onRequest}
      >
        <Text style={styles.requestSubBtnText}>Request sub</Text>
      </Pressable>
    </View>
  );
}

function PlayerOwnRequestRow({ request }: { request: SubRequest }) {
  const cfg: Record<SubStatus, { label: string; bg: string; text: string }> = {
    pending:   { label: 'Pending',   bg: statusColors.alert.subtle,   text: statusColors.alert.pure   },
    filled:    { label: 'Filled',    bg: statusColors.success.subtle, text: statusColors.success.pure },
    cancelled: { label: 'Cancelled', bg: 'rgba(95,107,133,0.14)',     text: navy[300]                 },
  };
  const s = cfg[request.status];

  return (
    <View style={styles.ownRequestRow}>
      <View style={styles.ownRequestInfo}>
        <Text style={styles.ownRequestGame} numberOfLines={1}>{request.opponent}</Text>
        <Text style={styles.ownRequestMeta}>
          {request.gameWeekday} {request.gameDay} {request.gameMonth} · {request.gameTime}
        </Text>
        {request.reason != null && (
          <Text style={styles.ownRequestReason} numberOfLines={1}>"{request.reason}"</Text>
        )}
      </View>
      <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
        <Text style={[styles.statusPillText, { color: s.text }]}>{s.label}</Text>
      </View>
    </View>
  );
}

function RequestSubSheet({
  event, note, onChangeNote, onSubmit, onClose,
}: {
  event: UpcomingEvent;
  note: string;
  onChangeNote: (t: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
          <Pressable onPress={() => {}}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Request a sub</Text>

              {/* Game summary */}
              <View style={styles.sheetGameCard}>
                <Text style={styles.sheetGameOpponent}>{event.opponent}</Text>
                <Text style={styles.sheetGameMeta}>
                  {event.weekday} {event.day} {event.month} · {event.time}
                </Text>
                <Text style={styles.sheetGameVenue}>{event.venue}</Text>
              </View>

              {/* Optional note */}
              <View style={styles.noteWrap}>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={onChangeNote}
                  placeholder="Add a reason (optional)"
                  placeholderTextColor={navy[400]}
                  multiline
                  maxLength={140}
                  textAlignVertical="top"
                />
              </View>

              <Pressable
                style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
                onPress={onSubmit}
              >
                <Text style={styles.submitBtnText}>Send request to manager</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function PlayerAvatar({ initials }: { initials: string }) {
  return (
    <View style={styles.playerAvatar}>
      <Text style={styles.playerAvatarText}>{initials}</Text>
    </View>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  Styles                                                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const statusColors = status;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[800],
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[8],
  },

  // ── Nav header ────────────────────────────────────────────────────────────
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
    paddingBottom: spacing[10],
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    minWidth: 60,
  },
  backBtnText: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
    color: TEAM[300],
  },
  navCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  navTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  navSpacer: {
    minWidth: 60,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: TEAM.on,
  },

  // ── Section label ─────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: navy[400],
    marginTop: spacing[20],
    marginBottom: spacing[8],
  },

  // ── Card wrapper ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: navy[700],
    borderRadius: radius.l,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },

  // ── Row divider ───────────────────────────────────────────────────────────
  rowDivider: {
    height: 0.5,
    backgroundColor: navy[600],
    marginLeft: spacing[16],
  },

  // ── Player avatar (shared) ────────────────────────────────────────────────
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TEAM[700],
    borderWidth: 1.5,
    borderColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playerAvatarText: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: TEAM[100],
  },

  // ── Manager open request row ──────────────────────────────────────────────
  requestRow: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    gap: spacing[12],
  },
  requestTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[12],
  },
  requestInfo: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[6],
  },
  playerName: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  playerJersey: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: navy[400],
  },
  gameMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    flexWrap: 'wrap',
  },
  gameDate: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: navy[400],
    letterSpacing: 0.3,
  },
  gameSep: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: navy[500],
  },
  gameOpponent: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: navy[200],
  },
  requestReason: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: navy[300],
    fontStyle: 'italic',
  },
  findSubBtn: {
    height: 40,
    borderRadius: radius.m,
    backgroundColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TEAM[500],
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 6,
    elevation: 3,
  },
  findSubBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    fontWeight: '600',
    color: TEAM.on,
  },

  // ── Filled requests (collapsed toggle) ───────────────────────────────────
  filledToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[4],
    marginTop: spacing[12],
    borderTopWidth: 0.5,
    borderTopColor: navy[600],
  },
  filledToggleLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: navy[400],
  },
  filledChevron: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 22,
    color: navy[400],
    transform: [{ rotate: '90deg' }],
  },
  filledChevronOpen: {
    transform: [{ rotate: '270deg' }],
  },
  filledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    gap: spacing[12],
  },
  filledByBlock: {
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  filledByLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: navy[400],
  },
  filledByName: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: statusColors.success.pure,
  },

  // ── Spare fee caption ─────────────────────────────────────────────────────
  spareNote: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: navy[400],
    textAlign: 'center',
    marginTop: spacing[24],
    letterSpacing: 0.3,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing[48],
    paddingHorizontal: spacing[32],
    gap: spacing[8],
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: navy[300],
    textAlign: 'center',
  },

  // ── Player event row ──────────────────────────────────────────────────────
  playerEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
    gap: spacing[12],
  },
  dateChip: {
    width: 48,
    paddingVertical: 8,
    borderRadius: radius.s,
    backgroundColor: TEAM[700],
    alignItems: 'center',
    gap: 1,
    flexShrink: 0,
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
    fontSize: 18,
    lineHeight: 22,
    color: '#FFFFFF',
  },
  dateMonth: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.2,
    color: TEAM[300],
  },
  playerEventInfo: {
    flex: 1,
    gap: 2,
  },
  playerEventOpponent: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  playerEventMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: navy[400],
  },
  outPill: {
    alignSelf: 'flex-start',
    marginTop: 3,
    paddingHorizontal: spacing[6],
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: statusColors.error.subtle,
  },
  outPillText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: statusColors.error.pure,
  },
  requestSubBtn: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.55)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.12)`,
  },
  requestSubBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    color: TEAM[300],
  },

  // ── Player own request row ────────────────────────────────────────────────
  ownRequestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    gap: spacing[12],
  },
  ownRequestInfo: {
    flex: 1,
    gap: 2,
  },
  ownRequestGame: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: navy[100],
  },
  ownRequestMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: navy[400],
  },
  ownRequestReason: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: navy[400],
    fontStyle: 'italic',
  },
  statusPill: {
    paddingHorizontal: spacing[8],
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  statusPillText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Bottom sheet (shared) ─────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.60)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: navy[700],
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing[12],
    paddingHorizontal: spacing[20],
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: navy[500],
    alignSelf: 'center',
    marginBottom: spacing[20],
  },
  sheetTitle: {
    ...T.headingL,
    color: '#FFFFFF',
    marginBottom: spacing[4],
  },
  sheetSub: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: navy[300],
    letterSpacing: 0.3,
    marginBottom: spacing[20],
  },

  // ── Find sub sheet — spare list ───────────────────────────────────────────
  spareList: {
    backgroundColor: navy[800],
    borderRadius: radius.m,
    borderWidth: 0.5,
    borderColor: navy[600],
    marginBottom: spacing[14],
    overflow: 'hidden',
  },
  spareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
    gap: spacing[12],
  },
  spareAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: navy[600],
    borderWidth: 1,
    borderColor: navy[500],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  spareAvatarText: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    color: navy[200],
  },
  spareInfo: {
    flex: 1,
    gap: 2,
  },
  spareName: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  spareMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: navy[400],
  },
  inviteBtn: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[6],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.55)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.12)`,
  },
  inviteBtnSent: {
    borderColor: `rgba(${hexToRgbVals(statusColors.success.pure)}, 0.40)`,
    backgroundColor: statusColors.success.subtle,
  },
  inviteBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: TEAM[300],
  },
  inviteBtnTextSent: {
    color: statusColors.success.pure,
  },
  spareFeeCaption: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: navy[400],
    textAlign: 'center',
    marginBottom: spacing[8],
    letterSpacing: 0.3,
  },

  // ── Request sub sheet ─────────────────────────────────────────────────────
  sheetGameCard: {
    backgroundColor: navy[800],
    borderRadius: radius.m,
    borderWidth: 0.5,
    borderColor: navy[600],
    padding: spacing[14],
    marginBottom: spacing[16],
    gap: spacing[4],
  },
  sheetGameOpponent: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  sheetGameMeta: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: TEAM[300],
    letterSpacing: 0.3,
  },
  sheetGameVenue: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: navy[300],
  },
  noteWrap: {
    backgroundColor: navy[800],
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: navy[600],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
    minHeight: 80,
    marginBottom: spacing[16],
  },
  noteInput: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    minHeight: 56,
  },
  submitBtn: {
    height: 52,
    borderRadius: radius.l,
    backgroundColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[8],
    shadowColor: TEAM[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    fontWeight: '700',
    color: TEAM.on,
  },

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: {
    position: 'absolute',
    left: spacing[20],
    right: spacing[20],
    backgroundColor: navy[700],
    borderRadius: radius.pill,
    borderWidth: 0.5,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[20],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  toastText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
