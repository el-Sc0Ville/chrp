import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation';
import { navy, fonts, teams, spacing, radius, type TeamKey } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

const INVITE_KEYS = [
  'chrp_pending_invite_code',
  'chrp_pending_team_id',
  'chrp_pending_team_name',
  'chrp_pending_team_palette',
] as const;

export default function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const read = () => AsyncStorage.multiGet(INVITE_KEYS).then(pairs => pairs.map(p => p[1]));
      let [code, teamId, teamName, teamPalette] = await read();

      // Redeeming a code stores the code first (it must exist before the
      // anonymous sign-in) and the team details only once the lookup returns,
      // so this screen can mount in between. Wait briefly for the details
      // rather than falling back to the generic welcome and making the user
      // enter the code a second time.
      for (let i = 0; code && !teamId && i < 20 && !cancelled; i++) {
        await new Promise(r => setTimeout(r, 150));
        [code, teamId, teamName, teamPalette] = await read();
      }
      if (cancelled) return;

      if (code && teamId && teamName) {
        // Deliberately NOT cleared here. Clearing on the way into onboarding
        // meant abandoning it (or killing the app) destroyed the invite, and
        // the next launch had an anonymous session with no code and no team.
        // JoinTeamScreen clears these once the member doc is actually written.
        navigation.replace('ProfileSetup', {
          pendingInviteCode: code,
          teamId,
          teamName,
          teamPalette: (teamPalette ?? 'trashdogs') as TeamKey,
        });
        return;
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!ready) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing[16]) }]}>
      <View style={styles.hero}>
        <View style={styles.wordmarkRow}>
          <Text style={styles.wordmarkCh}>Ch</Text>
          <Text style={styles.wordmarkRp}>rp</Text>
        </View>
        <Text style={styles.tagline}>Your team. One tap away.</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={() => navigation.navigate('ProfileSetup')}
      >
        <Text style={styles.btnText}>Get started</Text>
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
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wordmarkCh: {
    fontFamily: fonts.wordmark,
    fontSize: 72,
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  wordmarkRp: {
    fontFamily: fonts.wordmark,
    fontSize: 72,
    color: teams.trashdogs[300],
    letterSpacing: -2,
  },
  tagline: {
    fontFamily: fonts.ui,
    fontSize: 17,
    color: navy[300],
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  btn: {
    backgroundColor: teams.trashdogs[500],
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
