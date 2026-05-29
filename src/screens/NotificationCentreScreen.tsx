// Notification centre — availability RSVP, announcements, sub confirmations.
// Part of the Home tab stack; accessible via bell icon in HomeScreen header.

import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { navy, teams, status, fonts, spacing, radius } from '../theme';
import {
  useNotifications,
  type AppNotification,
  type AvailabilityNotif,
  type AnnouncementNotif,
  type SubFilledNotif,
  type DateGroup,
} from '../context/NotificationContext';
import { useGameResponse, type PlayerResponse } from '../context/GameResponseContext';

const TEAM = teams.trashdogs;

const DATE_GROUPS: { key: DateGroup; label: string }[] = [
  { key: 'today',     label: 'Today'     },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'earlier',   label: 'Earlier'   },
];

// ─── Response button config ───────────────────────────────────────────────────

const RESP_CONFIG: { id: NonNullable<PlayerResponse>; label: string; glyph: string; fill: string; on: string }[] = [
  { id: 'in',    label: 'In',    glyph: '✓', fill: TEAM[500],         on: TEAM.on   },
  { id: 'out',   label: 'Out',   glyph: '✕', fill: status.error.pure, on: '#FFFFFF' },
  { id: 'maybe', label: 'Maybe', glyph: '?', fill: status.alert.pure, on: '#0B1220' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationCentreScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { notifications, markRead, markAllRead, unreadCount } = useNotifications();
  const { responses, setResponse } = useGameResponse();

  const [subSheetVisible, setSubSheetVisible] = useState(false);
  const [subGameName,     setSubGameName]     = useState('');
  const [toast,           setToast]           = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  const renderCard = (notif: AppNotification) => {
    switch (notif.type) {
      case 'availability':
        return (
          <AvailabilityCard
            key={notif.id}
            notif={notif}
            response={responses[notif.eventId] ?? null}
            onMarkRead={() => markRead(notif.id)}
            onRespond={(r) => {
              setResponse(notif.eventId, r);
              markRead(notif.id);
              if (r === 'out' || r === 'maybe') {
                setSubGameName(`vs. ${notif.opponent}`);
                setSubSheetVisible(true);
              }
              // TODO Phase 2: wire response to Firestore + trigger FCM confirmation
            }}
          />
        );
      case 'announcement':
        return (
          <AnnouncementCard
            key={notif.id}
            notif={notif}
            onPress={() => {
              markRead(notif.id);
              navigation.navigate('AnnouncementThread', { announcementId: notif.announcementId });
            }}
          />
        );
      case 'sub_filled':
        return (
          <SubFilledCard
            key={notif.id}
            notif={notif}
            onPress={() => markRead(notif.id)}
          />
        );
    }
  };

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
        <Text style={styles.navTitle}>Notifications</Text>
        <Pressable
          style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.6 }]}
          onPress={markAllRead}
          disabled={unreadCount === 0}
        >
          <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllDisabled]}>
            Mark all read
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing[24]) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {DATE_GROUPS.map(group => {
          const items = notifications.filter(n => n.date === group.key);
          if (items.length === 0) return null;
          return (
            <View key={group.key} style={styles.section}>
              <Text style={styles.sectionLabel}>{group.label}</Text>
              {items.map(renderCard)}
            </View>
          );
        })}

        {notifications.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptyBody}>New notifications will appear here.</Text>
          </View>
        )}
      </ScrollView>

      <SubRequestSheet
        visible={subSheetVisible}
        gameName={subGameName}
        onYes={() => {
          setSubSheetVisible(false);
          showToast('Request sent to manager');
          // TODO Phase 2: wire sub request to Firestore + trigger manager push notification
        }}
        onDismiss={() => setSubSheetVisible(false)}
      />
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

// ─── Availability card ────────────────────────────────────────────────────────

function AvailabilityCard({
  notif, response, onMarkRead, onRespond,
}: {
  notif: AvailabilityNotif;
  response: PlayerResponse;
  onMarkRead: () => void;
  onRespond: (r: NonNullable<PlayerResponse>) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        notif.read ? styles.cardRead : styles.cardUnread,
        pressed && styles.cardPressed,
      ]}
      onPress={onMarkRead}
    >
      {!notif.read && <View style={styles.cardAccent} />}
      <View style={styles.cardInner}>
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>🏒</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              Game vs {notif.opponent}
            </Text>
            <Text style={styles.cardSubtext}>
              {notif.weekday} · {notif.time}
            </Text>
          </View>
          <Text style={styles.timestamp}>{notif.timestamp}</Text>
        </View>

        <View style={styles.respRow}>
          {RESP_CONFIG.map(opt => {
            const isActive = response === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={({ pressed }) => [
                  styles.respBtn,
                  isActive
                    ? { backgroundColor: opt.fill, borderColor: opt.fill }
                    : styles.respBtnGhost,
                  pressed && !isActive && { opacity: 0.7 },
                ]}
                onPress={() => onRespond(opt.id)}
              >
                <Text style={[styles.respGlyph, { color: isActive ? opt.on : 'rgba(255,255,255,0.55)' }]}>
                  {opt.glyph}
                </Text>
                <Text style={[styles.respLabel, { color: isActive ? opt.on : 'rgba(255,255,255,0.70)' }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Announcement card ────────────────────────────────────────────────────────

function AnnouncementCard({
  notif, onPress,
}: {
  notif: AnnouncementNotif;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        notif.read ? styles.cardRead : styles.cardUnread,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      {!notif.read && <View style={styles.cardAccent} />}
      <View style={styles.cardInner}>
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>📢</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardTitle} numberOfLines={1}>{notif.authorName}</Text>
            <Text style={styles.cardPreview} numberOfLines={2}>{notif.body}</Text>
          </View>
          <Text style={styles.timestamp}>{notif.timestamp}</Text>
        </View>
        <Text style={styles.tapHint}>Tap to read thread →</Text>
      </View>
    </Pressable>
  );
}

// ─── Sub-filled card ──────────────────────────────────────────────────────────

function SubFilledCard({
  notif, onPress,
}: {
  notif: SubFilledNotif;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        notif.read ? styles.cardRead : styles.cardUnread,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      {!notif.read && <View style={styles.cardAccent} />}
      <View style={styles.cardInner}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, styles.iconWrapGreen]}>
            <Text style={styles.iconText}>✅</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardTitle}>Sub confirmed</Text>
            <Text style={styles.cardSubtext} numberOfLines={2}>
              {notif.subName} is covering your spot{'\n'}{notif.weekday} vs {notif.opponent}
            </Text>
          </View>
          <Text style={styles.timestamp}>{notif.timestamp}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Sub request sheet ────────────────────────────────────────────────────────

function SubRequestSheet({
  visible, gameName, onYes, onDismiss,
}: {
  visible: boolean;
  gameName: string;
  onYes: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.sheetBackdrop} onPress={onDismiss}>
        <Pressable
          onPress={() => {}}
          style={[styles.subRequestSheet, { paddingBottom: Math.max(insets.bottom, spacing[24]) }]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.subRequestTitle}>Need a sub?</Text>
          <Text style={styles.subRequestBody}>
            Want us to let your manager know you need a replacement for {gameName}?
          </Text>
          <Pressable
            style={({ pressed }) => [styles.subRequestYesBtn, pressed && { opacity: 0.85 }]}
            onPress={onYes}
          >
            <Text style={styles.subRequestYesBtnText}>Yes, request a sub</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.subRequestNoBtn, pressed && { opacity: 0.75 }]}
            onPress={onDismiss}
          >
            <Text style={styles.subRequestNoBtnText}>No thanks</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[800],
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
  markAllBtn: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  markAllText: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: TEAM[300],
  },
  markAllDisabled: {
    color: navy[500],
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: spacing[16],
    paddingHorizontal: spacing[16],
  },

  // ── Section ───────────────────────────────────────────────────────────────
  section: {
    marginBottom: spacing[8],
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: navy[400],
    marginBottom: spacing[8],
    paddingHorizontal: spacing[4],
  },

  // ── Card base ─────────────────────────────────────────────────────────────
  card: {
    borderRadius: radius.m,
    borderWidth: 0.5,
    overflow: 'hidden',
    marginBottom: spacing[8],
  },
  cardUnread: {
    backgroundColor: navy[700],
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.22)`,
  },
  cardRead: {
    backgroundColor: '#0F1A2E',
    borderColor: 'rgba(255,255,255,0.05)',
    opacity: 0.72,
  },
  cardPressed: {
    opacity: 0.80,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: TEAM[500],
  },
  cardInner: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
    paddingLeft: spacing[14] + 3,
  },

  // ── Card header row ───────────────────────────────────────────────────────
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[10],
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.14)`,
    borderWidth: 0.5,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.28)`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapGreen: {
    backgroundColor: 'rgba(52,199,89,0.12)',
    borderColor: 'rgba(52,199,89,0.28)',
  },
  iconText: {
    fontSize: 16,
    lineHeight: 20,
  },
  cardMeta: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  cardSubtext: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: navy[300],
    lineHeight: 18,
  },
  cardPreview: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: navy[300],
    lineHeight: 17,
  },
  timestamp: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: navy[400],
    marginTop: 2,
    flexShrink: 0,
  },
  tapHint: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: TEAM[300],
    marginTop: spacing[8],
    marginLeft: 34 + spacing[10],
  },

  // ── Availability response buttons ─────────────────────────────────────────
  respRow: {
    flexDirection: 'row',
    gap: spacing[8],
    marginTop: spacing[10],
    marginLeft: 34 + spacing[10],
  },
  respBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    borderRadius: radius.s,
    gap: 5,
    borderWidth: 1,
  },
  respBtnGhost: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  respGlyph: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    fontWeight: '700',
  },
  respLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing[48],
    paddingHorizontal: spacing[32],
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#FFFFFF',
    marginBottom: spacing[6],
  },
  emptyBody: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: navy[400],
    textAlign: 'center',
  },

  // ── Sub request sheet ─────────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.60)',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: navy[500],
    alignSelf: 'center', marginBottom: spacing[20],
  },
  subRequestSheet: {
    backgroundColor: navy[700],
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing[24], paddingTop: spacing[16],
    borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  subRequestTitle: {
    fontFamily: fonts.display, fontSize: 20, fontWeight: '700',
    letterSpacing: -0.3, color: '#FFFFFF',
    textAlign: 'center', marginBottom: spacing[10],
  },
  subRequestBody: {
    fontFamily: fonts.ui, fontSize: 14, lineHeight: 20,
    color: navy[300], textAlign: 'center', marginBottom: spacing[24],
  },
  subRequestYesBtn: {
    height: 52, borderRadius: radius.l, backgroundColor: TEAM[500],
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[10],
    shadowColor: TEAM[500], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  subRequestYesBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600', color: TEAM.on,
  },
  subRequestNoBtn: {
    height: 52, borderRadius: radius.l, borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[8],
  },
  subRequestNoBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600', color: TEAM[300],
  },

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: {
    position: 'absolute', left: spacing[20], right: spacing[20],
    backgroundColor: navy[700], borderRadius: radius.pill,
    borderWidth: 0.5, borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.40)`,
    paddingVertical: spacing[12], paddingHorizontal: spacing[20],
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 10,
  },
  toastText: { fontFamily: fonts.uiSemiBold, fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
