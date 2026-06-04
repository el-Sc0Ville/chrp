import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, setDoc, serverTimestamp, getDocs, query, collection, where, limit } from 'firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation';
import { db, auth } from '../../firebase';
import { useUserContext } from '../../context/UserContext';
import { navy, fonts, teams, spacing, radius, type TeamKey } from '../../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'JoinTeam'>;

export default function JoinTeamScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { activeTeamPalette } = useUserContext();
  const TEAM = teams[activeTeamPalette];
  const { displayName, jerseyNumber } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const canJoin = code.trim().length === 6;

  async function handleJoin() {
    const upper = code.trim().toUpperCase();
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      console.log('Looking up invite code:', code);
      const snap = await getDocs(
        query(collection(db, 'teams'), where('inviteCode', '==', upper), limit(1)),
      );
      console.log('Query result:', snap.docs.length);
      if (snap.empty) {
        Alert.alert('Invalid code', "That invite code doesn't look right. Check with your team manager.");
        setLoading(false);
        return;
      }
      const teamDoc = snap.docs[0];
      const teamId   = teamDoc.id;
      const teamData = teamDoc.data();
      const teamName = teamData['name'] as string;
      const palette  = teamData['palette'] as TeamKey;

      await setDoc(doc(db, 'teams', teamId, 'members', user.uid), {
        userId: user.uid,
        displayName,
        jerseyNumber,
        role: 'player',
        email: user.email ?? '',
        autoIn: true,
        joinedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'users', user.uid, 'teams', teamId), {
        teamId,
        teamName,
        palette,
        role: 'player',
        joinedAt: serverTimestamp(),
      });

      navigation.navigate('OnboardingComplete', { teamId, teamName, palette, isManager: false });
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      console.error('[JoinTeam]', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing[16]) }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Enter invite{'\n'}code</Text>
        <Text style={styles.sub}>Ask your team manager for the 6-character code.</Text>
      </View>

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.codeInput}
          placeholder="XXXXXX"
          placeholderTextColor={navy[600]}
          value={code}
          onChangeText={t => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={6}
          returnKeyType="done"
          onSubmitEditing={handleJoin}
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          canJoin && !loading && { backgroundColor: TEAM[500] },
          (!canJoin || loading) && styles.btnDisabled,
          pressed && canJoin && !loading && styles.btnPressed,
        ]}
        onPress={handleJoin}
        disabled={!canJoin || loading}
      >
        {loading
          ? <ActivityIndicator color="#FFF" />
          : <Text style={[styles.btnText, (!canJoin || loading) && styles.btnTextDisabled]}>Join team</Text>
        }
      </Pressable>
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
  inputWrap: {
    flex: 1,
  },
  codeInput: {
    backgroundColor: navy[800],
    borderWidth: 1.5,
    borderColor: navy[600],
    borderRadius: radius.m,
    paddingHorizontal: spacing[24],
    paddingVertical: spacing[20],
    color: '#FFFFFF',
    fontFamily: fonts.mono,
    fontSize: 34,
    letterSpacing: 10,
    textAlign: 'center',
  },
  btn: {
    borderRadius: radius.m,
    paddingVertical: spacing[16],
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
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
