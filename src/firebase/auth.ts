// TODO Phase 2b: configure authorized domain in Firebase console once app domain is confirmed

import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './config';

const ACTION_CODE_SETTINGS = {
  url: 'https://chrp.app/finishSignIn',
  handleCodeInApp: true,
};

export async function sendMagicLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS);
}

export async function confirmMagicLink(email: string, emailLink: string): Promise<void> {
  if (!isSignInWithEmailLink(auth, emailLink)) {
    throw new Error('Invalid sign-in link');
  }
  await signInWithEmailLink(auth, email, emailLink);
}

export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export type { User };
