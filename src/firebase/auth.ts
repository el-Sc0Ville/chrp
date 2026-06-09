import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from './config';

const PENDING_EMAIL_KEY = 'chrp_pending_email';

const ACTION_CODE_SETTINGS = {
  url: 'https://chrp-app.web.app/finishSignIn',
  handleCodeInApp: true,
  iOS: {
    bundleId: 'com.chrp.app',
  },
  android: {
    packageName: 'com.chrp.app',
    installIfNotAvailable: true,
  },
};

export async function sendMagicLink(email: string): Promise<void> {
  try {
    console.log('Sending magic link to:', email);
    await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS);
    await AsyncStorage.setItem(PENDING_EMAIL_KEY, email);
    console.log('Magic link sent successfully');
  } catch (e) {
    console.error('sendMagicLink error:', e);
    throw e;
  }
}

export async function confirmMagicLink(email: string, emailLink: string): Promise<void> {
  if (!isSignInWithEmailLink(auth, emailLink)) {
    throw new Error('Invalid sign-in link');
  }

  const result = await signInWithEmailLink(auth, email, emailLink);
  const uid = result.user.uid;
  console.log('[confirmMagicLink] signed in, uid:', uid);

  await AsyncStorage.removeItem(PENDING_EMAIL_KEY);

  // Check for existing profile — if it exists this is a returning user, skip creating a new one.
  // navigation/index.tsx onAuthStateChanged checks users/{uid}/teams to decide whether to show onboarding.
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    console.log('[confirmMagicLink] new user — creating profile at /users/', uid);
    await setDoc(userRef, { email, displayName: '', createdAt: serverTimestamp() });
  } else {
    console.log('[confirmMagicLink] returning user — profile exists at /users/', uid);
  }
}

export async function getPendingEmail(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_EMAIL_KEY);
}

export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export type { User };
