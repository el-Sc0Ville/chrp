// Announcement thread — original post + flat reply list + reply input.

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { doc, collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { navy, teams, fonts, spacing, radius } from '../theme';
import { useUserContext } from '../context/UserContext';
import { useReplies } from '../firebase/hooks/useReplies';
import type { Announcement, AnnouncementReply } from '../firebase/schema';

const TEAM = teams.trashdogs; // StyleSheet fallback — dynamic overrides applied inline in components

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(createdAt: Timestamp | null | undefined): string {
  if (!createdAt) return 'Just now';
  const diffMs    = Date.now() - createdAt.toDate().getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays  = Math.floor(diffMs / 86_400_000);
  return diffHours < 1  ? 'Just now'
    : diffHours < 24    ? `${diffHours}h ago`
    : diffDays === 1    ? '1 day ago'
    : `${diffDays} days ago`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AnnouncementThreadScreen() {
  const insets     = useSafeAreaInsets();
  const route      = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user, activeTeamId, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];

  const { announcementId } = route.params as { announcementId: string };

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [draft,        setDraft]        = useState('');
  const [sending,      setSending]      = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const { replies } = useReplies(activeTeamId, announcementId);

  useEffect(() => {
    const ref = doc(db, 'teams', activeTeamId, 'announcements', announcementId);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) setAnnouncement({ id: snap.id, ...snap.data() } as Announcement);
    });
    return unsub;
  }, [announcementId]);

  const sendReply = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      await addDoc(
        collection(db, 'teams', activeTeamId, 'announcements', announcementId, 'replies'),
        {
          authorId:   user?.uid ?? 'anon',
          authorName: user?.displayName ?? 'Player',
          body:       text,
          createdAt:  serverTimestamp(),
        },
      );
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (err) {
      console.error('[AnnouncementThread] reply write failed:', err);
    } finally {
      setSending(false);
    }
  };

  // Show a minimal shell while the document loads (avoids blank screen)
  if (!announcement) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <NavHeader onBack={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <NavHeader onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 52}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, spacing[16]) + 72 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Original post ── */}
          <View style={[styles.originalCard, { borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.28)` }]}>
            {announcement.pinned && (
              <View style={[styles.pinnedBanner, { backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.14)`, borderBottomColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.22)` }]}>
                <Text style={[styles.pinnedBannerText, { color: TEAM[300] }]}>📌  Pinned</Text>
              </View>
            )}
            <View style={styles.cardHeader}>
              <View style={[styles.authorAvatar, { backgroundColor: TEAM[700], borderColor: TEAM[500] }]}>
                <Text style={[styles.authorAvatarText, { color: TEAM[100] }]}>{getInitials(announcement.authorName)}</Text>
              </View>
              <View style={styles.authorMeta}>
                <Text style={styles.authorName}>{announcement.authorName}</Text>
                <Text style={styles.cardTimestamp}>{formatTimestamp(announcement.createdAt)}</Text>
              </View>
            </View>
            <Text style={styles.cardBody}>{announcement.body}</Text>
          </View>

          {/* ── Thread label ── */}
          {replies.length > 0 && (
            <Text style={styles.threadLabel}>
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </Text>
          )}

          {/* ── Replies ── */}
          {replies.map(reply => (
            <ReplyRow key={reply.id} reply={reply} />
          ))}

          {replies.length === 0 && (
            <Text style={styles.emptyReplies}>Be the first to reply.</Text>
          )}
        </ScrollView>

        {/* ── Reply input ── */}
        <View style={[styles.replyBar, { paddingBottom: Math.max(insets.bottom, spacing[12]) }]}>
          <TextInput
            style={styles.replyInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Reply…"
            placeholderTextColor={navy[400]}
            multiline
            maxLength={280}
            returnKeyType="default"
          />
          <Pressable
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled, { backgroundColor: TEAM[500] }]}
            onPress={sendReply}
          >
            <Text style={[styles.sendBtnText, { color: TEAM.on }]}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavHeader({ onBack }: { onBack: () => void }) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  return (
    <View style={styles.navHeader}>
      <Pressable
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        onPress={onBack}
      >
        <Text style={[styles.backBtnText, { color: TEAM[300] }]}>‹ Back</Text>
      </Pressable>
      <Text style={styles.navTitle} numberOfLines={1}>Thread</Text>
      <View style={styles.backBtn} />
    </View>
  );
}

function ReplyRow({ reply }: { reply: AnnouncementReply }) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  return (
    <View style={styles.replyRow}>
      <View style={[styles.replyAvatar, { backgroundColor: TEAM[700], borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.30)` }]}>
        <Text style={[styles.replyAvatarText, { color: TEAM[100] }]}>{getInitials(reply.authorName)}</Text>
      </View>
      <View style={styles.replyContent}>
        <View style={styles.replyMeta}>
          <Text style={styles.replyAuthor}>{reply.authorName}</Text>
          <Text style={styles.replyTimestamp}>{formatTimestamp(reply.createdAt)}</Text>
        </View>
        <Text style={styles.replyBody}>{reply.body}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[800],
  },
  flex: {
    flex: 1,
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
  navTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },

  // ── Original post card ────────────────────────────────────────────────────
  originalCard: {
    backgroundColor: navy[700],
    borderRadius: radius.l,
    borderWidth: 0.5,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.28)`,
    overflow: 'hidden',
    marginBottom: spacing[20],
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
  cardBody: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 21,
    color: navy[100],
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[16],
  },

  // ── Thread label ──────────────────────────────────────────────────────────
  threadLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: navy[400],
    marginBottom: spacing[12],
  },
  emptyReplies: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: navy[400],
    textAlign: 'center',
    paddingVertical: spacing[24],
  },

  // ── Reply row ─────────────────────────────────────────────────────────────
  replyRow: {
    flexDirection: 'row',
    gap: spacing[10],
    marginBottom: spacing[14],
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TEAM[700],
    borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.30)`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  replyAvatarText: {
    fontFamily: fonts.uiBold,
    fontSize: 9,
    color: TEAM[100],
  },
  replyContent: {
    flex: 1,
    backgroundColor: navy[700],
    borderRadius: radius.m,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: spacing[12],
  },
  replyMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[8],
    marginBottom: 4,
  },
  replyAuthor: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    color: navy[100],
  },
  replyTimestamp: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: navy[400],
  },
  replyBody: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    color: navy[200],
  },

  // ── Reply input bar ───────────────────────────────────────────────────────
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[10],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
    backgroundColor: navy[800],
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  replyInput: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    backgroundColor: navy[700],
    borderRadius: radius.m,
    borderWidth: 0.5,
    borderColor: navy[500],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
  sendBtnText: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: TEAM.on,
    lineHeight: 22,
  },
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
