import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation';
import { useUserContext } from '../../context/UserContext';
import { registerForPushNotifications } from '../../firebase/notifications';
import { auth } from '../../firebase';
import { navy, fonts, teams, spacing, radius } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingComplete'>;

export default function OnboardingCompleteScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const { teamId, teamName, palette, isManager } = route.params;
  const { completeOnboarding } = useUserContext();
  const accent = teams[palette];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing[16]) }]}>
      <View style={styles.hero}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.heading}>You're in!</Text>

        <View style={[styles.teamBadge, { borderColor: accent[500], backgroundColor: accent[900] }]}>
          <View style={[styles.teamDot, { backgroundColor: accent[300] }]} />
          <Text style={[styles.teamName, { color: accent[300] }]}>{teamName}</Text>
        </View>

        <Text style={styles.sub}>Your team is set up and ready to go.</Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: accent[500] },
          pressed && styles.btnPressed,
        ]}
        onPress={() => {
          const uid = auth.currentUser?.uid;
          if (uid) {
            registerForPushNotifications(uid, teamId).catch(console.error);
          }
          completeOnboarding(teamId, palette, isManager);
        }}
      >
        <Text style={styles.btnText}>Let's go</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[900],
    paddingHorizontal: spacing[24],
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[16],
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing[8],
  },
  heading: {
    fontFamily: fonts.wordmark,
    fontSize: 44,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: spacing[4],
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teamName: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
  },
  sub: {
    fontFamily: fonts.ui,
    fontSize: 15,
    color: navy[300],
    textAlign: 'center',
    marginTop: spacing[4],
  },
  btn: {
    borderRadius: radius.m,
    paddingVertical: spacing[16],
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  btnPressed: {
    opacity: 0.82,
  },
  btnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
