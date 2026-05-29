// Auth gate — passwordless magic link sign-in + team invite code flow.

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navy, teams, status, fonts, spacing, radius } from '../theme';
import { sendMagicLink } from '../firebase/auth';

const TEAM = teams.trashdogs;

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [email,       setEmail]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [showInvite,  setShowInvite]  = useState(false);
  const [inviteCode,  setInviteCode]  = useState('');

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSend = async () => {
    if (!isValidEmail || loading) return;
    setLoading(true);
    setError(null);
    try {
      await sendMagicLink(email.trim());
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
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
        <View style={styles.wordmarkArea}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>C</Text>
          </View>
          <Text style={styles.wordmark}>Chrp</Text>
          <Text style={styles.tagline}>Your team. One tap away.</Text>
        </View>

        {/* ── Sign-in card ── */}
        <View style={styles.card}>
          {!sent ? (
            <>
              <Text style={styles.cardLabel}>Sign in</Text>
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
              {error !== null && (
                <Text style={styles.errorText}>{error}</Text>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.sendBtn,
                  (!isValidEmail || loading) && styles.sendBtnDisabled,
                  pressed && isValidEmail && !loading && { opacity: 0.85 },
                ]}
                onPress={handleSend}
                disabled={!isValidEmail || loading}
              >
                {loading
                  ? <ActivityIndicator color={TEAM.on} size="small" />
                  : <Text style={styles.sendBtnText}>Send me a link</Text>
                }
              </Pressable>
            </>
          ) : (
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
                <Text style={styles.resendBtnText}>Use a different email</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Join a team ── */}
        {!sent && (
          <View style={styles.joinArea}>
            <Pressable
              style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setShowInvite(v => !v)}
            >
              <Text style={styles.joinBtnText}>Join a team instead</Text>
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
                    inviteCode.length < 6 && styles.redeemBtnDisabled,
                    pressed && inviteCode.length === 6 && { opacity: 0.85 },
                  ]}
                  disabled={inviteCode.length < 6}
                >
                  <Text style={styles.redeemBtnText}>Redeem invite</Text>
                </Pressable>
              </View>
            )}
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
    backgroundColor: navy[800],
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
  logoMark: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: TEAM[500],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[14],
    shadowColor: TEAM[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 8,
  },
  logoLetter: {
    fontFamily: fonts.display,
    fontSize: 28, fontWeight: '700',
    color: TEAM.on, letterSpacing: -0.5,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 38, fontWeight: '700',
    letterSpacing: -1.0, color: '#FFFFFF',
    marginBottom: spacing[6],
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
    backgroundColor: TEAM[500],
    alignItems: 'center', justifyContent: 'center',
    shadowColor: TEAM[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: navy[600], shadowOpacity: 0, elevation: 0,
  },
  sendBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600',
    color: TEAM.on,
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
    fontFamily: fonts.uiMedium, fontSize: 14, color: TEAM[300],
  },

  // ── Join a team ───────────────────────────────────────────────────────────
  joinArea: { alignItems: 'center' },
  joinBtn: {
    paddingVertical: spacing[14], paddingHorizontal: spacing[24],
    borderRadius: radius.l, borderWidth: 1,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.35)`,
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.08)`,
  },
  joinBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 14, fontWeight: '600',
    color: TEAM[300],
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
    backgroundColor: TEAM[500],
    alignItems: 'center', justifyContent: 'center',
    shadowColor: TEAM[500], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  redeemBtnDisabled: {
    backgroundColor: navy[600], shadowOpacity: 0, elevation: 0,
  },
  redeemBtnText: {
    fontFamily: fonts.uiSemiBold, fontSize: 15, fontWeight: '600',
    color: TEAM.on,
  },
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
