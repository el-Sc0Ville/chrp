import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation';
import { navy, fonts, teams, spacing, radius } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'JoinOrCreate'>;

export default function JoinOrCreateScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { displayName, jerseyNumber } = route.params;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing[16]) }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Join or start{'\n'}a team?</Text>
        <Text style={styles.sub}>You can always join more teams later.</Text>
      </View>

      <View style={styles.cards}>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('JoinTeam', { displayName, jerseyNumber })}
        >
          <Text style={styles.cardIcon}>🎟️</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Join a team</Text>
            <Text style={styles.cardSub}>I have an invite code</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('CreateTeam', { displayName, jerseyNumber })}
        >
          <Text style={styles.cardIcon}>⚡</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Create a team</Text>
            <Text style={styles.cardSub}>I'm a manager starting fresh</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[900],
    paddingHorizontal: spacing[24],
  },
  header: {
    paddingTop: spacing[48],
    marginBottom: spacing[40],
    gap: spacing[8],
  },
  heading: {
    fontFamily: fonts.wordmark,
    fontSize: 36,
    color: '#FFFFFF',
    letterSpacing: -0.8,
    lineHeight: 42,
  },
  sub: {
    fontFamily: fonts.ui,
    fontSize: 15,
    color: navy[300],
  },
  cards: {
    gap: spacing[16],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: navy[800],
    borderWidth: 1,
    borderColor: navy[600],
    borderRadius: radius.l,
    padding: spacing[20],
    gap: spacing[16],
  },
  cardPressed: {
    backgroundColor: navy[700],
    borderColor: teams.trashdogs[500],
  },
  cardIcon: {
    fontSize: 30,
  },
  cardBody: {
    flex: 1,
    gap: spacing[4],
  },
  cardTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  cardSub: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: navy[300],
  },
  chevron: {
    fontFamily: fonts.ui,
    fontSize: 24,
    color: navy[400],
    lineHeight: 28,
  },
});
