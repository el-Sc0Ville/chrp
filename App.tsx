import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './src/firebase';
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

function extractFirebaseLink(url: string): string {
  const match = url.match(/[?&]link=([^&]+)/);
  if (match) {
    try { return decodeURIComponent(match[1]); } catch { /* fall through */ }
  }
  return url;
}

async function handleDeepLink(url: string): Promise<void> {
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
      <AppNavigator />
    </SafeAreaProvider>
  );
}
