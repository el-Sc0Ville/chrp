import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  linkWithCredential,
  EmailAuthProvider,
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

  let uid: string;

  if (auth.currentUser?.isAnonymous) {
    // Link email credential to the anonymous account — preserves UID and all Firestore data
    const emailCredential = EmailAuthProvider.credentialWithLink(email, emailLink);
    try {
      const result = await linkWithCredential(auth.currentUser, emailCredential);
      uid = result.user.uid;
      console.log('[confirmMagicLink] linked email to anonymous account, uid:', uid);
    } catch (err: any) {
      if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') {
        // Email already used by another account; sign in normally
        console.log('[confirmMagicLink] email already in use, signing in normally');
        const result = await signInWithEmailLink(auth, email, emailLink);
        uid = result.user.uid;
      } else {
        throw err;
      }
    }
  } else {
    const result = await signInWithEmailLink(auth, email, emailLink);
    uid = result.user.uid;
    console.log('[confirmMagicLink] signed in with email link, uid:', uid);
  }

  await AsyncStorage.removeItem(PENDING_EMAIL_KEY);

  // Create user profile on first sign-in
  console.log('[confirmMagicLink] checking /users/', uid);
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    console.log('[confirmMagicLink] creating user profile at /users/', uid);
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
