// Roster screen — B-07 Manager Roster / C-07 Player Roster.
// Flip IS_MANAGER to preview each view. Replace with auth role when Firebase is wired.

const IS_MANAGER = true;

import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navy, teams, status, fonts, type as T, spacing, radius } from '../theme';

type PlayerRole = 'manager' | 'player';
type TrendDot = 'in' | 'out' | 'maybe' | null;

interface RosterPlayer {
  id: string;
  name: string;
  initials: string;
  jersey: number;
  role: PlayerRole;
  trend: [TrendDot, TrendDot, TrendDot];
}

const TEAM = teams.trashdogs;

const ROSTER_DATA: RosterPlayer[] = [
  { id: 'r1',  name: 'Pat Normandin',    initials: 'PN', jersey: 17, role: 'manager', trend: ['in',    'in',    'in']    },
  { id: 'r2',  name: 'Marco Beauchamp',  initials: 'MB', jersey: 29, role: 'player',  trend: ['in',    'out',   'in']    },
  { id: 'r3',  name: 'Sophie Tremblay',  initials: 'ST', jersey:  7, role: 'player',  trend: ['in',    'in',    'maybe'] },
  { id: 'r4',  name: 'Jake Kowalski',    initials: 'JK', jersey: 44, role: 'player',  trend: ['out',   'out',   'in']    },
  { id: 'r5',  name: 'Lena Bergström',   initials: 'LB', jersey: 13, role: 'player',  trend: ['in',    'maybe', 'in']    },
  { id: 'r6',  name: 'Tyler MacPherson', initials: 'TM', jersey: 88, role: 'player',  trend: ['in',    'in',    'in']    },
  { id: 'r7',  name: 'Nina Petrov',      initials: 'NP', jersey:  3, role: 'player',  trend: [null,    'in',    'out']   },
  { id: 'r8',  name: 'Chris Fontaine',   initials: 'CF', jersey: 21, role: 'player',  trend: ['in',    'in',    'maybe'] },
  { id: 'r9',  name: 'Sam Delacroix',    initials: 'SD', jersey: 67, role: 'player',  trend: ['maybe', 'in',    'in']    },
  { id: 'r10', name: 'Mia Korhonen',     initials: 'MK', jersey: 11, role: 'player',  trend: ['in',    null,    'in']    },
];

// ─── Root export ──────────────────────────────────────────────────────────────

export default function RosterScreen() {
  return IS_MANAGER ? <ManagerRosterScreen /> : <PlayerRosterScreen />;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  B-07 · Manager Roster                                                   ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function ManagerRosterScreen() {
  const insets = useSafeAreaInsets();
  const [roster, setRoster] = useState<RosterPlayer[]>(ROSTER_DATA);
  const [activeId, setActiveId] = useState<string | null>(null);

  const toggleActive = (id: string) =>
    setActiveId(prev => (prev === id ? null : id));

  const removePlayer = (id: string) => {
    setRoster(prev => prev.filter(p => p.id !== id));
    setActiveId(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <RosterHeader isManager />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setActiveId(null)}
      >
        {roster.map(player => (
          <PlayerRow
            key={player.id}
            player={player}
            isActive={activeId === player.id}
            onLongPress={() => toggleActive(player.id)}
            onRemove={() => removePlayer(player.id)}
            onDismiss={() => setActiveId(null)}
          />
        ))}
        <Text style={styles.countCaption}>
          {roster.length} player{roster.length !== 1 ? 's' : ''}
        </Text>
      </ScrollView>
    </View>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  C-07 · Player Roster                                                    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function PlayerRosterScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <RosterHeader isManager={false} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {ROSTER_DATA.map(player => (
          <PlayerRow key={player.id} player={player} />
        ))}
        <Text style={styles.countCaption}>{ROSTER_DATA.length} players</Text>
      </ScrollView>
    </View>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function RosterHeader({ isManager }: { isManager: boolean }) {
  return (
    <View style={styles.header}>
      <View style={styles.teamPill}>
        <View style={styles.teamDot} />
        <Text style={styles.teamName}>TRASHDOGS</Text>
      </View>
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Roster</Text>
        {isManager && (
          <Pressable
            style={({ pressed }) => [styles.inviteBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.inviteBtnText}>+ Invite</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Player row ───────────────────────────────────────────────────────────────

function PlayerRow({
  player,
  isActive = false,
  onLongPress,
  onRemove,
  onDismiss,
}: {
  player: RosterPlayer;
  isActive?: boolean;
  onLongPress?: () => void;
  onRemove?: () => void;
  onDismiss?: () => void;
}) {
  const canRemove = !!onRemove;

  return (
    <Pressable
      onLongPress={canRemove ? onLongPress : undefined}
      delayLongPress={400}
      style={[styles.rowOuter, isActive && styles.rowOuterActive]}
    >
      {/* Main content */}
      <View style={styles.rowMain}>
        <PlayerAvatar player={player} />
        <View style={styles.rowInfo}>
          <View style={styles.rowTop}>
            <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
            <Text style={styles.jerseyNum}>#{player.jersey}</Text>
          </View>
          <View style={styles.rowBottom}>
            <RolePill role={player.role} />
            <TrendDots trend={player.trend} />
          </View>
        </View>
      </View>

      {/* Action strip — revealed on long-press (manager only) */}
      {isActive && canRemove && (
        <View style={styles.actionStrip}>
          <Pressable
            style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.75 }]}
            onPress={onRemove}
          >
            <Text style={styles.removeBtnText}>Remove from team</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            onPress={onDismiss}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function PlayerAvatar({ player }: { player: RosterPlayer }) {
  const isManager = player.role === 'manager';
  return (
    <View style={[styles.avatar, isManager ? styles.avatarManager : styles.avatarPlayer]}>
      <Text style={[styles.avatarInitials, isManager && styles.avatarInitialsManager]}>
        {player.initials}
      </Text>
    </View>
  );
}

// ─── Role pill ────────────────────────────────────────────────────────────────

function RolePill({ role }: { role: PlayerRole }) {
  const isManager = role === 'manager';
  return (
    <View style={[styles.rolePill, isManager ? styles.rolePillManager : styles.rolePillPlayer]}>
      <Text style={[styles.rolePillText, isManager ? styles.rolePillTextManager : styles.rolePillTextPlayer]}>
        {isManager ? 'Manager' : 'Player'}
      </Text>
    </View>
  );
}

// ─── Trend dots ───────────────────────────────────────────────────────────────

const TREND_COLORS: Record<NonNullable<TrendDot>, string> = {
  in:    status.success.pure,
  out:   status.error.pure,
  maybe: status.alert.pure,
};

function TrendDots({ trend }: { trend: RosterPlayer['trend'] }) {
  return (
    <View style={styles.trendRow}>
      {trend.map((dot, i) => (
        <View
          key={i}
          style={[
            styles.trendDot,
            { backgroundColor: dot ? TREND_COLORS[dot] : navy[500] },
          ]}
        />
      ))}
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

  // ── Header ───────────────────────────────────────────────────────────────
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
  inviteBtn: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[6],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.55)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
  },
  inviteBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: TEAM[300],
  },

  // ── Scroll ───────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[4],
    paddingBottom: spacing[32],
  },

  // ── Row card ─────────────────────────────────────────────────────────────
  rowOuter: {
    backgroundColor: navy[700],
    borderRadius: radius.m,
    marginBottom: spacing[8],
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  rowOuterActive: {
    borderColor: `rgba(${hexToRgbVals(status.error.pure)}, 0.35)`,
    backgroundColor: `rgba(${hexToRgbVals(status.error.pure)}, 0.04)`,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[14],
  },
  rowInfo: {
    flex: 1,
    gap: spacing[6],
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  playerName: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    marginRight: spacing[8],
  },
  jerseyNum: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: navy[400],
    letterSpacing: 0.3,
  },

  // ── Avatar ────────────────────────────────────────────────────────────────
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarPlayer: {
    backgroundColor: TEAM[700],
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.28)`,
  },
  avatarManager: {
    backgroundColor: TEAM[500],
  },
  avatarInitials: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    fontWeight: '700',
    color: TEAM[300],
  },
  avatarInitialsManager: {
    color: '#FFFFFF',
  },

  // ── Role pill ─────────────────────────────────────────────────────────────
  rolePill: {
    paddingHorizontal: spacing[8],
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  rolePillManager: {
    backgroundColor: TEAM[900],
    borderWidth: 0.5,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.32)`,
  },
  rolePillPlayer: {
    backgroundColor: navy[600],
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  rolePillText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  rolePillTextManager: {
    color: TEAM[300],
  },
  rolePillTextPlayer: {
    color: navy[400],
  },

  // ── Trend dots ────────────────────────────────────────────────────────────
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: spacing[4],
  },
  trendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  // ── Action strip ──────────────────────────────────────────────────────────
  actionStrip: {
    flexDirection: 'row',
    gap: spacing[8],
    paddingHorizontal: spacing[14],
    paddingBottom: spacing[12],
    paddingTop: spacing[4],
  },
  removeBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.s,
    backgroundColor: status.error.subtle,
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(status.error.pure)}, 0.38)`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: status.error.light,
  },
  cancelBtn: {
    paddingHorizontal: spacing[16],
    height: 40,
    borderRadius: radius.s,
    backgroundColor: navy[600],
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    fontWeight: '500',
    color: navy[300],
  },

  // ── Footer count ──────────────────────────────────────────────────────────
  countCaption: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.0,
    color: navy[400],
    textAlign: 'center',
    marginTop: spacing[4],
    paddingBottom: spacing[8],
  },
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
