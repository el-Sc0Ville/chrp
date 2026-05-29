// Gameday screen — B-10 · live arrival tracker for tonight's game.
// All users see the same view; IS_MANAGER gates the "Message latecomers" button.
// TODO Phase 2: replace hardcoded arrival data with real geofence listener via expo-location.

const IS_MANAGER = true;

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Animated, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navy, teams, status, fonts, type as T, spacing, radius } from '../theme';

const TEAM = teams.trashdogs;

// TODO Phase 2: check real expo-location permission; prompt if not granted
const locationGranted = true;

// Hardcoded event — mirrors HomeScreen hero card data
const TONIGHT_GAME = {
  opponent: 'Ice Sharks',
  venue:    'The Barn — Rink 2',
  time:     '7:30 pm',
  // TODO Phase 2: use these coordinates for the expo-location geofence (~200 m radius)
  arenaLat: 45.5231,
  arenaLng: -73.5887,
};

type ArrivalStatus = 'arrived' | 'on-way' | 'not-responded';

interface GamedayPlayer {
  id: string;
  name: string;
  initials: string;
  jersey: number;
  arrivalStatus: ArrivalStatus;
  arrivedMinutesAgo?: number; // populated only for 'arrived' players
}

// TODO Phase 2: replace with live geofence state; sort arrived by arrivedAt timestamp
const GAMEDAY_PLAYERS: GamedayPlayer[] = [
  { id: 'r6',  name: 'Tyler MacPherson', initials: 'TM', jersey: 88, arrivalStatus: 'arrived',      arrivedMinutesAgo: 2 },
  { id: 'r1',  name: 'Pat Normandin',    initials: 'PN', jersey: 17, arrivalStatus: 'arrived',      arrivedMinutesAgo: 4 },
  { id: 'r3',  name: 'Sophie Tremblay',  initials: 'ST', jersey:  7, arrivalStatus: 'arrived',      arrivedMinutesAgo: 7 },
  { id: 'r2',  name: 'Marco Beauchamp',  initials: 'MB', jersey: 29, arrivalStatus: 'on-way'                             },
  { id: 'r5',  name: 'Lena Bergström',   initials: 'LB', jersey: 13, arrivalStatus: 'on-way'                             },
  { id: 'r4',  name: 'Jake Kowalski',    initials: 'JK', jersey: 44, arrivalStatus: 'on-way'                             },
  { id: 'r8',  name: 'Chris Fontaine',   initials: 'CF', jersey: 21, arrivalStatus: 'on-way'                             },
  { id: 'r7',  name: 'Nina Petrov',      initials: 'NP', jersey:  3, arrivalStatus: 'not-responded'                      },
  { id: 'r9',  name: 'Sam Delacroix',    initials: 'SD', jersey: 67, arrivalStatus: 'not-responded'                      },
  { id: 'r10', name: 'Mia Korhonen',     initials: 'MK', jersey: 11, arrivalStatus: 'not-responded'                      },
];

// ─── Root export ──────────────────────────────────────────────────────────────

export default function GamedayScreen() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const arrived      = GAMEDAY_PLAYERS.filter(p => p.arrivalStatus === 'arrived');
  const onWay        = GAMEDAY_PLAYERS.filter(p => p.arrivalStatus === 'on-way');
  const notResponded = GAMEDAY_PLAYERS.filter(p => p.arrivalStatus === 'not-responded');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
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

        {/* Location permission banner — rendered only when not granted */}
        {!locationGranted && (
          <View style={styles.locationBanner}>
            <Text style={styles.locationBannerIcon}>📍</Text>
            <Text style={styles.locationBannerText}>
              Enable location so teammates can see when you've arrived at the rink
            </Text>
          </View>
        )}

        {/* ── Game card ── */}
        <View style={styles.gameCard}>
          <View style={styles.gameCardTop}>
            <View style={styles.tonightPill}>
              <Text style={styles.tonightPillText}>Tonight</Text>
            </View>
            <View style={styles.atVenueBadge}>
              <View style={styles.atVenueDot} />
              <Text style={styles.atVenueText}>{arrived.length} at venue</Text>
            </View>
          </View>
          <Text style={styles.opponentText}>vs. {TONIGHT_GAME.opponent}</Text>
          <View style={styles.gameMetaRow}>
            <Text style={styles.gameTime}>{TONIGHT_GAME.time}</Text>
            <Text style={styles.gameMetaSep}>·</Text>
            <Text style={styles.gameVenue}>📍 {TONIGHT_GAME.venue}</Text>
          </View>
        </View>

        {/* ── Who's here ── */}
        <SectionHeader label="Who's here" count={arrived.length} pulse />
        <View style={styles.card}>
          {arrived.map((player, idx) => (
            <React.Fragment key={player.id}>
              {idx > 0 && <View style={styles.rowDivider} />}
              <PlayerRow player={player} variant="arrived" />
            </React.Fragment>
          ))}
        </View>

        {/* ── On their way ── */}
        <SectionHeader
          label="On their way"
          count={onWay.length}
          rightAction={IS_MANAGER ? (
            <Pressable
              style={({ pressed }) => [styles.latecomersBtn, pressed && { opacity: 0.6 }]}
              onPress={() => showToast('Coming in V2')}
            >
              <Text style={styles.latecomersBtnText}>Message latecomers</Text>
            </Pressable>
          ) : null}
        />
        <View style={styles.card}>
          {onWay.map((player, idx) => (
            <React.Fragment key={player.id}>
              {idx > 0 && <View style={styles.rowDivider} />}
              <PlayerRow player={player} variant="on-way" />
            </React.Fragment>
          ))}
        </View>

        {/* ── Not responded ── */}
        <SectionHeader label="Not responded" count={notResponded.length} />
        <View style={styles.card}>
          {notResponded.map((player, idx) => (
            <React.Fragment key={player.id}>
              {idx > 0 && <View style={styles.rowDivider} />}
              <PlayerRow player={player} variant="not-responded" />
            </React.Fragment>
          ))}
        </View>

      </ScrollView>

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

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  Sub-components                                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// ─── Section header with optional pulse dot and optional right action ─────────

function SectionHeader({
  label, count, pulse, rightAction,
}: {
  label: string;
  count: number;
  pulse?: boolean;
  rightAction?: React.ReactNode;
}) {
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
        {pulse && (
          <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
        )}
        <Text style={styles.sectionLabelText}>{label}</Text>
        <View style={styles.sectionCountPill}>
          <Text style={styles.sectionCountText}>{count}</Text>
        </View>
      </View>
      {rightAction ?? null}
    </View>
  );
}

// ─── Player row — three variants ──────────────────────────────────────────────

function PlayerRow({ player, variant }: { player: GamedayPlayer; variant: ArrivalStatus }) {
  const dim = variant === 'not-responded';
  return (
    <View style={styles.playerRow}>
      <View style={[styles.avatar, dim && styles.avatarDim]}>
        <Text style={[styles.avatarText, dim && styles.avatarTextDim]}>{player.initials}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, dim && styles.playerNameDim]}>{player.name}</Text>
        <Text style={[styles.playerJersey, dim && styles.playerJerseyDim]}>#{player.jersey}</Text>
      </View>
      {variant === 'arrived' && (
        <Text style={styles.arrivedText}>✓ {player.arrivedMinutesAgo} min ago</Text>
      )}
      {variant === 'on-way' && (
        <View style={styles.inChip}>
          <View style={styles.inDot} />
          <Text style={styles.inChipText}>In</Text>
        </View>
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
    paddingTop: spacing[16],
    paddingBottom: spacing[14],
  },
  pageTitle: {
    ...T.headingXXL,
    color: '#FFFFFF',
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: spacing[4],
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
  locationBannerIcon: {
    fontSize: 15,
    lineHeight: 20,
  },
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

  // ── Avatar ────────────────────────────────────────────────────────────────
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
  avatarDim: {
    backgroundColor: navy[600],
    borderColor: navy[500],
  },
  avatarText: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: TEAM[100],
  },
  avatarTextDim: {
    color: navy[400],
  },

  // ── Player info ───────────────────────────────────────────────────────────
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
    color: navy[100],
  },
  playerNameDim: {
    color: navy[400],
  },
  playerJersey: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: navy[400],
  },
  playerJerseyDim: {
    color: navy[600],
  },

  // ── Arrived badge ─────────────────────────────────────────────────────────
  arrivedText: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: status.success.pure,
  },

  // ── "In" chip (on-way players) ────────────────────────────────────────────
  inChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[8],
    paddingVertical: 4,
    borderRadius: radius.xs,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.14)`,
  },
  inDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: TEAM[300],
  },
  inChipText: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: TEAM[300],
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
