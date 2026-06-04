// JoinTeamScreen — Firestore write only. Code lookup happens in AuthScreen (manual)
// or App.tsx (deep link) before this screen is ever shown.

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation';
import { db, auth } from '../../firebase';
import { navy, fonts, teams, spacing, radius } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'JoinTeam'>;

export default function JoinTeamScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { displayName, jerseyNumber, teamId, teamName, teamPalette } = route.params;
  const TEAM = teams[teamPalette];
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { joinTeam(); }, []);

  async function joinTeam() {
    setError(null);
    try {
      let user = auth.currentUser;
      if (!user) {
        const result = await signInAnonymously(auth);
        user = result.user;
      }

      await setDoc(doc(db, 'teams', teamId, 'members', user.uid), {
        userId:      user.uid,
        displayName,
        jerseyNumber,
        role:        'player',
        email:       user.email ?? '',
        autoIn:      true,
        joinedAt:    serverTimestamp(),
      });

      await setDoc(doc(db, 'users', user.uid, 'teams', teamId), {
        teamId,
        teamName,
        palette:   teamPalette,
        role:      'player',
        joinedAt:  serverTimestamp(),
      });

      navigation.navigate('OnboardingComplete', {
        teamId,
        teamName,
        palette:   teamPalette,
        isManager: false,
      });
    } catch (err) {
      console.error('[JoinTeam]', err);
      setError('Something went wrong. Please try again.');
    }
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing[16]) }]}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          style={[styles.retryBtn, { backgroundColor: TEAM[500] }]}
          onPress={joinTeam}
        >
          <Text style={[styles.retryBtnText, { color: TEAM.on }]}>Try again</Text>
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
