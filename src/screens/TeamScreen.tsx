// Team tab — hosts Roster, Announcements (Posts), and Dues as internal sub-tabs.
// Flip IS_MANAGER in each sub-screen to preview manager vs player views.

import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { navy, teams, fonts, spacing, radius } from '../theme';
import AvatarPill from '../components/AvatarPill';
import { useUserContext } from '../context/UserContext';
import { useTeam } from '../firebase/hooks/useTeam';
import RosterScreen from './RosterScreen';
import AnnouncementsScreen from './AnnouncementsScreen';
import DuesScreen from './DuesScreen';

const TEAM = teams.trashdogs;

type SubTab = 'roster' | 'announcements' | 'dues';

const SUB_TABS: { id: SubTab | 'subs'; label: string; navigate?: string }[] = [
  { id: 'roster',        label: 'Roster' },
  { id: 'announcements', label: 'Posts'  },
  { id: 'dues',          label: 'Dues'   },
  { id: 'subs',          label: 'Subs',  navigate: 'Subs' },
];

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { activeTeamId } = useUserContext();
  const { team } = useTeam(activeTeamId);
  const [activeTab, setActiveTab] = useState<SubTab>('roster');

  const goToProfile = () => navigation.navigate('Profile');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <View style={styles.teamPill}>
            <View style={styles.teamDot} />
            <Text style={styles.teamPillText}>{team?.name ?? 'Trash Dogs'}</Text>
            <Text style={styles.teamPillChevron}>›</Text>
          </View>
          <Text style={styles.pageTitle}>Team</Text>
        </View>
        <AvatarPill onPress={goToProfile} />
      </View>

      {/* ── Sub-tab bar ── */}
      <View style={styles.subTabBar}>
        {SUB_TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[styles.subTab, active && styles.subTabActive]}
              onPress={() => {
                if (tab.navigate) {
                  navigation.navigate(tab.navigate);
                } else {
                  setActiveTab(tab.id as SubTab);
                }
              }}
            >
              <Text style={[styles.subTabText, active && styles.subTabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Content ── */}
      <View style={styles.content}>
        {activeTab === 'roster'        && <RosterScreen embedded />}
        {activeTab === 'announcements' && <AnnouncementsScreen embedded />}
        {activeTab === 'dues'          && <DuesScreen embedded />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[800],
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
    paddingBottom: spacing[10],
  },
  teamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  teamDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: TEAM[300],
  },
  teamPillText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: TEAM[300],
    fontWeight: '600',
  },
  teamPillChevron: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: TEAM[300],
    lineHeight: 14,
  },
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },

  // ── Sub-tab bar ───────────────────────────────────────────────────────────
  subTabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[10],
    gap: spacing[8],
  },
  subTab: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[6],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'transparent',
  },
  subTabActive: {
    backgroundColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.18)`,
    borderColor: `rgba(${hexToRgbVals(TEAM[500])}, 0.45)`,
  },
  subTabText: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: 'rgba(229,234,242,0.50)',
  },
  subTabTextActive: {
    color: TEAM[300],
    fontFamily: fonts.uiSemiBold,
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: {
    flex: 1,
  },
});

function hexToRgbVals(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
