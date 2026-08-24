// Haptics — thin wrapper over expo-haptics.
// Haptics are never load-bearing: an unsupported device, a disabled system
// setting, or a rejected native promise must never surface as an error, so
// every call is fire-and-forget with the rejection swallowed.

import * as Haptics from 'expo-haptics';

function fire(run: () => Promise<void>): void {
  try {
    run().catch(() => {});
  } catch {
    // Synchronous throw (module missing in Expo Go / web) — ignore.
  }
}

// ─── Impact — physical "something moved" feedback ─────────────────────────────

export const tapLight  = (): void => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const tapMedium = (): void => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

// ─── Notification — outcome feedback, pairs with a toast or an Alert ──────────

export const success = (): void => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const warning = (): void => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
export const error   = (): void => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

// ─── Selection — a value changed within a set (segmented controls) ────────────

export const selection = (): void => fire(() => Haptics.selectionAsync());

const haptics = { tapLight, tapMedium, success, warning, error, selection };
export default haptics;
