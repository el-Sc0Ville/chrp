import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation';
import { navy, fonts, teams, spacing, radius } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'LocationPrimer'>;

const SEEN_KEY = 'chrp_primer_location_seen';

const REASSURANCES = ['90 MIN ONLY', 'NEVER STORED', 'TEAM ONLY'] as const;

function rgb(hex: string): string {
  return `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;
}

export default function LocationPrimerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { teamId, teamName, palette, isManager } = route.params;
  const accent = teams[palette];

  const [ready, setReady] = useState(false);
  const [busy, setBusy]   = useState(false);

  // A refused permission is a normal outcome — record it and keep going.
  const advance = async (outcome: 'granted' | 'denied' | 'skipped') => {
    try {
      await AsyncStorage.setItem(SEEN_KEY, outcome);
    } catch (err) {
      console.error('[LocationPrimer] could not persist outcome:', err);
    }
    navigation.replace('OnboardingComplete', { teamId, teamName, palette, isManager });
  };

  useEffect(() => {
    (async () => {
      const seen = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
      if (seen) {
        navigation.replace('OnboardingComplete', { teamId, teamName, palette, isManager });
        return;
      }
      setReady(true);
    })();
  }, []);

  const handleAllow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Foreground only. Escalating to Always lives behind the gameday screen's
      // own opt-in — asking for it during onboarding is an App Review problem.
      const { status } = await Location.requestForegroundPermissionsAsync();
      await advance(status === 'granted' ? 'granted' : 'denied');
    } catch (err) {
      console.error('[LocationPrimer] permission request failed:', err);
      await advance('denied');
    }
  };

  if (!ready) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing[16]) }]}>
      <View style={styles.hero}>
        <PinGlyph fill={accent[500]} on={accent.on} />

        <Text style={styles.heading}>Know when your{'\n'}team&apos;s close</Text>
        <Text style={styles.body}>
          On game days, Chrp briefly checks if you&apos;re near the rink so you don&apos;t have to
          report in. Your location is never stored or shared.
        </Text>

        <View style={styles.chips}>
          {REASSURANCES.map(label => (
            <View key={label} style={styles.chip}>
              <Text style={styles.chipText}>{label}</Text>
            </View>
          ))}
        </View>
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
          : <Text style={[styles.btnText, { color: accent.on }]}>Allow location</Text>
        }
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.btnGhost, pressed && styles.btnPressed]}
        onPress={() => { if (!busy) advance('skipped'); }}
        disabled={busy}
      >
        <Text style={styles.btnGhostText}>Skip for now</Text>
      </Pressable>

      <Text style={styles.footnote}>You can change this anytime in Profile → Location.</Text>
    </View>
  );
}

// ─── Map-pin glyph — Views only, no icon library ───────────────────────────────

function PinGlyph({ fill, on }: { fill: string; on: string }) {
  return (
    <View style={styles.glowOuter}>
      <View style={[styles.ring, styles.ringOuter, { borderColor: `rgba(${rgb(fill)}, 0.16)` }]} />
      <View style={[styles.ring, styles.ringMid,   { borderColor: `rgba(${rgb(fill)}, 0.26)` }]} />
      <View style={[styles.ring, styles.ringInner, { backgroundColor: `rgba(${rgb(fill)}, 0.14)` }]} />

      <View style={styles.pin}>
        {/* Rotated square makes the point; the head is drawn after it so it paints on top. */}
        <View style={[styles.pinPoint, { backgroundColor: fill }]} />
        <View style={[styles.pinHead, { backgroundColor: fill }]}>
          <Text style={[styles.pinLetter, { color: on }]}>C</Text>
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
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[16],
  },
  heading: {
    fontFamily: fonts.wordmark,
    fontSize: 32,
    lineHeight: 38,
    color: '#FFFFFF',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginTop: spacing[8],
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: 15,
    lineHeight: 22,
    color: navy[300],
    textAlign: 'center',
  },

  // ── Pin glyph ─────────────────────────────────────────────────────────────
  glowOuter: {
    width: 156,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: radius.pill,
  },
  ringOuter: {
    width: 156,
    height: 156,
    borderWidth: 1,
  },
  ringMid: {
    width: 118,
    height: 118,
    borderWidth: 1,
  },
  ringInner: {
    width: 88,
    height: 88,
  },
  pin: {
    width: 58,
    height: 72,
    alignItems: 'center',
  },
  pinPoint: {
    position: 'absolute',
    bottom: 6,
    width: 30,
    height: 30,
    borderBottomRightRadius: radius.xs,
    transform: [{ rotate: '45deg' }],
  },
  pinHead: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinLetter: {
    fontFamily: fonts.wordmark,
    fontSize: 30,
    letterSpacing: -1,
  },

  // ── Reassurance chips ─────────────────────────────────────────────────────
  chips: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[8],
    marginTop: spacing[4],
  },
  chip: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: navy[600],
    backgroundColor: navy[800],
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: navy[300],
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
  },
  btnGhostText: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
    color: navy[300],
  },
  footnote: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 18,
    color: navy[400],
    textAlign: 'center',
    marginTop: spacing[12],
    marginBottom: spacing[8],
  },
});
