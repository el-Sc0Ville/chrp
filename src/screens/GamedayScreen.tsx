// Gameday screen — B-10 · geofence-based arrival tracker for tonight's game.
// Same view for all users. IS_MANAGER gates only the "Message latecomers" button.

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Animated, Linking, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import type { RootStackParamList } from '../navigation';
import { navy, teams, status, fonts, type as T, spacing, radius } from '../theme';
import { useUserContext } from '../context/UserContext';
import { useEvents } from '../firebase/hooks/useEvents';
import { useMembers } from '../firebase/hooks/useMembers';
import { useCheckIns } from '../firebase/hooks/useCheckIns';
import { db } from '../firebase/config';
import { GEOFENCE_TASK } from '../tasks/geofenceTask';
import type { Event as FirestoreEvent } from '../firebase/schema';

const TEAM = teams.trashdogs; // StyleSheet fallback

// ─── Root export ──────────────────────────────────────────────────────────────

export default function GamedayScreen() {
  const { isManager, activeTeamId, activeTeamPalette, user } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { events } = useEvents(activeTeamId);
  const { members } = useMembers(activeTeamId);

  const [toast,          setToast]          = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // Find today's game event
  const todaysGame: FirestoreEvent | null = React.useMemo(() => {
    const today = new Date();
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return events.find(e =>
      e.type === 'game' && ymd(e.startsAt.toDate()) === ymd(today),
    ) ?? null;
  }, [events]);

  const checkIns = useCheckIns(activeTeamId, todaysGame?.id ?? null);

  // Start geofence when we have a game with venueCoords
  useEffect(() => {
    const coords = todaysGame?.venueCoords;
    const uid = user?.uid;
    if (!todaysGame || !coords || !uid) return;

    const gameId = todaysGame.id;
    (async () => {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') { setLocationDenied(true); return; }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') { setLocationDenied(true); return; }

      await Promise.all([
        AsyncStorage.setItem('geofence_teamId',      activeTeamId),
        AsyncStorage.setItem('geofence_eventId',     gameId),
        AsyncStorage.setItem('geofence_userId',      uid),
        AsyncStorage.setItem('geofence_displayName', user.displayName ?? 'Player'),
      ]);

      const alreadyRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false);
      if (!alreadyRunning) {
        await Location.startGeofencingAsync(GEOFENCE_TASK, [{
          latitude:   coords.lat,
          longitude:  coords.lng,
          radius:     300,
          identifier: gameId,
        }]).catch(err => console.error('[GamedayScreen] startGeofencing failed:', err));
      }
    })();
  }, [todaysGame?.id, todaysGame?.venueCoords, user?.uid, activeTeamId]);

  const handleManualCheckIn = async () => {
    if (!todaysGame || !user?.uid) return;
    try {
      await setDoc(
        doc(db, 'teams', activeTeamId, 'events', todaysGame.id, 'responses', user.uid),
        { status: 'here', checkedInAt: serverTimestamp() },
        { merge: true },
      );
      showToast("You're checked in!");
    } catch (err) {
      console.error('[GamedayScreen] manual check-in failed:', err);
      showToast('Something went wrong');
    }
  };

  const formatGameTime = (e: FirestoreEvent) => {
    const d = e.startsAt.toDate();
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = d.getHours() >= 12 ? 'pm' : 'am';
    return `${h}:${m} ${ampm}`;
  };

  // Non-spare members split by check-in status
  const nonSpares = members.filter(m => m.role !== 'spare');
  const here   = nonSpares.filter(m => checkIns[m.userId]);
  const notYet = nonSpares.filter(m => !checkIns[m.userId]);
  const myCheckIn = user?.uid ? checkIns[user.uid] : false;

  // ── No game today ────────────────────────────────────────────────────────

  if (!todaysGame) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.pageHeader}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            onPress={() => navigation.goBack()}
            hitSlop={12}
          >
            <Text style={[styles.backChevron, { color: TEAM[300] }]}>‹</Text>
            <Text style={[styles.backBtnText, { color: TEAM[300] }]}>Back</Text>
          </Pressable>
          <Text style={styles.pageTitle}>Gameday</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏒</Text>
          <Text style={styles.emptyTitle}>No game today</Text>
          <Text style={styles.emptyBody}>Check the schedule for your next game.</Text>
        </View>
      </View>
    );
  }

  // ── Game today ───────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Text style={[styles.backChevron, { color: TEAM[300] }]}>‹</Text>
          <Text style={[styles.backBtnText, { color: TEAM[300] }]}>Back</Text>
        </Pressable>
        <Text style={styles.pageTitle}>Gameday</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing[32]) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Location permission banner */}
        {locationDenied && (
          <Pressable
            style={styles.locationBanner}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.locationBannerIcon}>📍</Text>
            <Text style={styles.locationBannerText}>
              Enable location in Settings so Chrp can auto check-in when you arrive
            </Text>
          </Pressable>
        )}

        {/* ── Game card ── */}
        <View style={styles.gameCard}>
          <View style={styles.gameCardTop}>
            <View style={[styles.tonightPill, {
              backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.18)`,
              borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.38)`,
            }]}>
              <Text style={[styles.tonightPillText, { color: TEAM[300] }]}>Tonight</Text>
            </View>
            <View style={styles.atVenueBadge}>
              <View style={styles.atVenueDot} />
              <Text style={styles.atVenueText}>{here.length} at venue</Text>
            </View>
          </View>
          <Text style={styles.opponentText}>{todaysGame.title}</Text>
          <View style={styles.gameMetaRow}>
            <Text style={[styles.gameTime, { color: TEAM[300] }]}>{formatGameTime(todaysGame)}</Text>
            {todaysGame.venue ? (
              <>
                <Text style={styles.gameMetaSep}>·</Text>
                <Pressable
                  style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    const query = todaysGame.venueCoords
                      ? `${todaysGame.venueCoords.lat},${todaysGame.venueCoords.lng}`
                      : encodeURIComponent(todaysGame.venue);
                    Linking.openURL(`https://maps.google.com/?q=${query}`);
                  }}
                >
                  <Text style={styles.gameVenue}>📍 {todaysGame.venue}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        {/* ── Manual check-in button (shown until user is checked in) ── */}
        {!myCheckIn && (
          <Pressable
            style={({ pressed }) => [
              styles.checkInBtn,
              { backgroundColor: TEAM[500], shadowColor: TEAM[500] },
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleManualCheckIn}
          >
            <Text style={[styles.checkInBtnText, { color: TEAM.on }]}>I'm here</Text>
          </Pressable>
        )}

        {/* ── Here ── */}
        <SectionHeader label="Here" count={here.length} pulse />
        {here.length > 0 ? (
          <View style={styles.card}>
            {here.map((member, idx) => (
              <React.Fragment key={member.userId}>
                {idx > 0 && <View style={styles.rowDivider} />}
                <PlayerRow
                  displayName={member.displayName}
                  jerseyNumber={member.jerseyNumber}
                  isHere
                />
              </React.Fragment>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyListText}>No one here yet</Text>
        )}

        {/* ── Not yet ── */}
        <SectionHeader
          label="Not yet"
          count={notYet.length}
          rightAction={isManager ? (
            <Pressable
              style={({ pressed }) => [
                styles.latecomersBtn,
                {
                  borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.45)`,
                  backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
                },
                pressed && { opacity: 0.6 },
              ]}
              onPress={() => showToast('Coming in V2')}
            >
              <Text style={[styles.latecomersBtnText, { color: TEAM[300] }]}>Message latecomers</Text>
            </Pressable>
          ) : null}
        />
        {notYet.length > 0 ? (
          <View style={styles.card}>
            {notYet.map((member, idx) => (
              <React.Fragment key={member.userId}>
                {idx > 0 && <View style={styles.rowDivider} />}
                <PlayerRow
                  displayName={member.displayName}
                  jerseyNumber={member.jerseyNumber}
                  isHere={false}
                />
              </React.Fragment>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyListText}>Everyone's here!</Text>
        )}

      </ScrollView>

      {/* ── Toast ── */}
      {toast !== null && (
        <View
          style={[styles.toast, {
            bottom: Math.max(insets.bottom, spacing[12]) + spacing[16],
            borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`,
          }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  Sub-components                                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function SectionHeader({
  label, count, pulse, rightAction,
}: {
  label: string;
  count: number;
  pulse?: boolean;
  rightAction?: React.ReactNode;
}) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.sectionHeaderWrap}>
      <View style={styles.sectionHeaderLeft}>
        {pulse && <Animated.View style={[styles.pulseDot, { opacity: pulseAnim, backgroundColor: TEAM[300] }]} />}
        <Text style={styles.sectionLabelText}>{label}</Text>
        <View style={styles.sectionCountPill}>
          <Text style={styles.sectionCountText}>{count}</Text>
        </View>
      </View>
      {rightAction ?? null}
    </View>
  );
}

function PlayerRow({
  displayName, jerseyNumber, isHere,
}: {
  displayName: string;
  jerseyNumber: number;
  isHere: boolean;
}) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const parts = displayName.trim().split(' ');
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : displayName.slice(0, 2).toUpperCase();

  return (
    <View style={styles.playerRow}>
      <View style={[styles.avatar, { backgroundColor: TEAM[700], borderColor: TEAM[500] }]}>
        <Text style={[styles.avatarText, { color: TEAM[100] }]}>{initials}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{displayName}</Text>
        <Text style={styles.playerJersey}>#{jerseyNumber}</Text>
      </View>
      {isHere && (
        <Text style={styles.arrivedText}>✓ Here</Text>
      )}
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

  // ── Page header ───────────────────────────────────────────────────────────
  pageHeader: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[10],
    paddingBottom: spacing[14],
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    alignSelf: 'flex-start', marginBottom: spacing[6],
  },
  backChevron: {
    fontFamily: fonts.display, fontSize: 26, lineHeight: 28,
    color: TEAM[300], marginTop: -2,
  },
  backBtnText: { fontFamily: fonts.uiMedium, fontSize: 15, color: TEAM[300] },
  pageTitle: {
    ...T.headingXXL,
    color: '#FFFFFF',
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: spacing[4],
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[12],
    paddingBottom: 80,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 20,
    color: navy[100],
  },
  emptyBody: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: navy[400],
    textAlign: 'center',
  },
  emptyListText: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: navy[500],
    textAlign: 'center',
    paddingVertical: spacing[12],
  },

  // ── Location banner ───────────────────────────────────────────────────────
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[8],
    marginHorizontal: spacing[16],
    marginBottom: spacing[12],
    backgroundColor: `rgba(${hexToRgbVals(status.alert.pure)}, 0.12)`,
    borderRadius: radius.m,
    borderWidth: 0.5,
    borderColor: `rgba(${hexToRgbVals(status.alert.pure)}, 0.35)`,
    padding: spacing[14],
  },
  locationBannerIcon: { fontSize: 15, lineHeight: 20 },
  locationBannerText: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 18,
    color: status.alert.light,
    flex: 1,
  },

  // ── Game card ─────────────────────────────────────────────────────────────
  gameCard: {
    marginHorizontal: spacing[16],
    backgroundColor: navy[700],
    borderRadius: radius.xxl,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
    paddingBottom: spacing[20],
    marginBottom: spacing[4],
  },
  gameCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[10],
  },
  tonightPill: {
    paddingHorizontal: spacing[10],
    paddingVertical: 4,
    borderRadius: radius.xs,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.18)`,
    borderWidth: 0.5,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.38)`,
  },
  tonightPillText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    color: TEAM[300],
  },
  atVenueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  atVenueDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: status.success.pure,
  },
  atVenueText: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: status.success.pure,
  },
  opponentText: {
    ...T.displayS,
    color: '#FFFFFF',
    marginBottom: spacing[8],
  },
  gameMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  gameTime: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: TEAM[300],
  },
  gameMetaSep: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: navy[500],
  },
  gameVenue: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: navy[300],
  },

  // ── Check-in button ───────────────────────────────────────────────────────
  checkInBtn: {
    marginHorizontal: spacing[16],
    marginTop: spacing[12],
    height: 50,
    borderRadius: radius.l,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  checkInBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
  },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
    paddingBottom: spacing[8],
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: TEAM[300],
  },
  sectionLabelText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: navy[400],
  },
  sectionCountPill: {
    paddingHorizontal: spacing[6],
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: navy[600],
  },
  sectionCountText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: navy[300],
  },

  // ── Message latecomers button ─────────────────────────────────────────────
  latecomersBtn: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.45)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
  },
  latecomersBtnText: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: TEAM[300],
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    marginHorizontal: spacing[16],
    backgroundColor: navy[700],
    borderRadius: radius.l,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  rowDivider: {
    height: 0.5,
    backgroundColor: navy[600],
    marginLeft: spacing[16],
  },

  // ── Player row ────────────────────────────────────────────────────────────
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    gap: spacing[12],
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TEAM[700],
    borderWidth: 1.5,
    borderColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: TEAM[100],
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
    color: navy[100],
  },
  playerJersey: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: navy[400],
  },
  arrivedText: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: status.success.pure,
  },

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: {
    position: 'absolute',
    left: spacing[20],
    right: spacing[20],
    backgroundColor: navy[700],
    borderRadius: radius.pill,
    borderWidth: 0.5,
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
