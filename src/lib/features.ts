import { Platform } from 'react-native';

// Location-based automatic check-in is iPhone-only for now. On Android it needs
// Google Play's background-location declaration and review, so the first
// Android release leaves location out entirely (no permission, no prompts, no
// switches); the manual "I'm here" check-in works everywhere. When this
// becomes true on Android, also restore the location permissions in app.json
// (blockedPermissions / isAndroidBackgroundLocationEnabled) and the Play
// Console Data safety and location declarations.
export const LOCATION_CHECK_IN_ENABLED = Platform.OS !== 'android';
