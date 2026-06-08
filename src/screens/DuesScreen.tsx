// Dues screen — B-09 Manager Dues / Player Dues.
// Flip IS_MANAGER to preview each view. Replace with auth role when Firebase is wired.

import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, updateDoc, setDoc, writeBatch, serverTimestamp, Timestamp, deleteField } from 'firebase/firestore';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { db } from '../firebase';
import { navy, teams, status, fonts, type as T, spacing, radius } from '../theme';
import { useUserContext } from '../context/UserContext';
import { useDues } from '../firebase/hooks/useDues';
import { useMembers } from '../firebase/hooks/useMembers';
import type { DuesRecord, Member } from '../firebase/schema';

const TEAM = teams.trashdogs; // StyleSheet fallback — dynamic overrides applied inline in components

// Per-player season dues fallback
const SEASON_DUES = 500;

// ─── Display type ─────────────────────────────────────────────────────────────

type DuesStatus = 'paid' | 'partial' | 'pending' | 'overdue';

interface DuesPlayer {
  id: string;
  name: string;
  initials: string;
  jersey: number;
  duesStatus: DuesStatus;
  paidAmount: number;
  seasonAmount: number;
  notes?: string;
  dueDate: Date | null;
}

function toDuesPlayer(r: DuesRecord): DuesPlayer {
  const parts = r.displayName.trim().split(' ');
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : r.displayName.slice(0, 2).toUpperCase();
  return {
    id: r.userId, name: r.displayName, initials,
    jersey: 0, duesStatus: (r.status ?? 'pending') as DuesStatus, paidAmount: r.amountPaid,
    seasonAmount: r.seasonAmount, notes: r.notes,
    dueDate: r.dueDate?.toDate() ?? null,
  };
}

function formatDueDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function DuesScreen({ embedded }: { embedded?: boolean }) {
  const { isManager } = useUserContext();
  return isManager
    ? <ManagerDuesScreen embedded={embedded} />
    : <PlayerDuesScreen  embedded={embedded} />;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  B-09 · Manager Dues                                                     ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function ManagerDuesScreen({ embedded }: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { activeTeamId, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const { dues } = useDues(activeTeamId);
  const { members } = useMembers(activeTeamId);
  const spareMembers = members.filter((m: Member) => m.role === 'spare');
  const spareIds = new Set(spareMembers.map((m: Member) => m.userId));
  const players = dues.map(toDuesPlayer).filter(p => !spareIds.has(p.id));
  const [seasonDues, setSeasonDues] = useState(SEASON_DUES);
  const [setAmountVisible, setSetAmountVisible] = useState(false);
  const [actionPlayer, setActionPlayer] = useState<DuesPlayer | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const handleSetAmount = async (amount: number) => {
    setSeasonDues(amount);
    setSetAmountVisible(false);
    showToast(`Dues set to $${amount}/player`);
    try {
      const batch = writeBatch(db);
      const nonSpares = members.filter((m: Member) => m.role !== 'spare');
      if (nonSpares.length === 0) return;
      for (const member of nonSpares) {
        batch.set(
          doc(db, 'teams', activeTeamId, 'dues', member.userId),
          { seasonAmount: amount, userId: member.userId, displayName: member.displayName, status: 'pending' },
          { merge: true },
        );
      }
      await batch.commit();
    } catch (err) {
      console.error('[DuesScreen] setAmount batch failed:', err);
    }
  };

  const paidCount  = players.filter(p => p.duesStatus === 'paid').length;
  const totalCount = players.length;
  const collected  = players.reduce((sum, p) => sum + p.paidAmount, 0);
  const total      = totalCount * seasonDues;
  const progress   = total > 0 ? collected / total : 0;

  return (
    <View style={[styles.container, { paddingTop: embedded ? 0 : insets.top }]}>

      {/* ── Header ── */}
      {!embedded && (
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Dues</Text>
          <Pressable
            style={({ pressed }) => [styles.ghostBtn, {
              borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.55)`,
              backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
            }, pressed && { opacity: 0.65 }, members.length === 0 && { opacity: 0.35 }]}
            onPress={() => setSetAmountVisible(true)}
            disabled={members.length === 0}
          >
            <Text style={[styles.ghostBtnText, { color: TEAM[300] }]}>Set amount</Text>
          </Pressable>
        </View>
      )}
      {embedded && (
        <View style={styles.embeddedHeaderRow}>
          <Pressable
            style={({ pressed }) => [styles.ghostBtn, {
              borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.55)`,
              backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
            }, pressed && { opacity: 0.65 }, members.length === 0 && { opacity: 0.35 }]}
            onPress={() => setSetAmountVisible(true)}
            disabled={members.length === 0}
          >
            <Text style={[styles.ghostBtnText, { color: TEAM[300] }]}>Set amount</Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing[32]) },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Summary banner ── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Collected</Text>
              <Text style={styles.summaryAmount}>
                <Text style={styles.summaryAmountBold}>${collected}</Text>
                <Text style={styles.summaryAmountOf}> of ${total}</Text>
              </Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryFraction}>{paidCount}/{totalCount} paid in full</Text>
              <Text style={styles.summaryPerPlayer}>${seasonDues}/player</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: TEAM[500] }]} />
          </View>
        </View>

        {/* ── Player list ── */}
        <Text style={styles.sectionLabel}>Players</Text>
        <View style={styles.card}>
          {players.map((player, idx) => (
            <React.Fragment key={player.id}>
              {idx > 0 && <View style={styles.rowDivider} />}
              <Pressable
                style={({ pressed }) => [styles.playerRow, pressed && { backgroundColor: navy[600] }]}
                onPress={() => setActionPlayer(player)}
              >
                <PlayerAvatar player={player} />
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.playerJersey}>#{player.jersey}</Text>
                </View>
                <View style={styles.playerRight}>
                  {(player.duesStatus === 'partial' || (player.duesStatus === 'overdue' && player.paidAmount > 0))
                    ? <Text style={styles.playerAmountPartial}>${player.paidAmount} of ${player.seasonAmount}</Text>
                    : <Text style={styles.playerAmount}>${player.seasonAmount}</Text>
                  }
                  <StatusPill status={player.duesStatus} />
                </View>
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        {/* ── Spare Bank ── */}
        {spareMembers.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Spare Bank</Text>
            <View style={styles.card}>
              {spareMembers.map((spare: Member, idx: number) => {
                const parts = spare.displayName.trim().split(' ');
                const initials = parts.length >= 2
                  ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                  : spare.displayName.slice(0, 2).toUpperCase();
                return (
                  <React.Fragment key={spare.userId}>
                    {idx > 0 && <View style={styles.rowDivider} />}
                    <View style={styles.playerRow}>
                      <View style={[styles.avatar, styles.avatarSpare]}>
                        <Text style={styles.avatarText}>{initials}</Text>
                      </View>
                      <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>{spare.displayName}</Text>
                        <Text style={styles.playerJersey}>#{spare.jerseyNumber}</Text>
                      </View>
                      <View style={styles.playerRight}>
                        <Text style={styles.sparePerGame}>Per game</Text>
                        <Text style={styles.spareAmount}>$20</Text>
                      </View>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Set Amount Sheet ── */}
      <SetAmountSheet
        visible={setAmountVisible}
        current={seasonDues}
        onSave={handleSetAmount}
        onClose={() => setSetAmountVisible(false)}
      />

      {/* ── Player Edit Sheet ── */}
      {actionPlayer && (
        <PlayerEditSheet
          player={actionPlayer}
          onSave={msg => { showToast(msg); setActionPlayer(null); }}
          onClose={() => setActionPlayer(null)}
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

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  C-09 · Player Dues                                                      ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const PAYMENT_HISTORY = [
  { id: 'ph1', label: 'Winter 2024/25 season dues', date: 'Sep 28, 2024', amount: 900 },
  { id: 'ph2', label: 'Summer 2024 season dues',    date: 'Apr 6, 2024',  amount: 500 },
];

function PlayerDuesScreen({ embedded }: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { user, activeTeamId, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const { dues } = useDues(activeTeamId);
  const uid = user?.uid ?? 'anon';
  const selfRecord = dues.find(d => d.userId === uid);
  const selfPlayer = selfRecord ? toDuesPlayer(selfRecord) : null;
  const seasonDues = selfRecord?.seasonAmount ?? SEASON_DUES;
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const dueDate = 'Jun 15, 2025';

  return (
    <View style={[styles.container, { paddingTop: embedded ? 0 : insets.top }]}>

      {/* ── Header (hidden when embedded) ── */}
      {!embedded && (
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Dues</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing[32]) },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Balance card ── */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={styles.balanceLabel}>Season dues</Text>
              <Text style={styles.balanceAmount}>${seasonDues}</Text>
            </View>
            <StatusPill status={selfPlayer?.duesStatus ?? 'pending'} large />
          </View>

          <View style={styles.balanceMeta}>
            <View style={styles.balanceMetaItem}>
              <Text style={styles.balanceMetaLabel}>Due date</Text>
              <Text style={styles.balanceMetaValue}>{dueDate}</Text>
            </View>
            <View style={styles.balanceMetaItem}>
              <Text style={styles.balanceMetaLabel}>Season</Text>
              <Text style={styles.balanceMetaValue}>Summer 2025</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.payBtn, { backgroundColor: TEAM[500] }, pressed && { opacity: 0.8 }]}
            onPress={() => showToast('Payment coming in V2')}
          >
            <Text style={[styles.payBtnText, { color: TEAM.on }]}>Pay now</Text>
          </Pressable>
        </View>

        {/* ── Payment history (only shown when player has made payments) ── */}
        {selfPlayer && selfPlayer.paidAmount > 0 && (
          <>
            <Text style={styles.sectionLabel}>Payment history</Text>
            <View style={styles.card}>
              {PAYMENT_HISTORY.map((entry, idx) => (
                <React.Fragment key={entry.id}>
                  {idx > 0 && <View style={styles.rowDivider} />}
                  <View style={styles.historyRow}>
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyLabel}>{entry.label}</Text>
                      <Text style={styles.historyDate}>{entry.date}</Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={styles.historyAmount}>${entry.amount}</Text>
                      <StatusPill status="paid" />
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </>
        )}
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
// ║  Sub-components                                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function PlayerAvatar({ player }: { player: DuesPlayer }) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  return (
    <View style={[styles.avatar, { backgroundColor: TEAM[700], borderColor: TEAM[500] }]}>
      <Text style={[styles.avatarText, { color: TEAM[100] }]}>{player.initials}</Text>
    </View>
  );
}

function StatusPill({ status: s, large }: { status: DuesStatus; large?: boolean }) {
  const map: Record<DuesStatus, { label: string; bg: string; text: string }> = {
    paid:    { label: 'Paid',    bg: statusColors.success.subtle, text: statusColors.success.pure  },
    partial: { label: 'Partial', bg: statusColors.info.subtle,    text: statusColors.info.light    },
    pending: { label: 'Pending', bg: statusColors.alert.subtle,   text: statusColors.alert.pure    },
    overdue: { label: 'Overdue', bg: statusColors.error.subtle,   text: statusColors.error.pure    },
  };
  const config = map[s] ?? map['pending'];
  return (
    <View style={[styles.pill, { backgroundColor: config.bg }, large && styles.pillLarge]}>
      <Text style={[styles.pillText, { color: config.text }, large && styles.pillTextLarge]}>
        {config.label}
      </Text>
    </View>
  );
}

// ─── Set Amount Sheet ─────────────────────────────────────────────────────────

function SetAmountSheet({
  visible, current, onSave, onClose,
}: {
  visible: boolean;
  current: number;
  onSave: (amount: number) => void;
  onClose: () => void;
}) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const insets = useSafeAreaInsets();
  const [raw, setRaw] = useState(String(current));

  const handleSave = () => {
    const parsed = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed) && parsed > 0) onSave(parsed);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
          <Pressable onPress={() => {}}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Set dues amount</Text>
              <Text style={styles.sheetSub}>Per player, for this season</Text>

              <View style={[styles.amountInputWrap, { borderColor: TEAM[700] }]}>
                <Text style={styles.amountDollar}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={raw}
                  onChangeText={text => setRaw(text.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  autoFocus
                  selectTextOnFocus
                  maxLength={4}
                  placeholderTextColor={navy[400]}
                />
              </View>

              <Pressable
                style={({ pressed }) => [styles.saveBtn, { backgroundColor: TEAM[500] }, pressed && { opacity: 0.8 }]}
                onPress={handleSave}
              >
                <Text style={[styles.saveBtnText, { color: TEAM.on }]}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Player Edit Sheet ────────────────────────────────────────────────────────

function PlayerEditSheet({
  player, onSave, onClose,
}: {
  player: DuesPlayer;
  onSave: (msg: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { activeTeamId, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const [owedRaw,         setOwedRaw]         = useState(String(player.seasonAmount));
  const [paidRaw,         setPaidRaw]         = useState(String(player.paidAmount));
  const [notes,           setNotes]           = useState(player.notes ?? '');
  const [dueDate,         setDueDate]         = useState<Date | null>(player.dueDate);
  const [showDatePicker,  setShowDatePicker]  = useState(false);
  const [saving,          setSaving]          = useState(false);

  const owed = parseInt(owedRaw.replace(/[^0-9]/g, ''), 10) || 0;
  const paid = parseInt(paidRaw.replace(/[^0-9]/g, ''), 10) || 0;
  const now  = new Date();

  const computedStatus: DuesStatus =
    paid >= owed && owed > 0                    ? 'paid'
    : dueDate !== null && dueDate < now && paid < owed ? 'overdue'
    : paid > 0                                  ? 'partial'
    :                                             'pending';

  function onDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'set' && selected) setDueDate(selected);
  }

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    // Recompute status at save time with a fresh timestamp so overdue
    // records with dueDate set are evaluated correctly on write.
    const saveNow = new Date();
    const finalStatus: DuesStatus =
      paid >= owed && owed > 0                               ? 'paid'
      : dueDate !== null && dueDate < saveNow && paid < owed ? 'overdue'
      : paid > 0                                             ? 'partial'
      :                                                        'pending';
    try {
      await updateDoc(doc(db, 'teams', activeTeamId, 'dues', player.id), {
        amountPaid:   paid,
        seasonAmount: owed,
        status:       finalStatus,
        notes:        notes.trim(),
        dueDate:      dueDate !== null ? Timestamp.fromDate(dueDate) : deleteField(),
        ...(paid > 0 && { lastPaymentAt: serverTimestamp() }),
      });
      onSave('Payment record updated');
    } catch (err) {
      console.error('[DuesScreen] save failed:', err);
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
          <Pressable onPress={() => {}}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}>
              <View style={styles.sheetHandle} />

              {/* Player header */}
              <View style={styles.editHeader}>
                <PlayerAvatar player={player} />
                <Text style={styles.editPlayerName}>{player.name}</Text>
                <View style={{ flex: 1 }} />
                <StatusPill status={player.duesStatus} />
              </View>

              <View style={styles.editDivider} />

              {/* Amount owed */}
              <Text style={styles.fieldLabel}>AMOUNT OWED</Text>
              <View style={[styles.amountInputWrap, styles.fieldSpacing, { borderColor: TEAM[700] }]}>
                <Text style={styles.amountDollar}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={owedRaw}
                  onChangeText={t => setOwedRaw(t.replace(/[^0-9]/g, '').slice(0, 5))}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  maxLength={5}
                  placeholderTextColor={navy[400]}
                />
              </View>

              {/* Amount paid + live computed status */}
              <View style={[styles.fieldLabelRow, styles.fieldSpacing]}>
                <Text style={styles.fieldLabel}>AMOUNT PAID</Text>
                <StatusPill status={computedStatus} />
              </View>
              <View style={[styles.amountInputWrap, { borderColor: TEAM[700] }]}>
                <Text style={styles.amountDollar}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={paidRaw}
                  onChangeText={t => setPaidRaw(t.replace(/[^0-9]/g, '').slice(0, 5))}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  maxLength={5}
                  placeholderTextColor={navy[400]}
                />
              </View>

              {/* Due date */}
              <Pressable
                style={({ pressed }) => [styles.dueDateRow, styles.fieldSpacing, pressed && { opacity: 0.75 }]}
                onPress={() => setShowDatePicker(v => !v)}
              >
                <Text style={styles.fieldLabel}>DUE DATE</Text>
                <View style={styles.dueDateRight}>
                  <Text style={[styles.dueDateValue, !dueDate && styles.dueDatePlaceholder]}>
                    {dueDate ? formatDueDate(dueDate) : 'Not set'}
                  </Text>
                  <Text style={[styles.pickerChevron, showDatePicker && styles.pickerChevronOpen]}>›</Text>
                </View>
              </Pressable>

              {showDatePicker && (
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={dueDate ?? new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={onDateChange}
                    accentColor={TEAM[300]}
                    themeVariant="dark"
                  />
                  {Platform.OS === 'ios' && (
                    <Pressable
                      onPress={() => setShowDatePicker(false)}
                      style={({ pressed }) => [styles.pickerDone, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={[styles.pickerDoneText, { color: TEAM[300] }]}>Done</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Notes */}
              <Text style={[styles.fieldLabel, styles.fieldSpacing]}>NOTES</Text>
              <TextInput
                style={[styles.notesInput, styles.fieldSpacing]}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Paid $200 cash March 5"
                placeholderTextColor={navy[400]}
                multiline
                numberOfLines={2}
                maxLength={200}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: TEAM[500] },
                  (pressed || saving) && { opacity: 0.75 },
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={[styles.saveBtnText, { color: TEAM.on }]}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  Styles                                                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// alias to avoid shadowing the import
const statusColors = status;

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: navy[800],
  },

  // ── Header ────────────────────────────────────────────────────────────────
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
    paddingBottom: spacing[14],
  },
  embeddedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[10],
  },
  pageTitle: {
    ...T.headingXXL,
    color: '#FFFFFF',
  },
  ghostBtn: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[6],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.55)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
  },
  ghostBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: TEAM[300],
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: spacing[4],
  },

  // ── Summary banner ────────────────────────────────────────────────────────
  summaryCard: {
    marginHorizontal: spacing[16],
    backgroundColor: navy[700],
    borderRadius: radius.xxl,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: spacing[20],
    marginBottom: spacing[4],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing[16],
  },
  summaryLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: navy[400],
    marginBottom: spacing[4],
  },
  summaryAmount: {
    lineHeight: 36,
  },
  summaryAmountBold: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: -0.8,
    color: '#FFFFFF',
  },
  summaryAmountOf: {
    fontFamily: fonts.ui,
    fontSize: 16,
    color: navy[300],
  },
  summaryRight: {
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  summaryFraction: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: navy[200],
  },
  summaryPerPlayer: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: navy[400],
  },

  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: navy[600],
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: TEAM[500],
  },

  // ── Section label ─────────────────────────────────────────────────────────
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

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    marginHorizontal: spacing[16],
    backgroundColor: navy[700],
    borderRadius: radius.l,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },

  // ── Player row ────────────────────────────────────────────────────────────
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    gap: spacing[12],
  },
  playerInfo: {
    flex: 1,
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
    marginTop: 2,
  },
  playerRight: {
    alignItems: 'flex-end',
    gap: spacing[4],
  },
  playerAmount: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: navy[200],
  },
  playerAmountPartial: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: navy[300],
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
  avatarSpare: {
    backgroundColor: navy[700],
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.38)',
  },
  avatarText: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: TEAM[100],
  },
  sparePerGame: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: '#F59E0B',
    textTransform: 'uppercase',
  },
  spareAmount: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: '#F59E0B',
  },

  // ── Status pill ───────────────────────────────────────────────────────────
  pill: {
    paddingHorizontal: spacing[8],
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  pillLarge: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
    borderRadius: radius.s,
  },
  pillText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    fontWeight: '600',
  },
  pillTextLarge: {
    fontSize: 14,
  },

  // ── Row divider ───────────────────────────────────────────────────────────
  rowDivider: {
    height: 0.5,
    backgroundColor: navy[600],
    marginLeft: spacing[16],
  },

  // ── Balance card (player view) ────────────────────────────────────────────
  balanceCard: {
    marginHorizontal: spacing[16],
    backgroundColor: navy[700],
    borderRadius: radius.xxl,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: spacing[20],
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing[20],
  },
  balanceLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: navy[400],
    marginBottom: spacing[4],
  },
  balanceAmount: {
    fontFamily: fonts.display,
    fontSize: 40,
    letterSpacing: -1.2,
    color: '#FFFFFF',
  },
  balanceMeta: {
    flexDirection: 'row',
    gap: spacing[32],
    marginBottom: spacing[24],
  },
  balanceMetaItem: {
    gap: spacing[2],
  },
  balanceMetaLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: navy[400],
  },
  balanceMetaValue: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: navy[200],
  },
  payBtn: {
    backgroundColor: TEAM[500],
    borderRadius: radius.m,
    paddingVertical: spacing[14],
    alignItems: 'center',
  },
  payBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    fontWeight: '700',
    color: TEAM.on,
  },

  // ── Payment history ───────────────────────────────────────────────────────
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    gap: spacing[12],
  },
  historyLeft: {
    flex: 1,
    gap: spacing[2],
  },
  historyLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: navy[100],
  },
  historyDate: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: navy[400],
  },
  historyRight: {
    alignItems: 'flex-end',
    gap: spacing[4],
  },
  historyAmount: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: navy[200],
  },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
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
    fontFamily: fonts.ui,
    fontSize: 13,
    color: navy[300],
    marginBottom: spacing[24],
  },

  // ── Amount input ──────────────────────────────────────────────────────────
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: navy[800],
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: TEAM[700],
    paddingHorizontal: spacing[16],
    marginBottom: spacing[16],
  },
  amountDollar: {
    fontFamily: fonts.mono,
    fontSize: 24,
    color: navy[300],
    marginRight: spacing[4],
  },
  amountInput: {
    fontFamily: fonts.mono,
    fontSize: 32,
    color: '#FFFFFF',
    flex: 1,
    paddingVertical: spacing[14],
  },

  // ── Save button ───────────────────────────────────────────────────────────
  saveBtn: {
    backgroundColor: TEAM[500],
    borderRadius: radius.m,
    paddingVertical: spacing[14],
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  saveBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    fontWeight: '700',
    color: TEAM.on,
  },

  // ── Player edit sheet ─────────────────────────────────────────────────────
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    marginBottom: spacing[16],
  },
  editPlayerName: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  editDivider: {
    height: 0.5,
    backgroundColor: navy[600],
    marginBottom: spacing[20],
  },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: navy[400],
    marginBottom: spacing[8],
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[8],
  },
  fieldSpacing: {
    marginTop: spacing[16],
  },
  notesInput: {
    backgroundColor: navy[800],
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: navy[600],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
    fontFamily: fonts.ui,
    fontSize: 15,
    color: '#FFFFFF',
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: spacing[20],
  },

  // ── Due date picker row ───────────────────────────────────────────────────
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: navy[800],
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: navy[600],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  dueDateRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  dueDateValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: navy[100],
  },
  dueDatePlaceholder: {
    color: navy[400],
  },
  pickerChevron: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 22,
    color: navy[400],
    transform: [{ rotate: '90deg' }],
  },
  pickerChevronOpen: {
    transform: [{ rotate: '270deg' }],
  },
  pickerContainer: {
    backgroundColor: navy[800],
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: navy[600],
    marginTop: spacing[4],
    overflow: 'hidden',
  },
  pickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  pickerDoneText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
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
