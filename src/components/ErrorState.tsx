// Shared listener-failure block. A dead Firestore listener otherwise falls
// through to a screen's empty state, which tells the user there is nothing
// there instead of that nothing loaded.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { teams, status, fonts, type as T, spacing, radius } from '../theme';
import { useUserContext } from '../context/UserContext';

export default function ErrorState({
  message, onRetry, compact = false,
}: {
  message?: string; onRetry?: () => void; compact?: boolean;
}) {
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Text style={styles.message}>{message ?? "Couldn't load this right now."}</Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryBtn,
            compact && styles.retryBtnCompact,
            { backgroundColor: TEAM[500] },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={[styles.retryBtnText, { color: TEAM.on }]}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[40],
    paddingHorizontal: spacing[24],
    gap: spacing[16],
  },
  containerCompact: {
    paddingVertical: spacing[20],
    gap: spacing[12],
  },
  message: {
    ...T.bodyM,
    color: status.error.light,
    textAlign: 'center',
  },
  retryBtn: {
    borderRadius: radius.m,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[28],
    alignItems: 'center',
  },
  retryBtnCompact: {
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[20],
  },
  retryBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
  },
});
