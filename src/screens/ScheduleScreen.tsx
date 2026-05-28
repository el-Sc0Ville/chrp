import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navy, teams, fonts } from '../theme';

const TEAM = teams.trashdogs;

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.teamPill}>
          <View style={styles.teamDot} />
          <Text style={styles.teamName}>Trashdogs</Text>
        </View>
        <Text style={styles.pageTitle}>Schedule</Text>
      </View>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderIcon}>📅</Text>
        <Text style={styles.placeholderTitle}>B-02 / C-02</Text>
        <Text style={styles.placeholderSub}>Schedule list — coming soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: navy[800] },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  teamPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  teamDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: TEAM[300] },
  teamName: {
    fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2,
    textTransform: 'uppercase', color: TEAM[300], fontWeight: '600',
  },
  pageTitle: {
    fontFamily: fonts.display, fontSize: 26, fontWeight: '700',
    letterSpacing: -0.5, color: '#FFFFFF',
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderIcon: { fontSize: 40, marginBottom: 8 },
  placeholderTitle: {
    fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.4,
    textTransform: 'uppercase', color: TEAM[300], fontWeight: '600',
  },
  placeholderSub: {
    fontFamily: fonts.ui, fontSize: 14, color: 'rgba(229,234,242,0.45)',
  },
});
