import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { navy, teams, fonts, type as T, spacing, radius } from '../theme';
import { useUserContext } from '../context/UserContext';

export default function GamedayScreen() {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Text style={[styles.backChevron, { color: TEAM[300] }]}>‹</Text>
          <Text style={[styles.backBtnText, { color: TEAM[300] }]}>Back</Text>
        </Pressable>
        <Text style={styles.pageTitle}>Gameday</Text>
      </View>

      <View style={styles.body}>
        <View style={[
          styles.card,
          {
            borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.30)`,
            backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.07)`,
          },
        ]}>
          <Text style={styles.icon}>🏒</Text>
          <Text style={styles.heading}>Gameday Mode is coming soon.</Text>
          <Text style={styles.description}>
            Live arrival tracking and geofence check-ins are launching in a future update.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[800],
  },
  header: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[10],
    paddingBottom: spacing[14],
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginBottom: spacing[6],
  },
  backChevron: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    marginTop: -2,
  },
  backBtnText: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
  },
  pageTitle: {
    ...T.headingXXL,
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[32],
    paddingBottom: spacing[64],
  },
  card: {
    width: '100%',
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing[32],
    alignItems: 'center',
    gap: spacing[12],
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  heading: {
    ...T.headingL,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  description: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: navy[300],
    textAlign: 'center',
  },
});

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
