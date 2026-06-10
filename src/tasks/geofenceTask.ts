import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendPushNotification } from '../firebase/sendNotification';

export const GEOFENCE_TASK = 'CHRP_GEOFENCE_TASK';

interface GeofencingTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

TaskManager.defineTask<GeofencingTaskData>(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[GeofenceTask] error:', error.message);
    return;
  }
  if (!data || data.eventType !== Location.GeofencingEventType.Enter) return;

  const [teamId, eventId, userId, displayName] = await Promise.all([
    AsyncStorage.getItem('geofence_teamId'),
    AsyncStorage.getItem('geofence_eventId'),
    AsyncStorage.getItem('geofence_userId'),
    AsyncStorage.getItem('geofence_displayName'),
  ]);

  if (!teamId || !eventId || !userId) {
    console.error('[GeofenceTask] missing context — teamId/eventId/userId not set');
    return;
  }

  await setDoc(
    doc(db, 'teams', teamId, 'events', eventId, 'responses', userId),
    { status: 'here', checkedInAt: serverTimestamp() },
    { merge: true },
  ).catch(err => console.error('[GeofenceTask] check-in setDoc failed:', err));

  try {
    const teamDoc = await getDoc(doc(db, 'teams', teamId));
    if (!teamDoc.exists()) return;
    const managerIds = (teamDoc.data().managerIds ?? []) as string[];
    for (const managerId of managerIds) {
      const memberDoc = await getDoc(doc(db, 'teams', teamId, 'members', managerId));
      if (!memberDoc.exists()) continue;
      const pushToken = memberDoc.data().pushToken as string | undefined;
      if (!pushToken) continue;
      await sendPushNotification(
        pushToken,
        'Player arrived',
        `${displayName ?? 'A player'} has arrived at the venue`,
        { eventId, teamId, userId },
      );
    }
  } catch (err) {
    console.error('[GeofenceTask] manager notify failed:', err);
  }
});
