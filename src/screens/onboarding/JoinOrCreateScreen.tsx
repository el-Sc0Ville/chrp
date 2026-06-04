import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDocs, query, collection, where, limit } from 'firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation';
import { db } from '../../firebase';
import { navy, fonts, teams, spacing, radius, type TeamKey } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'JoinOrCreate'>;

export default function JoinOrCreateScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { displayName, jerseyNumber } = route.params;

  const [codeVisible,  setCodeVisible]  = useState(false);
  const [invCode,      setInvCode]      = useState('');
  const [codeLoading,  setCodeLoading]  = useState(false);
  const [codeError,    setCodeError]    = useState<string | null>(null);

  const handleJoinWithCode = async () => {
    const upper = invCode.trim().toUpperCase();
    if (upper.length < 6 || codeLoading) return;
    setCodeLoading(true);
    setCodeError(null);
    try {
      const snap = await getDocs(
        query(collection(db, 'teams'), where('inviteCode', '==', upper), limit(1)),
      );
      if (snap.empty) {
        setCodeError("That invite code doesn't look right. Check with your team manager.");
        return;
      }
      const teamDoc = snap.docs[0];
      const data    = teamDoc.data();
      navigation.navigate('JoinTeam', {
        displayName,
        jerseyNumber,
        teamId:      teamDoc.id,
        teamName:    data['name'] as string,
        teamPalette: (data['palette'] ?? 'trashdogs') as TeamKey,
      });
    } catch (err) {
      console.error('[JoinOrCreate] invite lookup failed:', err);
      setCodeError('Something went wrong. Please try again.');
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing[16]) }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Join or start{'\n'}a team?</Text>
        <Text style={styles.sub}>You can always join more teams later.</Text>
      </View>

      <View style={styles.cards}>
        <View>
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => { setCodeVisible(v => !v); setCodeError(null); setInvCode(''); }}
          >
            <Text style={styles.cardIcon}>🎟️</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Join a team</Text>
              <Text style={styles.cardSub}>I have an invite code</Text>
            </View>
            <Text style={styles.chevron}>{codeVisible ? '˄' : '›'}</Text>
          </Pressable>

          {codeVisible && (
            <View style={styles.codePanel}>
              <TextInput
                style={styles.codeInput}
                value={invCode}
                onChangeText={t => { setInvCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '')); setCodeError(null); }}
                placeholder="XXXXXX"
                placeholderTextColor={navy[500]}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleJoinWithCode}
              />
              {codeError !== null && (
                <Text style={styles.codeError}>{codeError}</Text>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.codeBtn,
                  (invCode.length === 6 && !codeLoading) && styles.codeBtnActive,
                  pressed && invCode.length === 6 && !codeLoading && { opacity: 0.82 },
                ]}
                onPress={handleJoinWithCode}
                disabled={invCode.length < 6 || codeLoading}
              >
                {codeLoading
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.codeBtnText}>Join team</Text>
                }
              </Pressable>
            </View>
          )}
        </View>

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

  // ── Inline code entry ─────────────────────────────────────────────────────
  codePanel: {
    backgroundColor: navy[800],
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: navy[600],
    borderBottomLeftRadius: radius.l,
    borderBottomRightRadius: radius.l,
    padding: spacing[16],
    gap: spacing[12],
  },
  codeInput: {
    backgroundColor: navy[700],
    borderWidth: 1,
    borderColor: navy[600],
    borderRadius: radius.m,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    color: '#FFFFFF',
    fontFamily: fonts.mono,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
  codeError: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  codeBtn: {
    borderRadius: radius.m,
    paddingVertical: spacing[14],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: navy[700],
  },
  codeBtnActive: {
    backgroundColor: teams.trashdogs[500],
  },
  codeBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
