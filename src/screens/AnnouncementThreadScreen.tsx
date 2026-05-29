// Announcement thread — original post + flat reply list + reply input.
// TODO Phase 2: wire replies to Firestore subcollection.

import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { navy, teams, status, fonts, type as T, spacing, radius } from '../theme';

const TEAM = teams.trashdogs;

// ─── Announcement data (mirrors AnnouncementsScreen SEED) ────────────────────

interface Post {
  id: string;
  authorName: string;
  authorInitials: string;
  body: string;
  timestamp: string;
  isPinned: boolean;
}

const POSTS: Record<string, Post> = {
  ann1: {
    id: 'ann1',
    authorName: 'Pat Normandin',
    authorInitials: 'PN',
    body: "⚠️ Heads up: ice time has moved to 9:45 pm this Sunday. Gate C is still our meeting point — see you out there.",
    timestamp: '2 hours ago',
    isPinned: true,
  },
  ann2: {
    id: 'ann2',
    authorName: 'Pat Normandin',
    authorInitials: 'PN',
    body: "New jerseys are in — see me before or after Sunday's game to pick yours up. Extra smalls and XLs still available.",
    timestamp: '1 day ago',
    isPinned: false,
  },
  ann3: {
    id: 'ann3',
    authorName: 'Marco Beauchamp',
    authorInitials: 'MB',
    body: "Friendly reminder to update your availability for the playoff rounds — we need a final headcount by Thursday noon.",
    timestamp: '3 days ago',
    isPinned: false,
  },
  ann4: {
    id: 'ann4',
    authorName: 'Pat Normandin',
    authorInitials: 'PN',
    body: "Great game last week everyone 🎉 Heading to Tavern on the Green after Sunday's game if you're in — first round's on me.",
    timestamp: '5 days ago',
    isPinned: false,
  },
};

// ─── Hardcoded replies ────────────────────────────────────────────────────────

interface Reply {
  id: string;
  authorName: string;
  authorInitials: string;
  body: string;
  timestamp: string;
}

const SEED_REPLIES: Record<string, Reply[]> = {
  ann1: [
    { id: 'r1a', authorName: 'Marco Beauchamp',  authorInitials: 'MB', body: "Got it. Does that change the warm-up time too?",             timestamp: '1 hour ago' },
    { id: 'r1b', authorName: 'Sophie Tremblay',  authorInitials: 'ST', body: "Thanks for the heads up! 👍",                               timestamp: '45 min ago' },
    { id: 'r1c', authorName: 'Jake Kowalski',    authorInitials: 'JK', body: "Will we still use the same entrance?",                      timestamp: '20 min ago' },
  ],
  ann2: [
    { id: 'r2a', authorName: 'Tyler MacPherson', authorInitials: 'TM', body: "Can we pick them up before the game on Sunday?",            timestamp: '20 hours ago' },
    { id: 'r2b', authorName: 'Nina Petrov',      authorInitials: 'NP', body: "I'm a medium — saving you the trouble of guessing 😄",      timestamp: '18 hours ago' },
  ],
  ann3: [
    { id: 'r3a', authorName: 'Lena Bergström',   authorInitials: 'LB', body: "Done! I put myself down for all three rounds.",             timestamp: '2 days ago' },
    { id: 'r3b', authorName: 'Chris Fontaine',   authorInitials: 'CF', body: "Updated. Good luck to us all 🏒",                           timestamp: '2 days ago' },
  ],
  ann4: [
    { id: 'r4a', authorName: 'Marco Beauchamp',  authorInitials: 'MB', body: "🙌 Count me in!",                                           timestamp: '4 days ago' },
    { id: 'r4b', authorName: 'Sam Delacroix',    authorInitials: 'SD', body: "I'll be there. Great game though!",                         timestamp: '4 days ago' },
    { id: 'r4c', authorName: 'Tyler MacPherson', authorInitials: 'TM', body: "On my way after ice time. See you all there.",              timestamp: '4 days ago' },
  ],
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AnnouncementThreadScreen() {
  const insets  = useSafeAreaInsets();
  const route   = useRoute<any>();
  const navigation = useNavigation<any>();
  const { announcementId } = route.params as { announcementId: string };

  const post    = POSTS[announcementId];
  const [replies, setReplies] = useState<Reply[]>(SEED_REPLIES[announcementId] ?? []);
  const [draft,  setDraft]    = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const sendReply = () => {
    const text = draft.trim();
    if (!text) return;
    const next: Reply = {
      id: `new-${Date.now()}`,
      authorName: 'Pat Normandin',
      authorInitials: 'PN',
      body: text,
      timestamp: 'Just now',
    };
    setReplies(prev => [...prev, next]);
    setDraft('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  if (!post) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Nav header ── */}
      <View style={styles.navHeader}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>Thread</Text>
        <View style={styles.backBtn} />
      </View>

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
          <View style={styles.originalCard}>
            {post.isPinned && (
              <View style={styles.pinnedBanner}>
                <Text style={styles.pinnedBannerText}>📌  Pinned</Text>
              </View>
            )}
            <View style={styles.cardHeader}>
              <View style={styles.authorAvatar}>
                <Text style={styles.authorAvatarText}>{post.authorInitials}</Text>
              </View>
              <View style={styles.authorMeta}>
                <Text style={styles.authorName}>{post.authorName}</Text>
                <Text style={styles.cardTimestamp}>{post.timestamp}</Text>
              </View>
            </View>
            <Text style={styles.cardBody}>{post.body}</Text>
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
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
            onPress={sendReply}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Reply row ────────────────────────────────────────────────────────────────

function ReplyRow({ reply }: { reply: Reply }) {
  return (
    <View style={styles.replyRow}>
      <View style={styles.replyAvatar}>
        <Text style={styles.replyAvatarText}>{reply.authorInitials}</Text>
      </View>
      <View style={styles.replyContent}>
        <View style={styles.replyMeta}>
          <Text style={styles.replyAuthor}>{reply.authorName}</Text>
          <Text style={styles.replyTimestamp}>{reply.timestamp}</Text>
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
