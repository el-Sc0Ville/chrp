import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const isFirstInit = getApps().length === 0;
const app = isFirstInit ? initializeApp(firebaseConfig) : getApp();

export const db   = getFirestore(app);
export const auth = isFirstInit
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);
