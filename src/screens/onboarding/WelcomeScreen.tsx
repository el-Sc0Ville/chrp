import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation';
import { navy, fonts, teams, spacing, radius } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

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
