// Keeps the iOS Home Screen widget (ios/ChrpWidget) pointed at the signed-in
// player and their active team. The widget fetches its own data from the
// widgetApi Cloud Function, so this only has to hand it who to fetch for and
// the per-device key that function checks.
import { requireOptionalNativeModule } from 'expo';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase/config';

type ChrpWidgetNative = {
  getDeviceKey(): string;
  setConfig(json: string): void;
  clear(): void;
  reload(): void;
};

// Optional so dev builds made before the module existed keep working.
const Native = requireOptionalNativeModule<ChrpWidgetNative>('ChrpWidget');

const WIDGET_API_URL = 'https://northamerica-northeast1-chrp-app.cloudfunctions.net/widgetApi';

// The key only needs registering once per user per launch.
let registeredFor: string | null = null;

export async function syncWidget(uid: string, teamId: string): Promise<void> {
  if (!Native) return;
  const key = Native.getDeviceKey();
  if (registeredFor !== uid) {
    // Register before handing the widget its config, so its first fetch is
    // not rejected. arrayUnion keeps a second device's widget working too.
    await setDoc(doc(db, 'users', uid), { widgetKeys: arrayUnion(key) }, { merge: true });
    registeredFor = uid;
  }
  Native.setConfig(JSON.stringify({ uid, key, teamId, apiUrl: WIDGET_API_URL }));
}

export function clearWidget(): void {
  registeredFor = null;
  Native?.clear();
}

export function reloadWidget(): void {
  Native?.reload();
}
