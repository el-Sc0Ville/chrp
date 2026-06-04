import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { updateProfile, updateEmail } from 'firebase/auth';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation';
import { auth, db } from '../../firebase';
import { useUserContext } from '../../context/UserContext';
import { navy, fonts, teams, spacing, radius, type TeamKey } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ProfileSetup'>;

export default function ProfileSetupScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { setMockUser, activeTeamId, activeTeamPalette, needsOnboarding } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const [displayName, setDisplayName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [email, setEmail] = useState('');
  const canContinue = displayName.trim().length > 0;

  async function handleContinue() {
    if (!canContinue) return;
    const name = displayName.trim();
    if (auth.currentUser) {
      try {
        await updateProfile(auth.currentUser, { displayName: name });
        setMockUser({ ...auth.currentUser, displayName: name } as typeof auth.currentUser, false);
        // For existing users editing their profile (not during initial onboarding),
        // also sync the displayName to their Firestore member document.
        if (!needsOnboarding) {
          await updateDoc(
            doc(db, 'teams', activeTeamId, 'members', auth.currentUser.uid),
            { displayName: name },
          ).catch(() => {});
        }
      } catch (err) {
        console.error('[ProfileSetup] updateProfile failed:', err);
      }

      const trimmedEmail = email.trim();
      if (trimmedEmail) {
        // TODO Phase 2b: use email to send magic link for account recovery
        await setDoc(
          doc(db, 'users', auth.currentUser.uid),
          { email: trimmedEmail },
          { merge: true },
        ).catch(() => {});
        await updateEmail(auth.currentUser, trimmedEmail).catch(() => {});
      }
    }
    const params = route.params;
    if (params?.teamId) {
      navigation.navigate('JoinTeam', {
        displayName:  name,
        jerseyNumber: parseInt(jerseyNumber, 10) || 0,
        teamId:       params.teamId,
        teamName:     params.teamName ?? '',
        teamPalette:  (params.teamPalette ?? 'trashdogs') as TeamKey,
      });
    } else {
      navigation.navigate('JoinOrCreate', {
        displayName:  name,
        jerseyNumber: parseInt(jerseyNumber, 10) || 0,
      });
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing[16]) }]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>What should we{'\n'}call you?</Text>

          <View style={styles.fields}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Display name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Alex Beaumont"
                placeholderTextColor={navy[500]}
                value={displayName}
                onChangeText={setDisplayName}
                autoFocus
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Jersey number{' '}
                <Text style={styles.fieldLabelOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 17"
                placeholderTextColor={navy[500]}
                value={jerseyNumber}
                onChangeText={t => setJerseyNumber(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                returnKeyType="next"
                maxLength={2}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Email{' '}
                <Text style={styles.fieldLabelOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. alex@example.com"
                placeholderTextColor={navy[500]}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
              <Text style={styles.fieldCaption}>
                Add your email to recover your account if you ever lose access
              </Text>
            </View>
          </View>
        </ScrollView>

        <Pressable
          style={({ pressed }) => [
            styles.btn,
            canContinue && { backgroundColor: TEAM[500] },
            !canContinue && styles.btnDisabled,
            pressed && canContinue && styles.btnPressed,
          ]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={[styles.btnText, !canContinue && styles.btnTextDisabled]}>
            Continue
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: navy[900] },
  container: {
    flex: 1,
    paddingHorizontal: spacing[24],
  },
  scroll: {
    paddingTop: spacing[48],
    paddingBottom: spacing[24],
  },
  heading: {
    fontFamily: fonts.wordmark,
    fontSize: 36,
    color: '#FFFFFF',
    letterSpacing: -0.8,
    lineHeight: 42,
    marginBottom: spacing[40],
  },
  fields: {
    gap: spacing[24],
  },
  fieldGroup: {
    gap: spacing[8],
  },
  fieldLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    color: navy[300],
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  fieldLabelOptional: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: navy[500],
    textTransform: 'none',
    letterSpacing: 0,
  },
  fieldCaption: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 17,
    color: navy[500],
    marginTop: spacing[4],
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
  btn: {
    borderRadius: radius.m,
    paddingVertical: spacing[16],
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  btnDisabled: {
    backgroundColor: navy[700],
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
