// Deploy with: firebase deploy --only functions
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import fetch from 'node-fetch';

admin.initializeApp();
const db = admin.firestore();

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(date: Date): string {
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

type ExpoMessage = {
  to: string;
  sound: string;
  title: string;
  body: string;
  categoryId: string;
  data: {
    eventId: string;
    teamId: string;
    userId: string;
    displayName?: string;
  };
};

async function sendBatchNotifications(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });
  }
}

export const sendAvailabilityReminders = onSchedule('every 1 hours', async () => {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 47 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 49 * 60 * 60 * 1000);

  const teamsSnap = await db.collection('teams').get();

  for (const teamDoc of teamsSnap.docs) {
    const teamId = teamDoc.id;

    const eventsSnap = await db
      .collection('teams')
      .doc(teamId)
      .collection('events')
      .where('startsAt', '>=', admin.firestore.Timestamp.fromDate(windowStart))
      .where('startsAt', '<=', admin.firestore.Timestamp.fromDate(windowEnd))
      .get();

    for (const eventDoc of eventsSnap.docs) {
      const eventData = eventDoc.data();
      const eventId = eventDoc.id;

      const [membersSnap, responsesSnap] = await Promise.all([
        db.collection('teams').doc(teamId).collection('members').get(),
        db.collection('teams').doc(teamId).collection('events').doc(eventId).collection('responses').get(),
      ]);

      const respondedIds = new Set(responsesSnap.docs.map(d => d.id));
      const dateLabel = formatDate(eventData['startsAt'].toDate());

      const notifications: ExpoMessage[] = [];
      for (const memberDoc of membersSnap.docs) {
        const member = memberDoc.data();
        if (member['autoIn'] === false || member['role'] === 'spare') continue;
        if (respondedIds.has(memberDoc.id)) continue;
        if (!member['pushToken']) continue;

        notifications.push({
          to: member['pushToken'],
          sound: 'default',
          title: `Are you in for ${eventData['title']}?`,
          body: `📅 ${dateLabel} at ${eventData['venue']}. Tap to respond.`,
          categoryId: 'AVAILABILITY_REQUEST',
          data: {
            eventId,
            teamId,
            userId: memberDoc.id,
            displayName: member['displayName'],
          },
        });
      }

      await sendBatchNotifications(notifications);
    }
  }
});

export const onEventCreated = onDocumentCreated(
  'teams/{teamId}/events/{eventId}',
  async (event) => {
    const { teamId, eventId } = event.params;
    const eventData = event.data?.data();
    if (!eventData) return;

    const membersSnap = await db.collection('teams').doc(teamId).collection('members').get();
    const dateLabel = formatDate(eventData['startsAt'].toDate());

    const notifications: ExpoMessage[] = [];
    for (const memberDoc of membersSnap.docs) {
      const member = memberDoc.data();
      if (!member['pushToken']) continue;

      notifications.push({
        to: member['pushToken'],
        sound: 'default',
        title: `New event: ${eventData['title']}`,
        body: `📅 ${dateLabel} at ${eventData['venue']}. Are you in?`,
        categoryId: 'AVAILABILITY_REQUEST',
        data: {
          eventId,
          teamId,
          userId: memberDoc.id,
          displayName: member['displayName'],
        },
      });
    }

    await sendBatchNotifications(notifications);
  },
);
