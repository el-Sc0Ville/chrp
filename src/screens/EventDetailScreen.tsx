// B-03 / C-03 · Event Detail
// Flip IS_MANAGER to preview each role's view.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, TouchableOpacity, Modal,
  TextInput, KeyboardAvoidingView, Platform, Linking, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { navy, teams, status, fonts, type as T, spacing, radius } from '../theme';
import { doc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserContext } from '../context/UserContext';
import { useScores, scoreResult, type Score } from '../context/ScoreContext';
import { useEvents } from '../firebase/hooks/useEvents';
import { useMembers } from '../firebase/hooks/useMembers';
import { useResponses } from '../firebase/hooks/useResponses';
import type { Event as FirestoreEvent } from '../firebase/schema';

const TEAM = teams.trashdogs;

// TODO Phase 2b: get teamId from user profile
const TEAM_ID = 'trashdogs';

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

// ─── Toggle config ────────────────────────────────────────────────────────────

const TOGGLE_OPTS: { id: NonNullable<PlayerResponse>; label: string; glyph: string }[] = [
  { id: 'in',    label: "I'm in", glyph: '✓' },
  { id: 'out',   label: 'Out',    glyph: '✕' },
  { id: 'maybe', label: 'Maybe',  glyph: '?' },
];

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
  const { scores, setScore } = useScores();
  const score = scores[eventId];
  const [scoreSheetVisible, setScoreSheetVisible] = useState(false);

  const handleSaveScore = async (s: Score) => {
    setScore(eventId, s);
    try {
      await updateDoc(doc(db, 'teams', TEAM_ID, 'events', eventId), {
        scoreUs: s.us, scoreThem: s.them,
      });
    } catch (err) {
      console.error('[EventDetail] score write failed:', err);
    }
  };

  // TODO Phase 2b: get teamId from user profile
  const { events } = useEvents(TEAM_ID);
  const { members } = useMembers(TEAM_ID);
  const { responses } = useResponses(TEAM_ID, eventId);
  const event = events.find(e => e.id === eventId) ?? null;

  const [groups, setGroups] = useState<Record<GroupKey, Player[]>>({
    in: [], out: [], maybe: [], noResp: [],
  });
  const [editTarget, setEditTarget] = useState<{ player: Player; fromGroup: GroupKey } | null>(null);

  useEffect(() => {
    if (members.length === 0) return;
    const g: Record<GroupKey, Player[]> = { in: [], out: [], maybe: [], noResp: [] };
    members.forEach(m => {
      const r = responses[m.userId];
      const p: Player = { id: m.userId, name: m.displayName, jersey: m.jerseyNumber };
      if      (r === 'in')    g.in.push(p);
      else if (r === 'out')   g.out.push(p);
      else if (r === 'maybe') g.maybe.push(p);
      else                    g.noResp.push(p);
    });
    setGroups(g);
  }, [members, responses]);

  const markAs = (toGroup: 'in' | 'out' | 'maybe') => {
    if (!editTarget) return;
    const { player, fromGroup } = editTarget;
    setGroups(prev => {
      const from = prev[fromGroup].filter(p => p.id !== player.id);
      const to   = [...prev[toGroup], { ...player, respondedAt: 'just now' }];
      return { ...prev, [fromGroup]: from, [toGroup]: to };
    });
    setEditTarget(null);
    // TODO Phase 2: write availability override to Firestore with manager attribution
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <NavHeader onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[48] }}
      >
        <EventSummary event={event} fallbackTitle={fallbackTitle} score={score} />

        {isPast && (
          <View style={styles.scoreActionRow}>
            <Pressable
              style={({ pressed }) => [styles.enterScoreBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setScoreSheetVisible(true)}
            >
              <Text style={styles.enterScoreBtnText}>
                {score ? 'Edit score' : '+ Enter score'}
              </Text>
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
          />
        </View>

        {!isPast && (
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.cancelBtnText}>Cancel event</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <ScoreSheet
        visible={scoreSheetVisible}
        initial={score}
        onSave={handleSaveScore}
        onClose={() => setScoreSheetVisible(false)}
      />
      <AvailEditSheet
        visible={editTarget !== null}
        player={editTarget?.player ?? null}
        onMark={markAs}
        onClose={() => setEditTarget(null)}
      />
    </View>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  C-03 · Player Event Detail                                              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function PlayerEventDetail() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<EventDetailNavProp>();
  const route = useRoute<EventDetailRouteProp>();
  const { title: fallbackTitle, eventId, isPast = false } = route.params;
  const { user } = useUserContext();
  const { scores } = useScores();
  const score = scores[eventId];

  // TODO Phase 2b: get teamId from user profile
  const { events }                       = useEvents(TEAM_ID);
  const { members }                      = useMembers(TEAM_ID);
  const { responses: firestoreResponses } = useResponses(TEAM_ID, eventId);
  const event = events.find(e => e.id === eventId) ?? null;

  const uid      = user?.uid ?? 'anon';
  const response: PlayerResponse = (firestoreResponses[uid] as PlayerResponse) ?? null;

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

  const handleRespond = async (r: NonNullable<PlayerResponse>) => {
    if (!event) return;
    if (r === 'out' || r === 'maybe') setSubSheetVisible(true);
    const responseRef = doc(db, 'teams', TEAM_ID, 'events', event.id, 'responses', uid);
    try {
      await setDoc(responseRef, {
        userId:       uid,
        displayName:  user?.displayName ?? user?.email ?? 'Player',
        response:     r,
        respondedAt:  Timestamp.now(),
        setByManager: false,
      });
    } catch (err) {
      console.error('[EventDetail] response write failed:', err);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <NavHeader onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[48] }}
      >
        <EventSummary event={event} fallbackTitle={fallbackTitle} score={score} />

        {!isPast && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Are you in?</Text>
              <InOutMaybeToggle response={response} onRespond={handleRespond} />
            </View>
            <View style={styles.sectionDivider} />
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Availability</Text>
          <AvailGroup label="In"    dotColor={status.success.pure} players={availGroups.in} />
          <AvailGroup label="Out"   dotColor={status.error.pure}   players={availGroups.out} />
          <AvailGroup label="Maybe" dotColor={status.alert.pure}   players={availGroups.maybe} />
        </View>

        {!isPast && (
          <View style={styles.footer}>
            <Pressable style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.75 }]}>
              <Text style={styles.ghostBtnText}>Add to calendar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.75 }]}
              onPress={() => navigation.navigate('Subs')}
            >
              <Text style={styles.ghostBtnText}>Need a sub?</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <SubRequestSheet
        visible={subSheetVisible}
        gameName={event?.title ?? fallbackTitle}
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

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  Shared components                                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// ─── Nav header ───────────────────────────────────────────────────────────────

function NavHeader({ onBack }: { onBack: () => void }) {
  const { isManager } = useUserContext();
  return (
    <View style={styles.navHeader}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        hitSlop={12}
      >
        <Text style={styles.backChevron}>‹</Text>
        <Text style={styles.backLabel}>Schedule</Text>
      </Pressable>
      {isManager && (
        <Pressable hitSlop={12}>
          <Text style={styles.editLabel}>Edit</Text>
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

function EventSummary({ event, fallbackTitle, score }: {
  event: FirestoreEvent | null;
  fallbackTitle: string;
  score?: Score;
}) {
  const title     = event?.title   ?? fallbackTitle;
  const typeBadge = (event?.type   ?? 'game').toUpperCase();
  const venue     = event?.venue   ?? 'TBD';
  const dateStr   = event ? formatEventDate(event.startsAt) : '';
  const timeStr   = event ? formatEventTime(event.startsAt) : '';

  return (
    <View style={styles.eventSummary}>
      <View style={styles.teamPill}>
        <View style={styles.teamDot} />
        <Text style={styles.teamPillText}>TRASHDOGS</Text>
      </View>

      <View style={styles.kindBadge}>
        <Text style={styles.kindBadgeText}>{typeBadge}</Text>
      </View>

      <Text style={styles.eventName} numberOfLines={2}>{title}</Text>

      {(dateStr || timeStr) && (
        <View style={styles.dateTimeRow}>
          {dateStr ? <Text style={styles.dateText}>{dateStr}</Text> : null}
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

      {score && (
        <View style={styles.scoreBlock}>
          <View style={styles.scoreNumbers}>
            <Text style={styles.scoreNum}>{score.us}</Text>
            <Text style={styles.scoreSep}>–</Text>
            <Text style={styles.scoreNum}>{score.them}</Text>
          </View>
          <ResultPill us={score.us} them={score.them} />
        </View>
      )}
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
                !hasValues && styles.saveScoreBtnDisabled,
                pressed && hasValues && { opacity: 0.85 },
              ]}
              onPress={hasValues ? () => { onSave({ us: usNum, them: themNum }); onClose(); } : undefined}
            >
              <Text style={[styles.saveScoreBtnText, !hasValues && styles.saveScoreBtnTextDisabled]}>
                Save score
              </Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Availability group (collapsible) ─────────────────────────────────────────

function AvailGroup({
  label, dotColor, players, showRemind = false, onEditPlayer,
}: {
  label: string;
  dotColor: string;
  players: Player[];
  showRemind?: boolean;
  onEditPlayer?: (player: Player) => void;
}) {
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
            <TouchableOpacity style={styles.remindInlineBtn} hitSlop={8}>
              <Text style={styles.remindInlineText}>Remind</Text>
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
  return (
    <View style={styles.playerRow}>
      <View style={styles.jerseyBadge}>
        <Text style={styles.jerseyText}>#{player.jersey}</Text>
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

// ─── In / Out / Maybe toggle (player only) ────────────────────────────────────

function InOutMaybeToggle({
  response, onRespond,
}: {
  response: PlayerResponse;
  onRespond: (r: NonNullable<PlayerResponse>) => void;
}) {
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
            onPress={() => onRespond(opt.id)}
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
