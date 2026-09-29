// JoinTeamScreen — Firestore write only. Code lookup happens in AuthScreen (manual)
// or App.tsx (deep link) before this screen is ever shown.

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation';
import { db, auth } from '../../firebase';
import { navy, fonts, teams, spacing, radius } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'JoinTeam'>;

export default function JoinTeamScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { displayName, jerseyNumber, inviteCode, teamId, teamName, teamPalette } = route.params;
  const TEAM = teams[teamPalette];
  const [error, setError] = useState<string | null>(null);
  const [codeDead, setCodeDead] = useState(false);

  useEffect(() => { joinTeam(); }, []);

  async function joinTeam() {
    setError(null);
    try {
      let user = auth.currentUser;
      if (!user) {
        const result = await signInAnonymously(auth);
        user = result.user;
      }

      // Already a member (e.g. tapped the invite link again): keep their
      // member document — rewriting it would drop their push token and
      // settings, and demote a promoted manager back to player.
      const existing = await getDoc(doc(db, 'teams', teamId, 'members', user.uid)).catch(() => null);
      if (!existing?.exists()) await setDoc(doc(db, 'teams', teamId, 'members', user.uid), {
        userId:      user.uid,
        displayName,
        jerseyNumber,
        role:        'player',
        email:       user.email ?? '',
        autoIn:      true,
        // Recorded so the security rules can confirm this join was backed by a
        // real invite code for this team. Knowing a teamId alone is not enough.
        inviteCode,
        joinedAt:    serverTimestamp(),
      });

      await setDoc(doc(db, 'users', user.uid, 'teams', teamId), {
        teamId,
        teamName,
        palette:   teamPalette,
        role:      'player',
        joinedAt:  serverTimestamp(),
      });

      // Now the membership exists, the pending invite has served its purpose.
      // Clearing it earlier meant an abandoned onboarding destroyed the code.
      await AsyncStorage.multiRemove([
        'chrp_pending_invite_code',
        'chrp_pending_team_id',
        'chrp_pending_team_name',
        'chrp_pending_team_palette',
      ]).catch(() => {});

      // Permission primers run here, once membership exists — they hand the
      // same params on to OnboardingComplete.
      navigation.replace('NotificationPrimer', {
        teamId,
        teamName,
        palette:   teamPalette,
        isManager: false,
      });
    } catch (err) {
      console.error('[JoinTeam]', err);
      // permission-denied here means the code no longer resolves to this team
      // (e.g. the team was deleted). Retrying can never succeed, so offer a
      // way out instead of an endless "Try again".
      if ((err as { code?: string }).code === 'permission-denied') {
        setCodeDead(true);
        setError("This invite code isn't valid anymore. Ask your manager for a new one.");
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  }

  async function useDifferentCode() {
    await AsyncStorage.multiRemove([
      'chrp_pending_invite_code',
      'chrp_pending_team_id',
      'chrp_pending_team_name',
      'chrp_pending_team_palette',
    ]).catch(() => {});
    // Signing out returns to the sign-in screen, where a new code can be entered.
    await signOut(auth).catch(() => {});
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing[16]) }]}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          style={[styles.retryBtn, { backgroundColor: TEAM[500] }]}
          onPress={codeDead ? useDifferentCode : joinTeam}
        >
          <Text style={[styles.retryBtnText, { color: TEAM.on }]}>
            {codeDead ? 'Use a different code' : 'Try again'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
      <ActivityIndicator color={TEAM[500]} size="large" />
      <Text style={styles.loadingText}>Joining {teamName}…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[900],
    paddingHorizontal: spacing[24],
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[20],
  },
  loadingText: {
    fontFamily: fonts.uiMedium,
    fontSize: 17,
    color: navy[300],
  },
  errorText: {
    fontFamily: fonts.ui,
    fontSize: 15,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  retryBtn: {
    borderRadius: radius.m,
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[32],
    alignItems: 'center',
  },
  retryBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
  },
});
