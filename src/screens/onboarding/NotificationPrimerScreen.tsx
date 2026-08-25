import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation';
import { navy, citrus, fonts, teams, status, spacing, radius } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NotificationPrimer'>;

const SEEN_KEY = 'chrp_primer_notifications_seen';

function rgb(hex: string): string {
  return `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;
}

export default function NotificationPrimerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { teamId, teamName, palette, isManager } = route.params;
  const accent = teams[palette];

  const [ready, setReady] = useState(false);
  const [busy, setBusy]   = useState(false);

  // Every exit from this screen goes forward. A denied permission is a normal
  // answer, not a failure, so the outcome is recorded and the flow continues.
  const advance = async (outcome: 'granted' | 'denied' | 'skipped') => {
    try {
      await AsyncStorage.setItem(SEEN_KEY, outcome);
    } catch (err) {
      console.error('[NotificationPrimer] could not persist outcome:', err);
    }
    navigation.replace('LocationPrimer', { teamId, teamName, palette, isManager });
  };

  useEffect(() => {
    (async () => {
      const seen = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
      // Already answered on an earlier run through onboarding — don't ask twice.
      if (seen) {
        navigation.replace('LocationPrimer', { teamId, teamName, palette, isManager });
        return;
      }
      setReady(true);
    })();
  }, []);

  const handleAllow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // expo-notifications v56: the PermissionResponse re-export is broken in
      // TypeScript, so .granted is read through a cast (same as firebase/notifications).
      const res = (await Notifications.requestPermissionsAsync()) as unknown as { granted: boolean };
      await advance(res.granted ? 'granted' : 'denied');
    } catch (err) {
      console.error('[NotificationPrimer] permission request failed:', err);
      await advance('denied');
    }
  };

  if (!ready) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing[16]) }]}>
      <View style={styles.hero}>
        <BellGlyph accent={accent[300]} glow={accent[500]} />

        <Text style={styles.heading}>Respond without{'\n'}opening the app</Text>
        <Text style={styles.body}>
          Chrp sends game reminders with In / Out / Maybe right on your lock screen.
          Allow notifications to get the full experience.
        </Text>

        <MockNotification accent={accent[300]} accentFill={accent[500]} />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: accent[500] },
          pressed && styles.btnPressed,
        ]}
        onPress={handleAllow}
        disabled={busy}
      >
        {busy
          ? <ActivityIndicator color={accent.on} />
          : <Text style={[styles.btnText, { color: accent.on }]}>Allow notifications</Text>
        }
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.btnGhost, pressed && styles.btnPressed]}
        onPress={() => { if (!busy) advance('skipped'); }}
        disabled={busy}
      >
        <Text style={styles.btnGhostText}>Maybe later</Text>
      </Pressable>
    </View>
  );
}

// ─── Bell glyph — Views only, no icon library ──────────────────────────────────

function BellGlyph({ accent, glow }: { accent: string; glow: string }) {
  return (
    <View style={styles.glowOuter}>
      <View style={[styles.glowRing, { backgroundColor: `rgba(${rgb(glow)}, 0.08)` }]} />
      <View style={[styles.glowCore, { backgroundColor: `rgba(${rgb(glow)}, 0.16)` }]} />

      <View style={styles.bell}>
        {/* Stem, dome, rim, clapper */}
        <View style={[styles.bellStem, { backgroundColor: accent }]} />
        <View style={[styles.bellDome, { borderColor: accent }]} />
        <View style={[styles.bellRim, { backgroundColor: accent }]} />
        <View style={[styles.bellClapper, { backgroundColor: accent }]} />
      </View>

      <View style={styles.badge} />
    </View>
  );
}

// ─── Mock notification — decorative preview, never pressable ──────────────────

function MockNotification({ accent, accentFill }: { accent: string; accentFill: string }) {
  return (
    <View style={styles.mockCard} pointerEvents="none" accessible={false}>
      <View style={styles.mockHeader}>
        <View style={[styles.mockChip, {
          backgroundColor: `rgba(${rgb(accentFill)}, 0.18)`,
          borderColor: `rgba(${rgb(accentFill)}, 0.42)`,
        }]}>
          <Text style={[styles.mockChipText, { color: accent }]}>CHRP</Text>
        </View>
        <Text style={styles.mockNow}>now</Text>
      </View>

      <Text style={styles.mockTitle}>Game Saturday — you in?</Text>
      <Text style={styles.mockMeta}>7:30 PM · MEMORIAL · RINK 2</Text>

      <View style={styles.mockPills}>
        <View style={[styles.mockPill, {
          backgroundColor: `rgba(${rgb(accentFill)}, 0.16)`,
          borderColor: `rgba(${rgb(accentFill)}, 0.38)`,
        }]}>
          <Text style={[styles.mockPillText, { color: accent }]}>In</Text>
        </View>
        <View style={[styles.mockPill, {
          backgroundColor: status.error.subtle,
          borderColor: `rgba(${rgb(status.error.pure)}, 0.38)`,
        }]}>
          <Text style={[styles.mockPillText, { color: status.error.light }]}>Out</Text>
        </View>
        <View style={[styles.mockPill, {
          backgroundColor: status.alert.subtle,
          borderColor: `rgba(${rgb(status.alert.pure)}, 0.38)`,
        }]}>
          <Text style={[styles.mockPillText, { color: status.alert.light }]}>Maybe</Text>
        </View>
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
  // Tighter gaps than the sibling onboarding screens: the mock card adds ~150pt
  // and the whole hero has to clear a 667pt phone without clipping.
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[12],
  },
  heading: {
    fontFamily: fonts.wordmark,
    fontSize: 30,
    lineHeight: 36,
    color: '#FFFFFF',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginTop: spacing[4],
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: 15,
    lineHeight: 22,
    color: navy[300],
    textAlign: 'center',
  },

  // ── Bell glyph ────────────────────────────────────────────────────────────
  glowOuter: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
  },
  glowCore: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: radius.pill,
  },
  bell: {
    width: 44,
    height: 46,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bellStem: {
    position: 'absolute',
    top: 0,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  bellDome: {
    width: 28,
    height: 26,
    marginBottom: spacing[2],
    borderWidth: 2.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  bellRim: {
    width: 38,
    height: 2.5,
    borderRadius: 1.5,
  },
  bellClapper: {
    width: 8,
    height: 4,
    marginTop: spacing[2],
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  badge: {
    position: 'absolute',
    top: 38,
    right: 40,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: citrus,
    borderWidth: 2.5,
    borderColor: navy[900],
  },

  // ── Mock notification ─────────────────────────────────────────────────────
  mockCard: {
    alignSelf: 'stretch',
    backgroundColor: navy[800],
    borderWidth: 1,
    borderColor: navy[600],
    borderRadius: radius.l,
    padding: spacing[16],
    gap: spacing[8],
    marginTop: spacing[8],
  },
  mockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mockChip: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[2],
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  mockChipText: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  mockNow: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: navy[400],
  },
  mockTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  mockMeta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: navy[300],
  },
  mockPills: {
    flexDirection: 'row',
    gap: spacing[8],
    marginTop: spacing[4],
  },
  mockPill: {
    flex: 1,
    height: 32,
    borderRadius: radius.s,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockPillText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  btn: {
    borderRadius: radius.m,
    paddingVertical: spacing[16],
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.82,
  },
  btnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
  },
  btnGhost: {
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: navy[600],
    paddingVertical: spacing[14],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[10],
    marginBottom: spacing[8],
  },
  btnGhostText: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
    color: navy[300],
  },
});
