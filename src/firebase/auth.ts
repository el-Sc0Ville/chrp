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
  url: 'https://chrp-app.firebaseapp.com/finishSignIn',
  handleCodeInApp: true,
  iOS: { bundleId: 'com.chrp.app' },
  android: { packageName: 'com.chrp.app', installIfNotAvailable: true },
};

export async function sendMagicLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS);
  await AsyncStorage.setItem(PENDING_EMAIL_KEY, email);
}

export async function confirmMagicLink(email: string, emailLink: string): Promise<void> {
  if (!isSignInWithEmailLink(auth, emailLink)) {
    throw new Error('Invalid sign-in link');
  }
  const credential = await signInWithEmailLink(auth, email, emailLink);
  await AsyncStorage.removeItem(PENDING_EMAIL_KEY);

  // Create user profile on first sign-in
  const uid = credential.user.uid;
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      email,
      displayName: '',
      createdAt: serverTimestamp(),
    });
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
