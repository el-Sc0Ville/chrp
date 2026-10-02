import { Platform } from 'react-native';
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

/**
 * How to answer an availability notification on the recipient's phone. iOS
 * replies through the content extension (swipe down or long-press); Android
 * shows the In / Maybe / Out buttons on the notification itself. Keep in step
 * with replyHint() in functions/src/index.ts.
 */
export function replyHint(platform?: string): string {
  return platform === 'android' ? 'Tap In, Maybe or Out below' : 'Swipe ↓ or hold to reply';
}

/**
 * iOS: registers the AVAILABILITY_REQUEST category with NO action buttons.
 *
 * This is deliberate. The In/Out/Maybe controls are rendered by the iOS
 * Notification Content Extension (ios/ChrpNotificationContent), which is bound
 * to this category via UNNotificationExtensionCategory in its Info.plist. That
 * extension draws the branded buttons and POSTs the choice straight to the
 * recordAvailability Cloud Function, so the response lands in Firestore without
 * the app ever launching.
 *
 * Registering system action buttons here as well would render a SECOND set of
 * In/Out/Maybe controls underneath the extension's own — that is exactly the
 * duplicate-UI bug. Keep this array empty; add buttons to the extension, not here.
 *
 * Android has no content extension, so there the system buttons ARE the
 * controls. They open the app: a killed app on Android does not run JS in time
 * to finish a background write, which would silently lose the answer.
 * App.tsx handleNotificationResponse records the choice (identifier lowercased).
 */
export async function registerNotificationCategories(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationCategoryAsync('AVAILABILITY_REQUEST', [
      { identifier: 'IN',    buttonTitle: "✓ I'm in", options: { opensAppToForeground: true } },
      { identifier: 'MAYBE', buttonTitle: 'Maybe',    options: { opensAppToForeground: true } },
      { identifier: 'OUT',   buttonTitle: "✗ Out",    options: { opensAppToForeground: true } },
    ]);
  } else {
    await Notifications.setNotificationCategoryAsync('AVAILABILITY_REQUEST', []);
  }

  // Separate category, and this one DOES carry buttons. No content extension is
  // bound to SUB_OFFER, so these system action buttons are the only controls —
  // there is nothing for them to duplicate. Keeping it apart from SUB_REQUEST
  // matters: that category goes to managers, who should not be offered
  // "I'm available" on a request they are only being told about.
  await Notifications.setNotificationCategoryAsync('SUB_OFFER', [
    {
      identifier: 'SUB_AVAILABLE',
      buttonTitle: "✓ I'm available",
      // Opens the app: a killed app often never runs JS in time to complete
      // the write in the background, silently losing the answer.
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'SUB_UNAVAILABLE',
      buttonTitle: "Can't make it",
      options: { opensAppToForeground: true },
    },
  ]);
}

export async function registerForPushNotifications(
  userId: string,
  teamId: string,
): Promise<string | null> {
  try {
    // expo-notifications v56: PermissionResponse re-export from 'expo' is broken in
    // TypeScript, so we cast to access .granted at runtime.
    // Never prompts. Asking is the notification primer's job, where the user
    // sees why first; prompting here fired the system dialog seconds after
    // someone tapped "Maybe later", or cold on the next launch.
    const existing = (await Notifications.getPermissionsAsync()) as unknown as { granted: boolean };
    if (!existing.granted) return null;

    await registerNotificationCategories();

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: '16e2f5c6-2e3a-4dad-9b51-8b485329db64',
    });

    console.log('Push token:', token.data);

    // Save token to Firestore member document
    await updateDoc(doc(db, 'teams', teamId, 'members', userId), {
      pushToken: token.data,
      pushPlatform: Platform.OS === 'android' ? 'android' : 'ios',
    });

    return token.data;
  } catch (e) {
    console.error('Push registration error:', e);
    return null;
  }
}
