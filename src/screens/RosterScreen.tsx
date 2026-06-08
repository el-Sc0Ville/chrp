// Roster screen — B-07 Manager Roster / C-07 Player Roster.
// Flip IS_MANAGER to preview each view. Replace with auth role when Firebase is wired.

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, Share, StyleSheet, Alert, Image,
} from 'react-native';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navy, teams, status, fonts, type as T, spacing, radius } from '../theme';
import { useUserContext } from '../context/UserContext';
import { useMembers } from '../firebase/hooks/useMembers';
import { useTeam } from '../firebase/hooks/useTeam';
import type { Member } from '../firebase/schema';

type PlayerRole = 'manager' | 'player' | 'spare';
type TrendDot = 'in' | 'out' | 'maybe' | null;

interface RosterPlayer {
  id: string;
  name: string;
  initials: string;
  jersey: number;
  role: PlayerRole;
  trend: [TrendDot, TrendDot, TrendDot, TrendDot, TrendDot];
}

function toRosterPlayer(m: Member): RosterPlayer {
  const parts = m.displayName.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : m.displayName.slice(0, 2).toUpperCase();
  return {
    id: m.userId,
    name: m.displayName,
    initials,
    jersey: m.jerseyNumber,
    role: m.role,
    trend: [null, null, null, null, null],
  };
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function RosterScreen({ embedded }: { embedded?: boolean }) {
  const { isManager } = useUserContext();
  return isManager
    ? <ManagerRosterScreen embedded={embedded} />
    : <PlayerRosterScreen  embedded={embedded} />;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  B-07 · Manager Roster                                                   ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function ManagerRosterScreen({ embedded }: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { user, activeTeamId, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const { members, loading } = useMembers(activeTeamId);
  const { team } = useTeam(activeTeamId);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [spareBankExpanded, setSpareBankExpanded] = useState(true);

  React.useEffect(() => {
    setRoster(members.map(toRosterPlayer));
  }, [members]);
  const [actionPlayer, setActionPlayer] = useState<RosterPlayer | null>(null);

  const inviteCode = team?.inviteCode ?? '';

  const makeManager = async (id: string) => {
    setRoster(prev => prev.map(p => p.id === id ? { ...p, role: 'manager' as PlayerRole } : p));
    setActionPlayer(null);
    try {
      await updateDoc(doc(db, 'teams', activeTeamId, 'members', id), { role: 'manager' });
      await updateDoc(doc(db, 'teams', activeTeamId), { managerIds: arrayUnion(id) });
    } catch (err) {
      console.error('[Roster] makeManager failed:', err);
    }
  };

  const demoteToPlayer = async (id: string) => {
    if (id === user?.uid) {
      Alert.alert("Can't remove your own manager role", 'Ask another manager to do this.');
      setActionPlayer(null);
      return;
    }
    setRoster(prev => prev.map(p => p.id === id ? { ...p, role: 'player' as PlayerRole } : p));
    setActionPlayer(null);
    try {
      await updateDoc(doc(db, 'teams', activeTeamId, 'members', id), { role: 'player' });
      await updateDoc(doc(db, 'teams', activeTeamId), { managerIds: arrayRemove(id) });
    } catch (err) {
      console.error('[Roster] demoteToPlayer failed:', err);
    }
  };

  const moveToSpare = async (id: string) => {
    setRoster(prev => prev.map(p => p.id === id ? { ...p, role: 'spare' as PlayerRole } : p));
    setActionPlayer(null);
    try {
      await updateDoc(doc(db, 'teams', activeTeamId, 'members', id), { role: 'spare' });
    } catch (err) {
      console.error('[Roster] moveToSpare failed:', err);
    }
  };

  const makePlayer = async (id: string) => {
    setRoster(prev => prev.map(p => p.id === id ? { ...p, role: 'player' as PlayerRole } : p));
    setActionPlayer(null);
    try {
      await updateDoc(doc(db, 'teams', activeTeamId, 'members', id), { role: 'player' });
    } catch (err) {
      console.error('[Roster] makePlayer failed:', err);
    }
  };

  const removePlayer = async (id: string) => {
    const wasManager = roster.find(p => p.id === id)?.role === 'manager';
    setRoster(prev => prev.filter(p => p.id !== id));
    setActionPlayer(null);
    try {
      await deleteDoc(doc(db, 'teams', activeTeamId, 'members', id));
      if (wasManager) {
        await updateDoc(doc(db, 'teams', activeTeamId), { managerIds: arrayRemove(id) });
      }
    } catch (err) {
      console.error('[Roster] removePlayer failed:', err);
    }
  };

  const mainRoster   = roster.filter(p => p.role !== 'spare');
  const spares       = roster.filter(p => p.role === 'spare');
  const managerCount = mainRoster.filter(p => p.role === 'manager').length;

  return (
    <View style={[styles.container, { paddingTop: embedded ? 0 : insets.top }]}>
      {!embedded && <RosterHeader isManager onInvite={() => setInviteVisible(true)} />}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && roster.length === 0
          ? [1,2,3,4,5].map(i => (
              <View key={i} style={[styles.rowOuter, { height: 68 }]}>
                <View style={[styles.rowMain, { opacity: 0 }]} />
              </View>
            ))
          : mainRoster.map(player => (
              <PlayerRow
                key={player.id}
                player={player}
                onLongPress={() => setActionPlayer(player)}
              />
            ))
        }
        {spares.length > 0 && (
          <SpareBankSection
            spares={spares}
            expanded={spareBankExpanded}
            onToggle={() => setSpareBankExpanded(v => !v)}
            onLongPress={(p) => setActionPlayer(p)}
          />
        )}
      </ScrollView>
      <View style={[styles.stickyBar, styles.stickyBarRow, { paddingBottom: Math.max(insets.bottom, spacing[12]) }]}>
        <Text style={styles.stickyCount}>
          {mainRoster.length} players · {managerCount} manager{managerCount !== 1 ? 's' : ''}
          {spares.length > 0 ? ` · ${spares.length} spare${spares.length !== 1 ? 's' : ''}` : ''}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.inviteBtn,
            {
              borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.55)`,
              backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
            },
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => setInviteVisible(true)}
        >
          <Text style={[styles.inviteBtnText, { color: TEAM[300] }]}>+ Invite</Text>
        </Pressable>
      </View>

      <InviteSheet
        visible={inviteVisible}
        inviteCode={inviteCode}
        teamName={team?.name ?? ''}
        onClose={() => setInviteVisible(false)}
      />
      {actionPlayer && (
        <ActionSheet
          player={actionPlayer}
          onMakeManager={() => makeManager(actionPlayer.id)}
          onDemote={() => demoteToPlayer(actionPlayer.id)}
          onMoveToSpare={() => moveToSpare(actionPlayer.id)}
          onMakePlayer={() => makePlayer(actionPlayer.id)}
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
  const { activeTeamId, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const { members, loading } = useMembers(activeTeamId);
  const roster = members.map(toRosterPlayer);
  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayer | null>(null);

  const mainRoster   = roster.filter(p => p.role !== 'spare');
  const managerCount = mainRoster.filter(p => p.role === 'manager').length;
  const spareCount   = roster.filter(p => p.role === 'spare').length;

  return (
    <View style={[styles.container, { paddingTop: embedded ? 0 : insets.top }]}>
      {!embedded && <RosterHeader isManager={false} />}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {roster.map(player => (
          <PlayerRow
            key={player.id}
            player={player}
            onPress={() => setSelectedPlayer(player)}
          />
        ))}
      </ScrollView>
      <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, spacing[12]) }]}>
        <Text style={styles.stickyCount}>
          {mainRoster.length} players · {managerCount} manager{managerCount !== 1 ? 's' : ''}
          {spareCount > 0 ? ` · ${spareCount} spare${spareCount !== 1 ? 's' : ''}` : ''}
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
  const { activeTeamId, activeTeamPalette } = useUserContext();
  const { team } = useTeam(activeTeamId);
  const TEAM = teams[activeTeamPalette];
  return (
    <View style={styles.header}>
      <View style={styles.teamPill}>
        <View style={[styles.teamDot, { backgroundColor: TEAM[300] }]} />
        <Text style={[styles.teamName, { color: TEAM[300] }]}>{team?.name ?? ''}</Text>
      </View>
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Roster</Text>
        {isManager && (
          <Pressable
            style={({ pressed }) => [
              styles.inviteBtn,
              {
                borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.55)`,
                backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
              },
              pressed && { opacity: 0.7 },
            ]}
            onPress={onInvite}
          >
            <Text style={[styles.inviteBtnText, { color: TEAM[300] }]}>+ Invite</Text>
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
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function PlayerAvatar({ player, size = 44 }: { player: RosterPlayer; size?: number }) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const avatarStyle = player.role === 'manager'
    ? { backgroundColor: TEAM[500] }
    : player.role === 'spare'
    ? styles.avatarSpare
    : { backgroundColor: TEAM[700], borderWidth: 1, borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.28)` };
  const initialsColor = player.role === 'manager' ? '#FFFFFF'
    : player.role === 'spare' ? '#F59E0B'
    : TEAM[300];
  return (
    <View style={[
      styles.avatar,
      { width: size, height: size, borderRadius: size / 2 },
      avatarStyle,
    ]}>
      <Text style={[
        styles.avatarInitials,
        { fontSize: Math.round(size * 0.32), color: initialsColor },
      ]}>
        {player.initials}
      </Text>
    </View>
  );
}

// ─── Role pill ────────────────────────────────────────────────────────────────

function RolePill({ role }: { role: PlayerRole }) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const pillStyle = role === 'manager'
    ? { backgroundColor: TEAM[900], borderWidth: 0.5, borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.32)` }
    : role === 'spare' ? styles.rolePillSpare
    : styles.rolePillPlayer;
  const textColor = role === 'manager' ? TEAM[300]
    : role === 'spare' ? '#F59E0B'
    : undefined;
  const textStyle = role === 'spare' ? styles.rolePillTextSpare
    : role === 'player' ? styles.rolePillTextPlayer
    : undefined;
  const label = role === 'manager' ? 'Manager' : role === 'spare' ? 'Spare' : 'Player';
  return (
    <View style={[styles.rolePill, pillStyle]}>
      <Text style={[styles.rolePillText, textStyle, textColor ? { color: textColor } : undefined]}>
        {label}
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
  teamName,
  onClose,
}: {
  visible: boolean;
  inviteCode: string;
  teamName: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const handleShare = () => {
    Share.share({
      message: `Join my team on Chrp! Use code: ${inviteCode}`,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Invite players</Text>
          <Text style={styles.sheetSub}>Share this code with teammates to join {teamName}</Text>

          {inviteCode ? (
            <View style={styles.qrWrap}>
              <Image
                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteCode)}` }}
                style={styles.qrImage}
              />
            </View>
          ) : null}

          <View style={[
            styles.inviteCodeBox,
            {
              backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
              borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.28)`,
            },
          ]}>
            <Text style={[styles.inviteCodeText, { color: TEAM[300] }]}>{inviteCode || '——'}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.sheetBtn,
              styles.sheetBtnGhost,
              {
                borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.45)`,
                backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
              },
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleShare}
          >
            <Text style={[styles.sheetBtnGhostText, { color: TEAM[300] }]}>Copy code</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.sheetBtn,
              { backgroundColor: TEAM[500], shadowColor: TEAM[500],
                shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4 },
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleShare}
          >
            <Text style={[styles.sheetBtnFilledText, { color: TEAM.on }]}>Share invite</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Long-press action sheet ──────────────────────────────────────────────────

function ActionSheet({
  player,
  onMakeManager,
  onDemote,
  onMoveToSpare,
  onMakePlayer,
  onRemove,
  onClose,
}: {
  player: RosterPlayer;
  onMakeManager: () => void;
  onDemote: () => void;
  onMoveToSpare: () => void;
  onMakePlayer: () => void;
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

          {player.role === 'player' && (
            <>
              <Pressable
                style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: navy[600] }]}
                onPress={onMakeManager}
              >
                <Text style={styles.actionRowText}>Make Manager</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: navy[600] }]}
                onPress={onMoveToSpare}
              >
                <Text style={styles.actionRowText}>Move to Spare Bank</Text>
              </Pressable>
            </>
          )}
          {player.role === 'manager' && (
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: navy[600] }]}
              onPress={onDemote}
            >
              <Text style={styles.actionRowText}>Remove Manager role</Text>
            </Pressable>
          )}
          {player.role === 'spare' && (
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: navy[600] }]}
              onPress={onMakePlayer}
            >
              <Text style={styles.actionRowText}>Make Player</Text>
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

// ─── Spare Bank section ───────────────────────────────────────────────────────

function SpareBankSection({
  spares, expanded, onToggle, onLongPress,
}: {
  spares: RosterPlayer[];
  expanded: boolean;
  onToggle: () => void;
  onLongPress: (p: RosterPlayer) => void;
}) {
  return (
    <View style={styles.spareBankWrap}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.spareBankHeader, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.spareBankTitle}>Spare Bank</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[8] }}>
          <View style={styles.spareBankBadge}>
            <Text style={styles.spareBankBadgeText}>{spares.length}</Text>
          </View>
          <Text style={[styles.spareBankChevron, expanded && styles.spareBankChevronOpen]}>›</Text>
        </View>
      </Pressable>
      {expanded && spares.map(spare => (
        <PlayerRow
          key={spare.id}
          player={spare}
          onLongPress={() => onLongPress(spare)}
        />
      ))}
    </View>
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
  },
  teamName: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
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
  },
  inviteBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    fontWeight: '600',
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
  avatarPlayer: {},
  avatarManager: {},
  avatarSpare: {
    backgroundColor: navy[700],
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.38)',
  },
  avatarInitials: {
    fontFamily: fonts.uiBold,
    fontWeight: '700',
  },

  // ── Role pill ─────────────────────────────────────────────────────────────
  rolePill: {
    paddingHorizontal: spacing[8],
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  rolePillManager: {},
  rolePillPlayer: {
    backgroundColor: navy[600],
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  rolePillSpare: {
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,158,11,0.28)',
  },
  rolePillText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  rolePillTextManager: {},
  rolePillTextPlayer: {
    color: navy[400],
  },
  rolePillTextSpare: {
    color: '#F59E0B',
  },

  // ── Spare Bank section ────────────────────────────────────────────────────
  spareBankWrap: {
    marginTop: spacing[8],
  },
  spareBankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[4],
    borderTopWidth: 0.5,
    borderTopColor: navy[600],
  },
  spareBankTitle: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: navy[400],
  },
  spareBankBadge: {
    paddingHorizontal: spacing[8],
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: navy[600],
    borderWidth: 0.5,
    borderColor: navy[500],
  },
  spareBankBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: navy[400],
  },
  spareBankChevron: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 20,
    color: navy[400],
    transform: [{ rotate: '90deg' }],
  },
  spareBankChevronOpen: {
    transform: [{ rotate: '270deg' }],
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
  stickyBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stickyCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.0,
    color: navy[400],
    textAlign: 'center',
    flex: 1,
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

  // ── QR code ───────────────────────────────────────────────────────────────
  qrWrap: {
    alignItems: 'center',
    marginBottom: spacing[20],
  },
  qrImage: {
    width: 160,
    height: 160,
    borderRadius: radius.m,
  },

  // ── Invite code ───────────────────────────────────────────────────────────
  inviteCodeBox: {
    borderRadius: radius.l,
    borderWidth: 1,
    paddingVertical: spacing[20],
    paddingHorizontal: spacing[24],
    marginBottom: spacing[20],
    alignItems: 'center',
  },
  inviteCodeText: {
    fontFamily: fonts.mono,
    fontSize: 34,
    fontWeight: '600',
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
  },
  sheetBtnFilled: {},
  sheetBtnGhostText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    fontWeight: '600',
  },
  sheetBtnFilledText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    fontWeight: '600',
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
