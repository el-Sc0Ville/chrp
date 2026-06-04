import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { teams, fonts } from '../theme';
import { useUserContext } from '../context/UserContext';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase() || '?';
}

export default function AvatarPill({ onPress }: { onPress: () => void }) {
  const { user, activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const initials = user?.displayName ? getInitials(user.displayName) : '?';

  return (
    <Pressable
      style={[styles.pill, { backgroundColor: TEAM[500], shadowColor: TEAM[500] }]}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.15)', borderless: true }}
    >
      <Text style={[styles.initials, { color: TEAM.on }]}>{initials}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 6,
    elevation: 3,
  },
  initials: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    fontWeight: '700',
  },
});
