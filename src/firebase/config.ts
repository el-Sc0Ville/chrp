import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// TODO: FCM push notifications require Expo Notifications + a custom dev build — not available in Expo Go

// TODO: move to environment variables before production build
const firebaseConfig = {
  apiKey:            'AIzaSyBX7oUK7Bit71LntoyKwpLyXnR9HsLfLDU',
  authDomain:        'chrp-app.firebaseapp.com',
  projectId:         'chrp-app',
  storageBucket:     'chrp-app.firebasestorage.app',
  messagingSenderId: '865858877596',
  appId:             '1:865858877596:web:3edda39c32d0661f925559',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

console.log('Firestore config:', app.options);

export const db   = getFirestore(app);
export const auth = getAuth(app);
