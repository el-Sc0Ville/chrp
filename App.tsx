import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { setDoc, doc, serverTimestamp, getDocs, query, collection, where, limit } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './src/firebase';
import { auth } from './src/firebase/config';
import { navigationRef } from './src/navigation';
import {
  useFonts,
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Geist_300Light,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
} from '@expo-google-fonts/geist-mono';
import {
  ChakraPetch_500Medium,
  ChakraPetch_600SemiBold,
  ChakraPetch_700Bold,
} from '@expo-google-fonts/chakra-petch';

import AppNavigator from './src/navigation';
import { navy } from './src/theme';
import { confirmMagicLink, getPendingEmail } from './src/firebase/auth';
import './src/tasks/geofenceTask';

const handleNotificationResponse = async (response: Notifications.NotificationResponse) => {
  const actionIdentifier = response.actionIdentifier;
  const data = response.notification.request.content.data as {
    eventId?: string;
    teamId?: string;
    userId?: string;
    displayName?: string;
  };

  console.log('Notification response received:', actionIdentifier, data);

  if (!data.eventId || !data.teamId || !data.userId) {
    console.warn('Missing notification data, cannot write response');
    return;
  }

  if (actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    const response_value = actionIdentifier.toLowerCase();
    await setDoc(
      doc(db, 'teams', data.teamId, 'events', data.eventId, 'responses', data.userId),
      {
        response: response_value,
        respondedAt: serverTimestamp(),
        setByManager: false,
        displayName: data.displayName ?? 'Player',
        userId: data.userId,
      },
    ).catch(err => console.error('[Notification] Firestore write failed:', err));
    console.log('Notification response written:', response_value);
  }
};

async function handleJoinDeepLink(url: string): Promise<void> {
  const match = url.match(/[?&]code=([A-Z0-9]{1,6})/i);
  if (!match) return;
  const code = match[1].toUpperCase().padEnd(0).slice(0, 6);
  if (code.length !== 6) return;

  try {
    console.log('[JoinDeepLink] looking up code:', code);
    const snap = await getDocs(
      query(collection(db, 'teams'), where('inviteCode', '==', code), limit(1)),
    );
    if (snap.empty) {
      console.warn('[JoinDeepLink] invite code not found:', code);
      return;
    }
    const teamDoc  = snap.docs[0];
    const teamData = teamDoc.data();

    await AsyncStorage.setItem('chrp_pending_invite_code',  code);
    await AsyncStorage.setItem('chrp_pending_team_id',      teamDoc.id);
    await AsyncStorage.setItem('chrp_pending_team_name',    teamData['name'] as string);
    await AsyncStorage.setItem('chrp_pending_team_palette', (teamData['palette'] as string) ?? 'trashdogs');

    if (!auth.currentUser) {
      await signInAnonymously(auth);
      // onAuthStateChanged in AppStack will call setMockUser + setNeedsOnboarding(true)
    }
    console.log('[JoinDeepLink] invite saved, signed in anonymously');
  } catch (err) {
    console.error('[JoinDeepLink] error:', err);
  }
}

function extractFirebaseLink(url: string): string {
  const match = url.match(/[?&]link=([^&]+)/);
  if (match) {
    try { return decodeURIComponent(match[1]); } catch { /* fall through */ }
  }
  return url;
}

async function handleDeepLink(url: string): Promise<void> {
  // Invite join link: chrp://join?code=XXXXXX or https://chrp-app.web.app/join?code=XXXXXX
  if (url.includes('//join') || url.includes('/join?code=')) {
    await handleJoinDeepLink(url);
    return;
  }

  const isChrpScheme        = url.startsWith('chrp://');
  const isFirebaseUniversal = url.startsWith('https://chrp-app.firebaseapp.com');
  if ((!isChrpScheme && !isFirebaseUniversal) || !url.includes('finishSignIn')) return;
  const resolvedUrl = extractFirebaseLink(url);
  const email = await getPendingEmail();
  if (!email) {
    console.warn('[DeepLink] finishSignIn URL received but no pending email in storage');
    return;
  }
  try {
    await confirmMagicLink(email, resolvedUrl);
    console.log('[DeepLink] magic link sign-in complete');
  } catch (err) {
    console.error('[DeepLink] confirmMagicLink failed:', err);
  }
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#070B14', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            {this.state.error.message}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  console.log('APP STARTED');

  useEffect(() => {
    // Cold-start: app opened via deep link while not running
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink(url);
    });

    // Warm-start: app already running when deep link arrives
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    // Cold-start: process any notification response that launched the app
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) handleNotificationResponse(response);
    });

    // Warm: user taps or interacts with a notification while app is running/backgrounded
    const notifSub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      sub.remove();
      notifSub.remove();
    };
  }, []);

  const [fontsLoaded] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Geist_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
    ChakraPetch_500Medium,
    ChakraPetch_600SemiBold,
    ChakraPetch_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: navy[900], alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#6979F0" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary>
        <AppNavigator />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
