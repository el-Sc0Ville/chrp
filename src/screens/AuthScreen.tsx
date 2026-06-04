// Auth gate — passwordless magic link sign-in + team invite code flow.

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navy, teams, status, fonts, signal, spacing, radius } from '../theme';
import { signInAnonymously } from 'firebase/auth';
import { getDocs, query, collection, where, limit } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase/config';
import { db } from '../firebase';
import { sendMagicLink } from '../firebase/auth';
import { useUserContext } from '../context/UserContext';
import { seedDatabase, updateMemberDefaults } from '../firebase/seed';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { setMockUser, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const [email,       setEmail]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [seedStatus,   setSeedStatus]   = useState<'idle' | 'seeding' | 'done' | 'error'>('idle');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'updating' | 'done' | 'error'>('idle');
  const [sent,        setSent]        = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [showInvite,    setShowInvite]    = useState(false);
  const [inviteCode,    setInviteCode]    = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError,   setRedeemError]   = useState<string | null>(null);
  const [devTapCount, setDevTapCount] = useState(0);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const devTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWordmarkTap = () => {
    if (!__DEV__) return;
    setDevTapCount(prev => {
      const next = prev + 1;
      if (devTapTimer.current) clearTimeout(devTapTimer.current);
      if (next >= 5) {
        setShowDevPanel(true);
        return 0;
      }
      devTapTimer.current = setTimeout(() => setDevTapCount(0), 2000);
      return next;
    });
  };

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleRedeem = async () => {
    const upper = inviteCode.trim().toUpperCase();
    if (upper.length < 6 || redeemLoading) return;
    setRedeemLoading(true);
    setRedeemError(null);
    try {
      console.log('Looking up invite code:', inviteCode);
      const snap = await getDocs(
        query(collection(db, 'teams'), where('inviteCode', '==', upper), limit(1)),
      );
      console.log('Query result:', snap.docs.length);
      if (snap.empty) {
        setRedeemError("That invite code doesn't look right. Check with your team manager.");
        return;
      }
      const teamDoc  = snap.docs[0];
      const teamData = teamDoc.data();
      // Save invite context so WelcomeScreen can skip ahead to ProfileSetup
      await AsyncStorage.setItem('chrp_pending_invite_code',    upper);
      await AsyncStorage.setItem('chrp_pending_team_id',        teamDoc.id);
      await AsyncStorage.setItem('chrp_pending_team_name',      teamData['name'] as string);
      await AsyncStorage.setItem('chrp_pending_team_palette',   (teamData['palette'] as string) ?? 'trashdogs');
      // Sign in anonymously — onAuthStateChanged detects pending invite and sets needsOnboarding
      await signInAnonymously(auth);
    } catch (err) {
      console.error('[AuthScreen] redeem error:', err);
      setRedeemError('Something went wrong. Please try again.');
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleSend = async () => {
    if (!isValidEmail || loading) return;
    setLoading(true);
    setError(null);
    try {
      await sendMagicLink(email.trim());
      setSent(true);
    } catch (e) {
      console.error('AuthScreen send error:', e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Wordmark ── */}
        <Pressable style={styles.wordmarkArea} onPress={handleWordmarkTap}>
          <Text style={styles.wordmark}>
            <Text style={styles.wordmarkCh}>Ch</Text>
            <Text style={styles.wordmarkRp}>rp</Text>
          </Text>
          <Text style={styles.tagline}>Your team. One tap away.</Text>
        </Pressable>

        {/* ── Sign-in card ── */}
        <View style={styles.card}>
          {!sent && <Text style={styles.cardLabel}>Sign in</Text>}
          {!sent && (
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={navy[500]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
          )}
          {!sent && error !== null && (
            <Text style={styles.errorText}>{error}</Text>
          )}
          {!sent && (
            <Pressable
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: TEAM[500], shadowColor: TEAM[500] },
                (!isValidEmail || loading) && styles.sendBtnDisabled,
                pressed && isValidEmail && !loading && { opacity: 0.85 },
              ]}
              onPress={handleSend}
              disabled={!isValidEmail || loading}
            >
              {loading
                ? <ActivityIndicator color={TEAM.on} size="small" />
                : <Text style={[styles.sendBtnText, { color: TEAM.on }]}>Send me a link</Text>
              }
            </Pressable>
          )}
          {sent && (
            <View style={styles.sentState}>
              <Text style={styles.sentIcon}>✉️</Text>
              <Text style={styles.sentTitle}>Check your email</Text>
              <Text style={styles.sentBody}>
                A sign-in link is on its way to {email}
              </Text>
              <Pressable
                onPress={() => setSent(false)}
                style={({ pressed }) => [styles.resendBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.resendBtnText, { color: TEAM[300] }]}>Use a different email</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Join a team ── */}
        {!sent && (
          <View style={styles.joinArea}>
            <Pressable
              style={({ pressed }) => [
                styles.joinBtn,
                {
                  borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.35)`,
                  backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
                },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setShowInvite(v => !v)}
            >
              <Text style={[styles.joinBtnText, { color: TEAM[300] }]}>Join a team instead</Text>
            </Pressable>

            {showInvite && (
              <View style={styles.inviteCard}>
                <Text style={styles.inviteLabel}>Enter your 6-character invite code</Text>
                <TextInput
                  style={styles.inviteInput}
                  value={inviteCode}
                  onChangeText={v => setInviteCode(v.toUpperCase().slice(0, 6))}
                  placeholder="ABC123"
                  placeholderTextColor={navy[500]}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.redeemBtn,
                    { backgroundColor: TEAM[500], shadowColor: TEAM[500] },
                    (inviteCode.length < 6 || redeemLoading) && styles.redeemBtnDisabled,
                    pressed && inviteCode.length === 6 && !redeemLoading && { opacity: 0.85 },
                  ]}
                  onPress={handleRedeem}
                  disabled={inviteCode.length < 6 || redeemLoading}
                >
                  {redeemLoading
                    ? <ActivityIndicator color={TEAM.on} size="small" />
                    : <Text style={[styles.redeemBtnText, { color: TEAM.on }]}>Redeem invite</Text>
                  }
                </Pressable>
                {redeemError !== null && (
                  <Text style={styles.redeemError}>{redeemError}</Text>
                )}
              </View>
            )}
          </View>
        )}
        {/* ── Dev bypass — tap wordmark 5× to reveal ── */}
        {__DEV__ && showDevPanel && (
          <View style={styles.devArea}>
            <Pressable
              style={({ pressed }) => [styles.devDismiss, pressed && { opacity: 0.6 }]}
              onPress={() => setShowDevPanel(false)}
            >
              <Text style={styles.devDismissText}>✕</Text>
            </Pressable>
            <Text style={styles.devLabel}>dev shortcuts</Text>
            <View style={styles.devRow}>
              <Pressable
                style={({ pressed }) => [styles.devBtn, pressed && { opacity: 0.7 }]}
                onPress={async () => {
                  console.log('MANAGER BUTTON PRESSED');
                  try {
                    console.log('Attempting anonymous sign in...');
                    const result = await signInAnonymously(auth);
                    console.log('Anonymous sign in SUCCESS, uid:', result.user.uid);
                    const mockUser = { ...result.user, uid: 'r1', displayName: 'Pat Normandin' };
                    setMockUser(mockUser as typeof result.user, true);
                    console.log('setMockUser called');
                  } catch (e) {
                    console.error('Anonymous sign in FAILED:', e);
                  }
                }}
              >
                <Text style={styles.devBtnText}>Enter as Manager (dev)</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.devBtn, pressed && { opacity: 0.7 }]}
                onPress={async () => {
                  const { user } = await signInAnonymously(auth);
                  const mockUser = { ...user, uid: 'r3', displayName: 'Pat Normandin' };
                  setMockUser(mockUser as typeof user, false);
                }}
              >
                <Text style={styles.devBtnText}>Enter as Player (dev)</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.devBtn, pressed && { opacity: 0.7 }]}
                onPress={async () => {
                  const { user } = await signInAnonymously(auth);
                  const mockUser = { ...user, uid: 'r9', displayName: 'Stéphane Lapointe' };
                  setMockUser(mockUser as typeof user, false);
                }}
              >
                <Text style={styles.devBtnText}>Enter as Spare (dev)</Text>
              </Pressable>
            </View>
            <Pressable
              style={({ pressed }) => [styles.devBtn, styles.devSeedBtn, pressed && { opacity: 0.7 }]}
              disabled={seedStatus === 'seeding'}
              onPress={async () => {
                setSeedStatus('seeding');
                try {
                  await seedDatabase();
                  setSeedStatus('done');
                } catch {
                  setSeedStatus('error');
                }
              }}
            >
              <Text style={styles.devBtnText}>
                {seedStatus === 'idle'    && 'Seed database (dev)'}
                {seedStatus === 'seeding' && 'Seeding…'}
                {seedStatus === 'done'    && 'Done! ✓'}
                {seedStatus === 'error'   && 'Error — check console'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.devBtn, styles.devSeedBtn, pressed && { opacity: 0.7 }]}
              disabled={updateStatus === 'updating'}
              onPress={async () => {
                setUpdateStatus('updating');
                try {
                  await updateMemberDefaults();
                  setUpdateStatus('done');
                } catch {
                  setUpdateStatus('error');
                }
              }}
            >
              <Text style={styles.devBtnText}>
                {updateStatus === 'idle'     && 'Update member defaults (dev)'}
                {updateStatus === 'updating' && 'Updating…'}
                {updateStatus === 'done'     && 'Done! ✓'}
                {updateStatus === 'error'    && 'Error — check console'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: navy[900],
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[24],
    paddingVertical: spacing[40],
  },

  // ── Wordmark ──────────────────────────────────────────────────────────────
  wordmarkArea: {
    alignItems: 'center',
    marginBottom: spacing[40],
  },
  wordmark: {
    fontFamily: fonts.wordmark,
    fontSize: 56,
    letterSpacing: -2,
    lineHeight: 60,
    marginBottom: spacing[8],
  },
  wordmarkCh: {
    color: '#E7ECF5',
  },
  wordmarkRp: {
    color: signal[400],
  },
  tagline: {
    fontFamily: fonts.ui,
    fontSize: 16, lineHeight: 22,
    color: navy[300], textAlign: 'center',
  },

  // ── Sign-in card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: navy[700],
    borderRadius: radius.xxl,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)',
    padding: spacing[20],
    marginBottom: spacing[16],
  },
  cardLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5, letterSpacing: 1.4,
    textTransform: 'uppercase', color: navy[400],
    marginBottom: spacing[12],
  },
  input: {
    height: 52,
    backgroundColor: navy[800],
    borderRadius: radius.l,
    borderWidth: 0.5, borderColor: navy[600],
    paddingHorizontal: spacing[16],
    fontFamily: fonts.ui,
    fontSize: 16, color: '#FFFFFF',
    marginBottom: spacing[12],
  },
  errorText: {
    fontFamily: fonts.ui, fontSize: 13,
    color: status.error.pure,
    marginTop: -spacing[4], marginBottom: spacing[8],
  },
  sendBtn: {
    height: 52, borderRadius: radius.l,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: navy[600], shadowOpacity: 0, elevation: 0,
  },
  sendBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600',
  },

  // ── Sent confirmation state ───────────────────────────────────────────────
  sentState: {
    alignItems: 'center', paddingVertical: spacing[8],
  },
  sentIcon: { fontSize: 36, marginBottom: spacing[12] },
  sentTitle: {
    fontFamily: fonts.display, fontSize: 20, fontWeight: '700',
    letterSpacing: -0.3, color: '#FFFFFF', marginBottom: spacing[8],
  },
  sentBody: {
    fontFamily: fonts.ui, fontSize: 14, lineHeight: 20,
    color: navy[300], textAlign: 'center', marginBottom: spacing[20],
  },
  resendBtn: { paddingVertical: spacing[4] },
  resendBtnText: {
    fontFamily: fonts.uiMedium, fontSize: 14,
  },

  // ── Join a team ───────────────────────────────────────────────────────────
  joinArea: { alignItems: 'center' },
  joinBtn: {
    paddingVertical: spacing[14], paddingHorizontal: spacing[24],
    borderRadius: radius.l, borderWidth: 1,
  },
  joinBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 14, fontWeight: '600',
  },

  // ── Invite code card ──────────────────────────────────────────────────────
  inviteCard: {
    width: '100%',
    backgroundColor: navy[700],
    borderRadius: radius.xxl, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: spacing[20], marginTop: spacing[12],
  },
  inviteLabel: {
    fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.4,
    textTransform: 'uppercase', color: navy[400],
    marginBottom: spacing[12],
  },
  inviteInput: {
    height: 56, backgroundColor: navy[800],
    borderRadius: radius.l, borderWidth: 0.5, borderColor: navy[600],
    paddingHorizontal: spacing[16],
    fontFamily: fonts.monoBold, fontSize: 22, fontWeight: '700',
    letterSpacing: 8, color: '#FFFFFF', textAlign: 'center',
    marginBottom: spacing[12],
  },
  redeemBtn: {
    height: 52, borderRadius: radius.l,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  redeemBtnDisabled: {
    backgroundColor: navy[600], shadowOpacity: 0, elevation: 0,
  },
  redeemBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600',
  },
  redeemError: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: status.error.pure,
    marginTop: spacing[8],
    textAlign: 'center',
  },

  // ── Dev bypass ───────────────────────────────────────────────────────────
  devDismiss: {
    alignSelf: 'flex-end',
    padding: spacing[4],
  },
  devDismissText: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: navy[400],
  },
  devArea: {
    alignItems: 'center',
    marginTop: spacing[32],
    paddingTop: spacing[20],
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: spacing[10],
  },
  devLabel: {
    fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1.6,
    textTransform: 'uppercase', color: navy[600],
  },
  devRow: {
    flexDirection: 'row', gap: spacing[8],
  },
  devBtn: {
    flex: 1,
    paddingVertical: spacing[10], paddingHorizontal: spacing[8],
    borderRadius: radius.l, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  devSeedBtn: {
    flex: 0, alignSelf: 'stretch', marginTop: spacing[6],
  },
  devBtnText: {
    fontFamily: fonts.uiMedium, fontSize: 12, fontWeight: '500',
    color: navy[400], textAlign: 'center',
  },
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
