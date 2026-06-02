import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './config';

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(
  userId: string,
  teamId: string,
): Promise<string | null> {
  try {
    // expo-notifications v56: PermissionResponse re-export from 'expo' is broken in
    // TypeScript, so we cast to access .granted at runtime.
    const existing = (await Notifications.getPermissionsAsync()) as unknown as { granted: boolean };
    if (!existing.granted) {
      const requested = (await Notifications.requestPermissionsAsync()) as unknown as { granted: boolean };
      if (!requested.granted) {
        console.log('Push notification permission denied');
        return null;
      }
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: '16e2f5c6-2e3a-4dad-9b51-8b485329db64',
    });

    console.log('Push token:', token.data);

    // Save token to Firestore member document
    await updateDoc(doc(db, 'teams', teamId, 'members', userId), {
      pushToken: token.data,
    });

    return token.data;
  } catch (e) {
    console.error('Push registration error:', e);
    return null;
  }
}
