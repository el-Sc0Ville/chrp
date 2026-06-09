// Profile screen — current user's own profile and settings.
// Flip IS_MANAGER to preview manager vs player view.
// Replace hardcoded user constants with Firebase auth when backend is wired.

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  Switch, Alert, Modal, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { navy, ice, signal, teams, status, fonts, type as T, spacing, radius } from '../theme';
import { db } from '../firebase';
import { useUserContext } from '../context/UserContext';
import { useBlackouts } from '../firebase/hooks/useBlackouts';
import { useDues } from '../firebase/hooks/useDues';
import { useTeam } from '../firebase/hooks/useTeam';
import type { DuesRecord } from '../firebase/schema';
import type { RootStackParamList } from '../navigation';

const TEAM = teams.trashdogs; // StyleSheet fallback — dynamic overrides applied inline in components

function getInitials(n: string): string {
  const parts = n.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : n.slice(0, 2).toUpperCase() || '?';
}

// ─── Root export ──────────────────────────────────────────────────────────────

type ProfileNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const { user, isManager, activeTeamId, activeTeamPalette, setNeedsOnboarding } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ProfileNavProp>();

  // Editable profile fields — seeded from Firebase Auth / member doc
  const [name, setName]             = useState(user?.displayName ?? '');
  const [jersey, setJersey]         = useState('');
  const [savedName, setSavedName]   = useState(user?.displayName ?? '');
  const [savedJersey, setSavedJersey] = useState('');

  // Edit mode
  const [isEditingName, setIsEditingName]     = useState(false);
  const [isEditingJersey, setIsEditingJersey] = useState(false);

  // Tip jar
  const [tipJarVisible, setTipJarVisible] = useState(false);

  // Settings toggles
  const [notifications, setNotifications] = useState(true);
  const [availReminders, setAvailReminders] = useState(true);
  const [location, setLocation]           = useState(false);

  // Availability preferences
  const [autoIn, setAutoIn] = useState(false);
  const [memberRole, setMemberRole] = useState<'manager' | 'player' | 'spare'>(isManager ? 'manager' : 'player');
  const { dates: blackoutDates } = useBlackouts(activeTeamId, user?.uid ?? '');
  const { team } = useTeam(activeTeamId);
  const { dues } = useDues(activeTeamId);
  const myDues = dues.find(d => d.userId === user?.uid) ?? null;

  useEffect(() => {
    if (!user?.uid || !activeTeamId) return;
    getDoc(doc(db, 'teams', activeTeamId, 'members', user.uid))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setAutoIn(data.autoIn ?? false);
          setMemberRole(data.role ?? (isManager ? 'manager' : 'player'));
          if (data.jerseyNumber != null) {
            const j = String(data.jerseyNumber);
            setJersey(j);
            setSavedJersey(j);
          }
          setNotifications(data.notificationsEnabled ?? true);
          setAvailReminders(data.remindersEnabled ?? true);
          setLocation(data.locationEnabled ?? false);
        }
      })
      .catch(() => {});
  }, [user?.uid, activeTeamId]);

  const handleAutoInToggle = async (value: boolean) => {
    setAutoIn(value);
    if (!user?.uid || !activeTeamId) return;
    try {
      await updateDoc(doc(db, 'teams', activeTeamId, 'members', user.uid), { autoIn: value });
    } catch (err) {
      console.error('[ProfileScreen] autoIn update failed:', err);
      setAutoIn(!value);
    }
  };

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = name !== savedName || jersey !== savedJersey;

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const handleSave = () => {
    const trimmed = name.trim() || savedName;
    const cleanJersey = jersey.trim() || savedJersey;
    setName(trimmed);
    setJersey(cleanJersey);
    setSavedName(trimmed);
    setSavedJersey(cleanJersey);
    setIsEditingName(false);
    setIsEditingJersey(false);
    showToast('Saved!');
  };

  const handleNotificationsToggle = async (value: boolean) => {
    setNotifications(value);
    if (!user?.uid || !activeTeamId) return;
    try {
      await updateDoc(doc(db, 'teams', activeTeamId, 'members', user.uid), { notificationsEnabled: value });
    } catch (err) {
      console.error('[ProfileScreen] notificationsEnabled update failed:', err);
      setNotifications(!value);
    }
  };

  const handleRemindersToggle = async (value: boolean) => {
    setAvailReminders(value);
    if (!user?.uid || !activeTeamId) return;
    try {
      await updateDoc(doc(db, 'teams', activeTeamId, 'members', user.uid), { remindersEnabled: value });
    } catch (err) {
      console.error('[ProfileScreen] remindersEnabled update failed:', err);
      setAvailReminders(!value);
    }
  };

  const handleLocationToggle = (value: boolean) => {
    if (value) {
      Alert.alert(
        'Allow location access?',
        "Chrp uses your location on gameday to show travel time to the rink and let your teammates see who's nearby.",
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              setLocation(true);
              if (!user?.uid || !activeTeamId) return;
              try {
                await updateDoc(doc(db, 'teams', activeTeamId, 'members', user.uid), { locationEnabled: true });
              } catch (err) {
                console.error('[ProfileScreen] locationEnabled update failed:', err);
                setLocation(false);
              }
            },
          },
        ],
      );
    } else {
      setLocation(false);
      if (!user?.uid || !activeTeamId) return;
      updateDoc(doc(db, 'teams', activeTeamId, 'members', user.uid), { locationEnabled: false })
        .catch(err => console.error('[ProfileScreen] locationEnabled update failed:', err));
    }
  };

  const handleLeaveTeam = () => {
    const teamName = team?.name ?? 'this team';
    Alert.alert(
      `Leave ${teamName}?`,
      "You'll need a new invite code to rejoin.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave team',
          style: 'destructive',
          onPress: async () => {
            if (!user?.uid || !activeTeamId) return;
            try {
              const batch = writeBatch(db);
              batch.delete(doc(db, 'teams', activeTeamId, 'members', user.uid));
              batch.delete(doc(db, 'users', user.uid, 'teams', activeTeamId));
              await batch.commit();
              setNeedsOnboarding(true);
            } catch (err) {
              console.error('[ProfileScreen] leave team failed:', err);
              Alert.alert('Error', 'Could not leave the team. Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderRow}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            onPress={() => navigation.goBack()}
            hitSlop={12}
          >
            <Text style={[styles.backChevron, { color: TEAM[300] }]}>‹</Text>
            <Text style={[styles.backBtnText, { color: TEAM[300] }]}>Back</Text>
          </Pressable>
          {isDirty && (
            <Pressable
              style={({ pressed }) => [styles.saveBtn, {
                borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.55)`,
                backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.12)`,
              }, pressed && { opacity: 0.7 }]}
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, { color: TEAM[300] }]}>Save</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.pageTitle}>Profile</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing[32]) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Player balance card (player view only) ── */}
        {!isManager && <PlayerBalanceCard dues={myDues} />}

        {/* ── Hero card ── */}
        <View style={styles.heroCard}>

          {/* Avatar with camera overlay */}
          <Pressable
            style={styles.avatarWrap}
            onPress={() => showToast('Photo upload coming soon')}
          >
            <View style={[styles.avatar, { backgroundColor: TEAM[500], shadowColor: TEAM[500] }]}>
              <Text style={[styles.avatarInitials, { color: TEAM.on }]}>{getInitials(name)}</Text>
            </View>
            <View style={styles.cameraOverlay}>
              <Text style={styles.cameraIcon}>📷</Text>
            </View>
          </Pressable>

          {/* Editable display name */}
          <Pressable
            style={styles.fieldWrap}
            onPress={() => {
              setIsEditingName(true);
              setIsEditingJersey(false);
            }}
          >
            {isEditingName ? (
              <TextInput
                style={[styles.nameInput, { borderBottomColor: TEAM[300] }]}
                value={name}
                onChangeText={setName}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                onBlur={() => setIsEditingName(false)}
                onSubmitEditing={() => setIsEditingName(false)}
              />
            ) : (
              <Text style={styles.nameText}>{name}</Text>
            )}
          </Pressable>

          {/* Editable jersey number */}
          <Pressable
            style={styles.fieldWrap}
            onPress={() => {
              setIsEditingJersey(true);
              setIsEditingName(false);
            }}
          >
            {isEditingJersey ? (
              <TextInput
                style={[styles.jerseyInput, { color: TEAM[300], borderBottomColor: TEAM[300] }]}
                value={jersey}
                onChangeText={text =>
                  setJersey(text.replace(/[^0-9]/g, '').slice(0, 2))
                }
                autoFocus
                selectTextOnFocus
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={2}
                onBlur={() => setIsEditingJersey(false)}
                onSubmitEditing={() => setIsEditingJersey(false)}
              />
            ) : (
              <Text style={[styles.jerseyText, { color: TEAM[300] }]}>#{jersey}</Text>
            )}
          </Pressable>

          {/* Role pill + team row */}
          <View style={styles.metaRow}>
            <RolePill role={memberRole} teamPalette={activeTeamPalette} />
            <View style={styles.teamRow}>
              <View style={[styles.teamSwatch, { backgroundColor: TEAM[300] }]} />
              <Text style={[styles.teamLabel, { color: TEAM[300] }]}>{team?.name ?? '—'}</Text>
            </View>
          </View>

          {/* Availability preferences — inside hero card */}
          <View style={styles.heroAvailSection}>
            {memberRole === 'spare' ? (
              <View style={styles.heroAvailRow}>
                <View style={styles.toggleLeft}>
                  <Text style={styles.toggleIcon}>⚡</Text>
                  <View style={styles.toggleTextBlock}>
                    <Text style={styles.toggleLabel}>Spare bank</Text>
                    <Text style={styles.toggleSubtitle}>
                      You're on the spare bank — you'll be contacted when the team needs a sub
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.heroAvailRow}>
                <View style={styles.toggleLeft}>
                  <Text style={styles.toggleIcon}>⚡</Text>
                  <View style={styles.toggleTextBlock}>
                    <Text style={styles.toggleLabel}>Auto-in</Text>
                    <Text style={styles.toggleSubtitle}>Auto-mark me as 'in' for new events</Text>
                  </View>
                </View>
                <Switch
                  value={autoIn}
                  onValueChange={handleAutoInToggle}
                  trackColor={{ false: navy[600], true: TEAM[500] }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={navy[600]}
                />
              </View>
            )}
            <View style={styles.heroAvailDivider} />
            <Pressable
              style={({ pressed }) => [styles.heroAvailRow, pressed && { opacity: 0.75 }]}
              onPress={() => navigation.navigate('Blackout')}
            >
              <View style={styles.toggleLeft}>
                <Text style={styles.toggleIcon}>🚫</Text>
                <View style={styles.toggleTextBlock}>
                  <Text style={styles.toggleLabel}>Blackout dates</Text>
                  <Text style={styles.toggleSubtitle}>
                    {blackoutDates.length === 0
                      ? 'No dates set'
                      : `${blackoutDates.length} date${blackoutDates.length !== 1 ? 's' : ''} blacked out`}
                  </Text>
                </View>
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Settings ── */}
        <Text style={styles.sectionLabel}>Settings</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="🔔"
            label="Notifications"
            subtitle="All Chrp alerts — events, announcements, gameday"
            value={notifications}
            onValueChange={handleNotificationsToggle}
          />
          <View style={styles.rowDivider} />
          <ToggleRow
            icon="📅"
            label="Availability reminders"
            subtitle="Nudges when you haven't responded to an upcoming event"
            value={availReminders}
            onValueChange={handleRemindersToggle}
          />
          <View style={styles.rowDivider} />
          <ToggleRow
            icon="📍"
            label="Location for Gameday"
            subtitle="Shows your arrival status to all teammates on game day"
            value={location}
            onValueChange={handleLocationToggle}
          />
          <View style={styles.rowDivider} />
          <Pressable
            style={({ pressed }) => [styles.supportRow, pressed && { opacity: 0.75 }]}
            onPress={() => setTipJarVisible(true)}
          >
            <View style={styles.toggleLeft}>
              <Text style={styles.toggleIcon}>❤️</Text>
              <View style={styles.toggleTextBlock}>
                <Text style={styles.toggleLabel}>Support Chrp</Text>
                <Text style={styles.toggleSubtitle}>Free, forever</Text>
              </View>
            </View>
            <Text style={styles.rowChevron}>›</Text>
          </Pressable>
        </View>

        {/* ── Danger zone ── */}
        <Text style={styles.sectionLabel}>Danger zone</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <Pressable
            style={({ pressed }) => [styles.leaveBtn, pressed && { opacity: 0.75 }]}
            onPress={handleLeaveTeam}
          >
            <Text style={styles.leaveBtnText}>Leave team</Text>
          </Pressable>
        </View>
      </ScrollView>

      <TipJarSheet
        visible={tipJarVisible}
        onDismiss={() => setTipJarVisible(false)}
        showToast={showToast}
      />

      {/* ── Toast ── */}
      {toast !== null && (
        <View
          style={[
            styles.toast,
            { bottom: Math.max(insets.bottom, spacing[12]) + spacing[16] },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Player balance card ──────────────────────────────────────────────────────

const DUES_STATUS_CONFIG: Record<DuesRecord['status'], { bg: string; border: string; text: string; label: string }> = {
  paid:    { bg: 'rgba(52,199,89,0.14)',  border: 'rgba(52,199,89,0.30)',  text: '#34C759', label: 'Paid'    },
  partial: { bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.30)', text: '#F59E0B', label: 'Partial' },
  pending: { bg: 'rgba(95,107,133,0.14)', border: 'rgba(95,107,133,0.28)', text: '#9BA3B4', label: 'Pending' },
  overdue: { bg: 'rgba(239,68,68,0.14)',  border: 'rgba(239,68,68,0.30)',  text: '#EF4444', label: 'Overdue' },
};

function PlayerBalanceCard({ dues }: { dues: DuesRecord | null }) {
  const cfg = dues ? DUES_STATUS_CONFIG[dues.status] : DUES_STATUS_CONFIG.pending;
  const amountText = dues != null ? `$${dues.seasonAmount}` : '—';
  const dueDateText = dues?.dueDate
    ? dues.dueDate.toDate().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <View style={styles.balanceCard}>
      <View style={styles.balanceCardTop}>
        <View>
          <Text style={styles.balanceCardLabel}>Season dues</Text>
          <Text style={styles.balanceCardAmount}>{amountText}</Text>
        </View>
        <View style={[styles.balancePill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Text style={[styles.balancePillText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>
      <View style={styles.balanceCardMeta}>
        <View style={styles.balanceMetaItem}>
          <Text style={styles.balanceMetaLabel}>Due date</Text>
          <Text style={styles.balanceMetaValue}>{dueDateText}</Text>
        </View>
        {dues?.notes != null && (
          <View style={styles.balanceMetaItem}>
            <Text style={styles.balanceMetaLabel}>Notes</Text>
            <Text style={styles.balanceMetaValue}>{dues.notes}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  icon,
  label,
  subtitle,
  value,
  onValueChange,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleLeft}>
        <Text style={styles.toggleIcon}>{icon}</Text>
        <View style={styles.toggleTextBlock}>
          <Text style={styles.toggleLabel}>{label}</Text>
          {subtitle && <Text style={styles.toggleSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: navy[600], true: TEAM[500] }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={navy[600]}
      />
    </View>
  );
}

// ─── Role pill ────────────────────────────────────────────────────────────────

function RolePill({ role, teamPalette }: { role: 'manager' | 'player' | 'spare'; teamPalette?: string }) {
  const { activeTeamPalette } = useUserContext();
  const palette = (teamPalette ?? activeTeamPalette) as keyof typeof teams;
  const TEAM = teams[palette];
  const pillStyle = role === 'manager' ? [styles.rolePillManager, {
    backgroundColor: TEAM[900],
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.32)`,
  }]
    : role === 'spare' ? styles.rolePillSpare
    : styles.rolePillPlayer;
  const textStyle = role === 'manager' ? [styles.rolePillTextManager, { color: TEAM[300] }]
    : role === 'spare' ? styles.rolePillTextSpare
    : styles.rolePillTextPlayer;
  const label = role === 'manager' ? 'Manager' : role === 'spare' ? 'Spare' : 'Player';
  return (
    <View style={[styles.rolePill, pillStyle]}>
      <Text style={[styles.rolePillText, textStyle]}>{label}</Text>
    </View>
  );
}

// ─── Tip jar sheet ────────────────────────────────────────────────────────────

const TIP_OPTIONS = [
  { amount: '$2',  emoji: '☕' },
  { amount: '$5',  emoji: '🍕' },
  { amount: '$10', emoji: '🎉' },
  { amount: '$25', emoji: '🏒' },
];

function TipJarSheet({
  visible, onDismiss, showToast,
}: {
  visible: boolean;
  onDismiss: () => void;
  showToast: (msg: string) => void;
}) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const insets = useSafeAreaInsets();

  const handleTip = () => {
    // TODO Phase 2b: wire to Stripe or Apple/Google in-app purchase
    onDismiss();
    showToast('Coming soon — payment support is on the way! 🙏');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.sheetBackdrop} onPress={onDismiss}>
        <Pressable
          onPress={() => {}}
          style={[styles.tipSheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}
        >
          <View style={styles.sheetHandle} />

          <Text style={styles.tipWordmark}>
            <Text style={styles.tipWordmarkCh}>Ch</Text>
            <Text style={styles.tipWordmarkRp}>rp</Text>
          </Text>

          <Text style={styles.tipTagline}>
            Chrp is free and always will be. If it saves you one awkward "are you coming?" text, consider buying us a coffee.
          </Text>

          <View style={styles.tipGrid}>
            {TIP_OPTIONS.map(({ amount, emoji }) => (
              <Pressable
                key={amount}
                style={({ pressed }) => [styles.tipBtn, {
                  backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
                  borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.38)`,
                }, pressed && { opacity: 0.8 }]}
                onPress={handleTip}
              >
                <Text style={styles.tipBtnEmoji}>{emoji}</Text>
                <Text style={[styles.tipBtnAmount, { color: TEAM[300] }]}>{amount}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.tipLaterBtn, pressed && { opacity: 0.75 }]}
            onPress={onDismiss}
          >
            <Text style={styles.tipLaterBtnText}>Maybe later</Text>
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

  // ── Page header ───────────────────────────────────────────────────────────
  pageHeader: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[10],
    paddingBottom: spacing[14],
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[6],
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start',
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
  saveBtn: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[6],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.55)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.12)`,
  },
  saveBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: TEAM[300],
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: spacing[4],
  },

  // ── Player balance card ───────────────────────────────────────────────────
  balanceCard: {
    marginHorizontal: spacing[16],
    marginBottom: spacing[16],
    backgroundColor: navy[700],
    borderRadius: radius.l,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: spacing[16],
  },
  balanceCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing[12],
  },
  balanceCardLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: navy[400],
    marginBottom: spacing[4],
  },
  balanceCardAmount: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: -0.8,
    color: '#FFFFFF',
  },
  balancePill: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: radius.s,
    backgroundColor: 'rgba(52,199,89,0.14)',
    borderWidth: 0.5,
    borderColor: 'rgba(52,199,89,0.30)',
  },
  balancePillText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    color: '#34C759',
  },
  balanceCardMeta: {
    flexDirection: 'row',
    gap: spacing[28],
  },
  balanceMetaItem: {
    gap: spacing[2],
  },
  balanceMetaLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    color: navy[400],
  },
  balanceMetaValue: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: navy[200],
  },

  // ── Hero card ─────────────────────────────────────────────────────────────
  heroCard: {
    marginHorizontal: spacing[16],
    backgroundColor: navy[700],
    borderRadius: radius.xxl,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[28],
    paddingBottom: 0,
    alignItems: 'center',
    overflow: 'hidden',
  },

  // ── Availability prefs inside hero card ───────────────────────────────────
  heroAvailSection: {
    alignSelf: 'stretch',
    marginTop: spacing[16],
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  heroAvailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[12],
  },
  heroAvailDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // ── Avatar ────────────────────────────────────────────────────────────────
  avatarWrap: {
    marginBottom: spacing[20],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TEAM[500],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  avatarInitials: {
    fontFamily: fonts.uiBold,
    fontSize: 26,
    fontWeight: '700',
    color: TEAM.on,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: navy[600],
    borderWidth: 2,
    borderColor: navy[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    fontSize: 13,
    lineHeight: 16,
  },

  // ── Editable name ─────────────────────────────────────────────────────────
  fieldWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    marginBottom: spacing[4],
  },
  nameText: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingVertical: spacing[4],
  },
  nameInput: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: '#FFFFFF',
    textAlign: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: TEAM[300],
    paddingVertical: spacing[4],
    width: '100%',
  },

  // ── Editable jersey ───────────────────────────────────────────────────────
  jerseyText: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '600',
    color: TEAM[300],
    letterSpacing: 0.5,
    textAlign: 'center',
    paddingVertical: spacing[2],
  },
  jerseyInput: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '600',
    color: TEAM[300],
    letterSpacing: 0.5,
    textAlign: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: TEAM[300],
    paddingVertical: spacing[2],
    minWidth: 60,
  },

  // ── Meta row: role pill + team ────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    marginTop: spacing[14],
  },
  rolePill: {
    paddingHorizontal: spacing[10],
    paddingVertical: 4,
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
  rolePillTextManager: {
    color: TEAM[300],
  },
  rolePillTextPlayer: {
    color: navy[400],
  },
  rolePillTextSpare: {
    color: '#F59E0B',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamSwatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: TEAM[300],
  },
  teamLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: TEAM[300],
  },

  // ── Section labels ────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: navy[400],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
    paddingBottom: spacing[8],
  },

  // ── Card (settings + danger) ──────────────────────────────────────────────
  card: {
    marginHorizontal: spacing[16],
    backgroundColor: navy[700],
    borderRadius: radius.l,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  dangerCard: {
    backgroundColor: `rgba(${hexToRgbVals(status.error.pure)}, 0.06)`,
    borderColor: `rgba(${hexToRgbVals(status.error.pure)}, 0.20)`,
  },

  // ── Toggle row ────────────────────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[12],
    flex: 1,
  },
  toggleIcon: {
    fontSize: 18,
    width: 26,
    textAlign: 'center',
    marginTop: 2,
  },
  toggleTextBlock: {
    flex: 1,
  },
  toggleLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
    fontWeight: '500',
    color: navy[100],
  },
  toggleSubtitle: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 16,
    color: ice[400],
    marginTop: 2,
  },
  rowDivider: {
    height: 0.5,
    backgroundColor: navy[600],
    marginLeft: spacing[16],
  },

  // ── Leave team ────────────────────────────────────────────────────────────
  leaveBtn: {
    paddingVertical: spacing[16],
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: status.error.pure,
  },

  // ── Support Chrp row ──────────────────────────────────────────────────────
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  rowChevron: {
    fontFamily: fonts.ui,
    fontSize: 22,
    color: navy[500],
    lineHeight: 24,
  },

  // ── Tip jar sheet ─────────────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.60)',
  },
  tipSheet: {
    backgroundColor: navy[700],
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing[24],
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
    marginBottom: spacing[24],
  },
  tipWordmark: {
    fontFamily: fonts.wordmark,
    fontSize: 44,
    letterSpacing: -2,
    lineHeight: 48,
    textAlign: 'center',
    marginBottom: spacing[12],
  },
  tipWordmarkCh: {
    color: '#E7ECF5',
  },
  tipWordmarkRp: {
    color: signal[400],
  },
  tipTagline: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 21,
    color: navy[300],
    textAlign: 'center',
    marginBottom: spacing[24],
  },
  tipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[10],
    marginBottom: spacing[20],
  },
  tipBtn: {
    width: '47.5%',
    paddingVertical: spacing[16],
    borderRadius: radius.l,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
    borderWidth: 0.5,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.38)`,
    alignItems: 'center',
    gap: spacing[6],
  },
  tipBtnEmoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  tipBtnAmount: {
    fontFamily: fonts.monoBold,
    fontSize: 16,
    fontWeight: '700',
    color: TEAM[300],
    letterSpacing: 0.3,
  },
  tipLaterBtn: {
    height: 52,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  tipLaterBtnText: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
    color: navy[400],
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
