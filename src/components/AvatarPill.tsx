import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { teams, fonts } from '../theme';

const TEAM = teams.trashdogs;

export default function AvatarPill({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={styles.pill}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.15)', borderless: true }}
    >
      <Text style={styles.initials}>PN</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TEAM[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 6,
    elevation: 3,
  },
  initials: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    fontWeight: '700',
    color: TEAM.on,
  },
});
