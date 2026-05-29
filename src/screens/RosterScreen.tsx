// Roster screen — B-07 Manager Roster / C-07 Player Roster.
// Flip IS_MANAGER to preview each view. Replace with auth role when Firebase is wired.

const IS_MANAGER = true;

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, Share, StyleSheet,
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
  trend: [TrendDot, TrendDot, TrendDot, TrendDot, TrendDot];
}

const TEAM = teams.trashdogs;

const ROSTER_DATA: RosterPlayer[] = [
  { id: 'r1',  name: 'Pat Normandin',    initials: 'PN', jersey: 17, role: 'manager', trend: ['in',    'in',    'in',    'in',    'in']    },
  { id: 'r2',  name: 'Marco Beauchamp',  initials: 'MB', jersey: 29, role: 'manager', trend: ['in',    'in',    'out',   'in',    'in']    },
  { id: 'r3',  name: 'Sophie Tremblay',  initials: 'ST', jersey:  7, role: 'player',  trend: ['in',    'in',    'in',    'in',    'maybe'] },
  { id: 'r4',  name: 'Jake Kowalski',    initials: 'JK', jersey: 44, role: 'player',  trend: ['out',   'in',    'out',   'out',   'in']    },
  { id: 'r5',  name: 'Lena Bergström',   initials: 'LB', jersey: 13, role: 'player',  trend: ['in',    'in',    'maybe', 'in',    'in']    },
  { id: 'r6',  name: 'Tyler MacPherson', initials: 'TM', jersey: 88, role: 'player',  trend: ['in',    'in',    'in',    'in',    'in']    },
  { id: 'r7',  name: 'Nina Petrov',      initials: 'NP', jersey:  3, role: 'player',  trend: [null,    null,    'in',    'out',   'in']    },
  { id: 'r8',  name: 'Chris Fontaine',   initials: 'CF', jersey: 21, role: 'player',  trend: ['in',    'maybe', 'in',    'in',    'maybe'] },
  { id: 'r9',  name: 'Sam Delacroix',    initials: 'SD', jersey: 67, role: 'player',  trend: ['maybe', 'in',    'in',    'in',    'in']    },
  { id: 'r10', name: 'Mia Korhonen',     initials: 'MK', jersey: 11, role: 'player',  trend: ['in',    null,    'in',    'in',    'in']    },
];

// ─── Root export ──────────────────────────────────────────────────────────────

export default function RosterScreen({ embedded }: { embedded?: boolean }) {
  return IS_MANAGER
    ? <ManagerRosterScreen embedded={embedded} />
    : <PlayerRosterScreen  embedded={embedded} />;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  B-07 · Manager Roster                                                   ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function ManagerRosterScreen({ embedded }: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const [roster, setRoster] = useState<RosterPlayer[]>(ROSTER_DATA);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [actionPlayer, setActionPlayer] = useState<RosterPlayer | null>(null);

  const inviteCode = useMemo(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }, []);

  const makeManager = (id: string) => {
    setRoster(prev => prev.map(p => p.id === id ? { ...p, role: 'manager' as PlayerRole } : p));
    setActionPlayer(null);
  };

  const removePlayer = (id: string) => {
    setRoster(prev => prev.filter(p => p.id !== id));
    setActionPlayer(null);
  };

  const managerCount = roster.filter(p => p.role === 'manager').length;

  return (
    <View style={[styles.container, { paddingTop: embedded ? 0 : insets.top }]}>
      {!embedded && <RosterHeader isManager onInvite={() => setInviteVisible(true)} />}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {roster.map(player => (
          <PlayerRow
            key={player.id}
            player={player}
            onLongPress={() => setActionPlayer(player)}
          />
        ))}
      </ScrollView>
      <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, spacing[12]) }]}>
        <Text style={styles.stickyCount}>
          {roster.length} players · {managerCount} manager{managerCount !== 1 ? 's' : ''}
        </Text>
      </View>

      <InviteSheet
        visible={inviteVisible}
        inviteCode={inviteCode}
        onClose={() => setInviteVisible(false)}
      />
      {actionPlayer && (
        <ActionSheet
          player={actionPlayer}
          canPromote={actionPlayer.role === 'player'}
          onMakeManager={() => makeManager(actionPlayer.id)}
          onRemove={() => removePlayer(actionPlayer.id)}
          onClose={() => setActionPlayer(null)}
        />
      )}
    </View>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  C-07 · Player Roster                                                    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function PlayerRosterScreen({ embedded }: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayer | null>(null);

  const managerCount = ROSTER_DATA.filter(p => p.role === 'manager').length;

  return (
    <View style={[styles.container, { paddingTop: embedded ? 0 : insets.top }]}>
      {!embedded && <RosterHeader isManager={false} />}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {ROSTER_DATA.map(player => (
          <PlayerRow
            key={player.id}
            player={player}
            onPress={() => setSelectedPlayer(player)}
          />
        ))}
      </ScrollView>
      <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, spacing[12]) }]}>
        <Text style={styles.stickyCount}>
          {ROSTER_DATA.length} players · {managerCount} manager{managerCount !== 1 ? 's' : ''}
        </Text>
      </View>

      {selectedPlayer && (
        <ProfileCardModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </View>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function RosterHeader({ isManager, onInvite }: { isManager: boolean; onInvite?: () => void }) {
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
            onPress={onInvite}
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
  onPress,
  onLongPress,
}: {
  player: RosterPlayer;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [styles.rowOuter, pressed && styles.rowPressed]}
    >
      <View style={styles.rowMain}>
        <PlayerAvatar player={player} />
        <View style={styles.rowInfo}>
          <View style={styles.rowTop}>
            <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
            <Text style={styles.jerseyNum}>#{player.jersey}</Text>
          </View>
          <View style={styles.rowBottom}>
            <RolePill role={player.role} />
            <TrendDots trend={player.trend.slice(-3)} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function PlayerAvatar({ player, size = 44 }: { player: RosterPlayer; size?: number }) {
  const isManager = player.role === 'manager';
  return (
    <View style={[
      styles.avatar,
      { width: size, height: size, borderRadius: size / 2 },
      isManager ? styles.avatarManager : styles.avatarPlayer,
    ]}>
      <Text style={[
        styles.avatarInitials,
        { fontSize: Math.round(size * 0.32) },
        isManager && styles.avatarInitialsManager,
      ]}>
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

function TrendDots({ trend, size = 7 }: { trend: TrendDot[]; size?: number }) {
  return (
    <View style={styles.trendRow}>
      {trend.map((dot, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: dot ? TREND_COLORS[dot] : navy[500],
          }}
        />
      ))}
    </View>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  Modals                                                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// ─── Invite bottom sheet ──────────────────────────────────────────────────────

function InviteSheet({
  visible,
  inviteCode,
  onClose,
}: {
  visible: boolean;
  inviteCode: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    Share.share({
      message: `Join Trashdogs on Chrp! Code: ${inviteCode} — https://chrp.app/join/${inviteCode}`,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Invite to Trashdogs</Text>
          <Text style={styles.sheetSub}>Share this code or link with your teammates</Text>

          <View style={styles.inviteCodeBox}>
            <Text style={styles.inviteCodeText}>{inviteCode}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.sheetBtn, styles.sheetBtnGhost, pressed && { opacity: 0.7 }]}
            onPress={handleCopy}
          >
            <Text style={styles.sheetBtnGhostText}>{copied ? '✓ Copied!' : 'Copy invite link'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.sheetBtn, styles.sheetBtnFilled, pressed && { opacity: 0.85 }]}
            onPress={handleShare}
          >
            <Text style={styles.sheetBtnFilledText}>Share</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Long-press action sheet ──────────────────────────────────────────────────

function ActionSheet({
  player,
  canPromote,
  onMakeManager,
  onRemove,
  onClose,
}: {
  player: RosterPlayer;
  canPromote: boolean;
  onMakeManager: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.actionHeader}>
            <PlayerAvatar player={player} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionHeaderName}>{player.name}</Text>
              <Text style={styles.actionHeaderJersey}>#{player.jersey}</Text>
            </View>
          </View>

          <View style={styles.actionDivider} />

          {canPromote && (
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: navy[600] }]}
              onPress={onMakeManager}
            >
              <Text style={styles.actionRowText}>Make Manager</Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: navy[600] }]}
            onPress={onRemove}
          >
            <Text style={[styles.actionRowText, { color: status.error.pure }]}>Remove from team</Text>
          </Pressable>

          <View style={styles.actionDivider} />

          <Pressable
            style={({ pressed }) => [styles.actionRowCancel, pressed && { backgroundColor: navy[600] }]}
            onPress={onClose}
          >
            <Text style={styles.actionRowCancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Player profile card (player view only) ───────────────────────────────────

function ProfileCardModal({ player, onClose }: { player: RosterPlayer; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.cardOverlay} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.profileCard}>
          <PlayerAvatar player={player} size={64} />
          <Text style={styles.cardName}>{player.name}</Text>
          <Text style={styles.cardJersey}>#{player.jersey}</Text>
          <View style={styles.cardPillRow}>
            <RolePill role={player.role} />
          </View>
          <Text style={styles.cardTrendLabel}>Last 5 events</Text>
          <View style={styles.trendRow}>
            <TrendDots trend={player.trend} size={10} />
          </View>
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
    paddingBottom: spacing[16],
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
  rowPressed: {
    backgroundColor: navy[600],
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
  },

  // ── Sticky footer bar ─────────────────────────────────────────────────────
  stickyBar: {
    borderTopWidth: 0.5,
    borderTopColor: navy[600],
    paddingTop: spacing[10],
    paddingHorizontal: spacing[20],
    backgroundColor: navy[800],
  },
  stickyCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.0,
    color: navy[400],
    textAlign: 'center',
  },

  // ── Bottom sheet (shared) ─────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.60)',
  },
  sheet: {
    backgroundColor: navy[700],
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
    borderTopWidth: 0.5,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: navy[500],
    alignSelf: 'center',
    marginBottom: spacing[20],
  },
  sheetTitle: {
    ...T.headingL,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  sheetSub: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 18,
    color: navy[300],
    textAlign: 'center',
    marginBottom: spacing[24],
  },

  // ── Invite code ───────────────────────────────────────────────────────────
  inviteCodeBox: {
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.28)`,
    paddingVertical: spacing[20],
    paddingHorizontal: spacing[24],
    marginBottom: spacing[20],
    alignItems: 'center',
  },
  inviteCodeText: {
    fontFamily: fonts.mono,
    fontSize: 34,
    fontWeight: '600',
    color: TEAM[300],
    letterSpacing: 10,
  },

  // ── Sheet buttons ─────────────────────────────────────────────────────────
  sheetBtn: {
    height: 52,
    borderRadius: radius.l,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[10],
  },
  sheetBtnGhost: {
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.45)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
  },
  sheetBtnFilled: {
    backgroundColor: TEAM[500],
    shadowColor: TEAM[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  sheetBtnGhostText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: TEAM[300],
  },
  sheetBtnFilledText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: TEAM.on,
  },

  // ── Action sheet rows ─────────────────────────────────────────────────────
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  actionHeaderName: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionHeaderJersey: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: navy[400],
    marginTop: 2,
  },
  actionDivider: {
    height: 0.5,
    backgroundColor: navy[600],
    marginVertical: spacing[4],
  },
  actionRow: {
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[4],
    borderRadius: radius.s,
  },
  actionRowText: {
    fontFamily: fonts.uiMedium,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  actionRowCancel: {
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[4],
    borderRadius: radius.s,
  },
  actionRowCancelText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    fontWeight: '600',
    color: navy[300],
  },

  // ── Profile card modal ────────────────────────────────────────────────────
  cardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[32],
  },
  profileCard: {
    backgroundColor: navy[700],
    borderRadius: radius.xxl,
    padding: spacing[28],
    alignItems: 'center',
    width: '100%',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardName: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#FFFFFF',
    marginTop: spacing[14],
    textAlign: 'center',
  },
  cardJersey: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: navy[400],
    letterSpacing: 0.5,
    marginTop: spacing[4],
  },
  cardPillRow: {
    marginTop: spacing[12],
  },
  cardTrendLabel: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: navy[400],
    marginTop: spacing[20],
    marginBottom: spacing[8],
  },
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
