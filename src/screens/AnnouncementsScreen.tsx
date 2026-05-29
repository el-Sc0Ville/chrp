// Announcements screen — B-12 Manager Announcements / Player Announcements.
// Flip IS_MANAGER to preview each view. Replace with auth role when Firebase is wired.
// Accepts embedded={true} when rendered inside TeamScreen (no header, no safe area top).

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Switch,
  Modal, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { navy, teams, status, fonts, type as T, spacing, radius } from '../theme';
import { useUserContext } from '../context/UserContext';

const TEAM = teams.trashdogs;
const CURRENT_USER_ID = 'r1'; // Pat Normandin — replace with auth uid in Phase 2
const MAX_CHARS = 500;

interface Announcement {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  body: string;
  timestamp: string;
  isPinned: boolean;
  seenBy: number;
  totalPlayers: number;
}

const SEED: Announcement[] = [
  {
    id: 'ann1',
    authorId: 'r1',
    authorName: 'Pat Normandin',
    authorInitials: 'PN',
    body: "⚠️ Heads up: ice time has moved to 9:45 pm this Sunday. Gate C is still our meeting point — see you out there.",
    timestamp: '2 hours ago',
    isPinned: true,
    seenBy: 10,
    totalPlayers: 12,
  },
  {
    id: 'ann2',
    authorId: 'r1',
    authorName: 'Pat Normandin',
    authorInitials: 'PN',
    body: "New jerseys are in — see me before or after Sunday's game to pick yours up. Extra smalls and XLs still available.",
    timestamp: '1 day ago',
    isPinned: false,
    seenBy: 8,
    totalPlayers: 12,
  },
  {
    id: 'ann3',
    authorId: 'r2',
    authorName: 'Marco Beauchamp',
    authorInitials: 'MB',
    body: "Friendly reminder to update your availability for the playoff rounds — we need a final headcount by Thursday noon.",
    timestamp: '3 days ago',
    isPinned: false,
    seenBy: 11,
    totalPlayers: 12,
  },
  {
    id: 'ann4',
    authorId: 'r1',
    authorName: 'Pat Normandin',
    authorInitials: 'PN',
    body: "Great game last week everyone 🎉 Heading to Tavern on the Green after Sunday's game if you're in — first round's on me.",
    timestamp: '5 days ago',
    isPinned: false,
    seenBy: 12,
    totalPlayers: 12,
  },
];

function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort((a, b) => {
    if (a.isPinned === b.isPinned) return 0;
    return a.isPinned ? -1 : 1;
  });
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function AnnouncementsScreen({ embedded }: { embedded?: boolean }) {
  const { isManager } = useUserContext();
  return isManager
    ? <ManagerView embedded={embedded} />
    : <PlayerView  embedded={embedded} />;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  B-12 · Manager View                                                     ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function ManagerView({ embedded }: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [announcements, setAnnouncements] = useState<Announcement[]>(SEED);
  const [postVisible, setPostVisible]     = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [actionItem, setActionItem]       = useState<Announcement | null>(null);
  const [toast, setToast]                 = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const editingAnnouncement = editingId
    ? announcements.find(a => a.id === editingId) ?? null
    : null;

  const handlePost = (body: string, isPinned: boolean) => {
    if (editingId) {
      setAnnouncements(prev =>
        prev.map(a => a.id === editingId ? { ...a, body, isPinned } : a),
      );
      showToast('Announcement updated');
    } else {
      const next: Announcement = {
        id: `ann${Date.now()}`,
        authorId: CURRENT_USER_ID,
        authorName: 'Pat Normandin',
        authorInitials: 'PN',
        body,
        timestamp: 'Just now',
        isPinned,
        seenBy: 1,
        totalPlayers: 12,
      };
      setAnnouncements(prev => [next, ...prev]);
      showToast('Sent to all players');
    }
    setPostVisible(false);
    setEditingId(null);
  };

  const handleEdit = () => {
    if (!actionItem) return;
    setEditingId(actionItem.id);
    setActionItem(null);
    setPostVisible(true);
  };

  const handleDelete = () => {
    if (!actionItem) return;
    setAnnouncements(prev => prev.filter(a => a.id !== actionItem.id));
    setActionItem(null);
    showToast('Announcement deleted');
  };

  const openPost = () => {
    setEditingId(null);
    setPostVisible(true);
  };

  const goToThread = (id: string) => navigation.navigate('AnnouncementThread', { announcementId: id });

  const paddingTop = embedded ? 0 : insets.top;

  return (
    <View style={[styles.container, { paddingTop }]}>

      {/* ── Header (hidden when embedded) ── */}
      {!embedded && (
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Announcements</Text>
          <Pressable
            style={({ pressed }) => [styles.postBtn, pressed && { opacity: 0.75 }]}
            onPress={openPost}
          >
            <Text style={styles.postBtnText}>Post</Text>
          </Pressable>
        </View>
      )}

      {/* ── Post button row (embedded — shows inline above scroll) ── */}
      {embedded && (
        <View style={styles.embeddedPostRow}>
          <Pressable
            style={({ pressed }) => [styles.postBtn, pressed && { opacity: 0.75 }]}
            onPress={openPost}
          >
            <Text style={styles.postBtnText}>Post</Text>
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
        {sortAnnouncements(announcements).map((item, idx) => (
          <AnnouncementCard
            key={item.id}
            announcement={item}
            showSeenBy
            style={idx === 0 ? undefined : styles.cardGap}
            onPress={() => goToThread(item.id)}
            onLongPress={item.authorId === CURRENT_USER_ID ? () => setActionItem(item) : undefined}
          />
        ))}
      </ScrollView>

      {/* ── Post sheet ── */}
      <PostSheet
        visible={postVisible}
        mode={editingId ? 'edit' : 'post'}
        initialBody={editingAnnouncement?.body ?? ''}
        initialPinned={editingAnnouncement?.isPinned ?? false}
        onSubmit={handlePost}
        onClose={() => { setPostVisible(false); setEditingId(null); }}
      />

      {/* ── Long-press action sheet ── */}
      {actionItem && (
        <ActionSheet
          announcement={actionItem}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClose={() => setActionItem(null)}
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
// ║  C-12 · Player View                                                      ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

function PlayerView({ embedded }: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [readIds, setReadIds] = useState<Set<string>>(new Set(['ann3', 'ann4']));

  const markRead = (id: string) => setReadIds(prev => new Set([...prev, id]));
  const goToThread = (id: string) => {
    markRead(id);
    navigation.navigate('AnnouncementThread', { announcementId: id });
  };

  const paddingTop = embedded ? 0 : insets.top;

  return (
    <View style={[styles.container, { paddingTop }]}>

      {/* ── Header (hidden when embedded) ── */}
      {!embedded && (
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Announcements</Text>
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
        {sortAnnouncements(SEED).map((item, idx) => (
          <AnnouncementCard
            key={item.id}
            announcement={item}
            showSeenBy={false}
            unread={!readIds.has(item.id)}
            style={idx === 0 ? undefined : styles.cardGap}
            onPress={() => goToThread(item.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  Sub-components                                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// ─── Announcement card ────────────────────────────────────────────────────────

function AnnouncementCard({
  announcement,
  showSeenBy,
  unread,
  style,
  onPress,
  onLongPress,
}: {
  announcement: Announcement;
  showSeenBy: boolean;
  unread?: boolean;
  style?: object;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        unread && styles.cardUnread,
        pressed && { opacity: 0.88 },
        style,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      {announcement.isPinned && (
        <View style={styles.pinnedBanner}>
          <Text style={styles.pinnedBannerText}>📌  Pinned</Text>
        </View>
      )}

      {/* Author row */}
      <View style={styles.cardHeader}>
        <View style={styles.authorAvatar}>
          <Text style={styles.authorAvatarText}>{announcement.authorInitials}</Text>
        </View>
        <View style={styles.authorMeta}>
          <Text style={styles.authorName}>{announcement.authorName}</Text>
          <Text style={styles.cardTimestamp}>{announcement.timestamp}</Text>
        </View>
        {unread && <View style={styles.unreadDot} />}
      </View>

      {/* Body */}
      <Text style={styles.cardBody}>{announcement.body}</Text>

      {/* Seen receipt — manager view only */}
      {showSeenBy && (
        <Text style={styles.seenBy}>
          Seen by {announcement.seenBy} of {announcement.totalPlayers}
        </Text>
      )}
    </Pressable>
  );
}

// ─── Post sheet ───────────────────────────────────────────────────────────────

function PostSheet({
  visible, mode, initialBody, initialPinned, onSubmit, onClose,
}: {
  visible: boolean;
  mode: 'post' | 'edit';
  initialBody: string;
  initialPinned: boolean;
  onSubmit: (body: string, pinned: boolean) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [body, setBody]       = useState(initialBody);
  const [pinned, setPinned]   = useState(initialPinned);

  useEffect(() => {
    if (visible) {
      setBody(initialBody);
      setPinned(initialPinned);
    }
  }, [visible]);

  const remaining = MAX_CHARS - body.length;
  const canSubmit = body.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
          <Pressable onPress={() => {}}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>
                {mode === 'edit' ? 'Edit announcement' : 'Post announcement'}
              </Text>

              {/* Text input */}
              <View style={styles.textInputWrap}>
                <TextInput
                  style={styles.textInput}
                  value={body}
                  onChangeText={text => setBody(text.slice(0, MAX_CHARS))}
                  placeholder="What does the team need to know?"
                  placeholderTextColor={navy[400]}
                  multiline
                  autoFocus
                  maxLength={MAX_CHARS}
                  textAlignVertical="top"
                />
                <Text style={[styles.charCount, remaining < 50 && styles.charCountWarn]}>
                  {body.length} / {MAX_CHARS}
                </Text>
              </View>

              {/* Pin toggle */}
              <View style={styles.pinRow}>
                <View style={styles.pinLeft}>
                  <Text style={styles.pinLabel}>📌  Pin to top</Text>
                  <Text style={styles.pinSub}>Stays above other posts until unpinned</Text>
                </View>
                <Switch
                  value={pinned}
                  onValueChange={setPinned}
                  trackColor={{ false: navy[600], true: TEAM[500] }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={navy[600]}
                />
              </View>

              {/* Send button */}
              <Pressable
                style={({ pressed }) => [
                  styles.sendBtn,
                  !canSubmit && styles.sendBtnDisabled,
                  pressed && canSubmit && { opacity: 0.8 },
                ]}
                onPress={() => canSubmit && onSubmit(body.trim(), pinned)}
              >
                <Text style={styles.sendBtnText}>
                  {mode === 'edit' ? 'Save changes' : 'Send to all players'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Long-press action sheet ──────────────────────────────────────────────────

function ActionSheet({
  announcement, onEdit, onDelete, onClose,
}: {
  announcement: Announcement;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {announcement.body.slice(0, 48)}{announcement.body.length > 48 ? '…' : ''}
            </Text>
            <View style={styles.actionDivider} />
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: navy[600] }]}
              onPress={onEdit}
            >
              <Text style={styles.actionRowText}>Edit</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: navy[600] }]}
              onPress={onDelete}
            >
              <Text style={[styles.actionRowText, styles.actionRowDestructive]}>Delete</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionRow, styles.actionRowLast, pressed && { backgroundColor: navy[600] }]}
              onPress={onClose}
            >
              <Text style={styles.actionRowMuted}>Cancel</Text>
            </Pressable>
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

  // ── Header ────────────────────────────────────────────────────────────────
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
    paddingBottom: spacing[14],
  },
  pageTitle: {
    ...T.headingXXL,
    color: '#FFFFFF',
  },
  postBtn: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
    borderRadius: radius.pill,
    backgroundColor: TEAM[500],
  },
  postBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    fontWeight: '600',
    color: TEAM.on,
  },

  // Embedded-mode post button row (no title, just the button flush right)
  embeddedPostRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[10],
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[8],
  },
  cardGap: {
    marginTop: spacing[12],
  },

  // ── Announcement card ─────────────────────────────────────────────────────
  card: {
    backgroundColor: navy[700],
    borderRadius: radius.l,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  cardUnread: {
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.10)`,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.28)`,
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.14)`,
    borderBottomWidth: 0.5,
    borderBottomColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.22)`,
  },
  pinnedBannerText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: TEAM[300],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[14],
    paddingBottom: spacing[10],
  },
  authorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: TEAM[700],
    borderWidth: 1.5,
    borderColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarText: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    color: TEAM[100],
  },
  authorMeta: {
    flex: 1,
    gap: 1,
  },
  authorName: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: navy[100],
  },
  cardTimestamp: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: navy[400],
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: TEAM[300],
  },
  cardBody: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 21,
    color: navy[100],
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[14],
  },
  seenBy: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: navy[400],
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[14],
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
    marginBottom: spacing[16],
  },

  // ── Post sheet internals ──────────────────────────────────────────────────
  textInputWrap: {
    backgroundColor: navy[800],
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: navy[600],
    marginBottom: spacing[16],
    paddingHorizontal: spacing[14],
    paddingTop: spacing[12],
    paddingBottom: spacing[8],
    minHeight: 120,
  },
  textInput: {
    fontFamily: fonts.ui,
    fontSize: 15,
    lineHeight: 22,
    color: '#FFFFFF',
    minHeight: 80,
  },
  charCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: navy[400],
    textAlign: 'right',
    marginTop: spacing[4],
  },
  charCountWarn: {
    color: status.error.pure,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[12],
    marginBottom: spacing[16],
    borderTopWidth: 0.5,
    borderTopColor: navy[600],
  },
  pinLeft: {
    flex: 1,
    gap: 2,
  },
  pinLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: navy[100],
  },
  pinSub: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: navy[400],
  },
  sendBtn: {
    backgroundColor: TEAM[500],
    borderRadius: radius.m,
    paddingVertical: spacing[14],
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    fontWeight: '700',
    color: TEAM.on,
  },

  // ── Action sheet internals ────────────────────────────────────────────────
  actionDivider: {
    height: 0.5,
    backgroundColor: navy[600],
    marginBottom: spacing[8],
  },
  actionRow: {
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[4],
    borderRadius: radius.s,
  },
  actionRowLast: {
    marginTop: spacing[4],
  },
  actionRowText: {
    fontFamily: fonts.uiMedium,
    fontSize: 16,
    color: navy[100],
  },
  actionRowDestructive: {
    color: status.error.pure,
  },
  actionRowMuted: {
    fontFamily: fonts.uiMedium,
    fontSize: 16,
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
