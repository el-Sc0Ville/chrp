import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation';
import { db, auth } from '../../firebase';
import { navy, fonts, teams, spacing, radius, type TeamKey } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CreateTeam'>;

const SPORTS = ['Hockey', 'Soccer', 'Basketball', 'Baseball', 'Other'] as const;

const PALETTES: { key: TeamKey; swatch: string }[] = [
  { key: 'trashdogs', swatch: teams.trashdogs[300] },
  { key: 'ember',     swatch: teams.ember[300] },
  { key: 'verdant',   swatch: teams.verdant[300] },
  { key: 'solstice',  swatch: teams.solstice[300] },
  { key: 'aurora',    swatch: teams.aurora[300] },
];

export default function CreateTeamScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { displayName, jerseyNumber } = route.params;
  const [teamName, setTeamName]   = useState('');
  const [sport, setSport]         = useState<string>('Hockey');
  const [palette, setPalette]     = useState<TeamKey>('trashdogs');
  const [loading, setLoading]     = useState(false);
  const canCreate = teamName.trim().length > 0;

  async function handleCreate() {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      // TODO Phase 2b: generate unique invite code and store on team document
      const teamRef = doc(collection(db, 'teams'));
      const teamId  = teamRef.id;
      const name    = teamName.trim();

      await setDoc(teamRef, {
        name,
        sport,
        palette,
        managerIds: [user.uid],
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'teams', teamId, 'members', user.uid), {
        userId: user.uid,
        displayName,
        jerseyNumber,
        role: 'manager',
        email: user.email ?? '',
        autoIn: true,
        joinedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'users', user.uid, 'teams', teamId), {
        teamId,
        teamName: name,
        palette,
        role: 'manager',
        joinedAt: serverTimestamp(),
      });

      navigation.navigate('OnboardingComplete', { teamId, teamName: name, palette, isManager: true });
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      console.error('[CreateTeam]', err);
    } finally {
      setLoading(false);
    }
  }

  const accent = teams[palette];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Create your{'\n'}team</Text>

        {/* Team name */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Team name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Trash Dogs"
            placeholderTextColor={navy[500]}
            value={teamName}
            onChangeText={setTeamName}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        {/* Sport */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Sport</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sportRow}
          >
            {SPORTS.map(s => {
              const active = sport === s;
              return (
                <Pressable
                  key={s}
                  style={[
                    styles.sportPill,
                    active && { backgroundColor: accent[500], borderColor: accent[500] },
                  ]}
                  onPress={() => setSport(s)}
                >
                  <Text style={[styles.sportPillText, active && styles.sportPillTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Colour */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Colour</Text>
          <View style={styles.swatchRow}>
            {PALETTES.map(p => (
              <Pressable key={p.key} onPress={() => setPalette(p.key)} style={styles.swatchWrap}>
                <View style={[
                  styles.swatchRing,
                  palette === p.key && { borderColor: p.swatch },
                ]}>
                  <View style={[styles.swatch, { backgroundColor: p.swatch }]} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing[16]) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: canCreate && !loading ? accent[500] : navy[700] },
            pressed && canCreate && !loading && styles.btnPressed,
          ]}
          onPress={handleCreate}
          disabled={!canCreate || loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={[styles.btnText, !canCreate && styles.btnTextDisabled]}>Create team</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[900],
  },
  scroll: {
    paddingHorizontal: spacing[24],
    paddingTop: spacing[48],
    paddingBottom: spacing[32],
    gap: spacing[32],
  },
  heading: {
    fontFamily: fonts.wordmark,
    fontSize: 36,
    color: '#FFFFFF',
    letterSpacing: -0.8,
    lineHeight: 42,
  },
  section: {
    gap: spacing[12],
  },
  sectionLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    color: navy[300],
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  input: {
    backgroundColor: navy[800],
    borderWidth: 1,
    borderColor: navy[600],
    borderRadius: radius.m,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    color: '#FFFFFF',
    fontFamily: fonts.ui,
    fontSize: 17,
  },
  sportRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  sportPill: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: navy[600],
    backgroundColor: navy[800],
  },
  sportPillText: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: navy[300],
  },
  sportPillTextActive: {
    color: navy[900],
  },
  swatchRow: {
    flexDirection: 'row',
    gap: spacing[16],
    alignItems: 'center',
  },
  swatchWrap: {
    padding: 4,
  },
  swatchRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  footer: {
    paddingHorizontal: spacing[24],
  },
  btn: {
    borderRadius: radius.m,
    paddingVertical: spacing[16],
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    marginBottom: spacing[8],
  },
  btnPressed: {
    opacity: 0.82,
  },
  btnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  btnTextDisabled: {
    color: navy[500],
  },
});
