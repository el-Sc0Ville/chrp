// Deploy with: firebase deploy --only functions
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import fetch from 'node-fetch';

admin.initializeApp();
const db = admin.firestore();

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(date: Date): string {
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function formatTime(date: Date): string {
  const h = date.getHours() % 12 || 12;
  const m = date.getMinutes();
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
  return m === 0 ? `${h} ${ampm}` : `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const PALETTE_HEX: Record<string, string> = {
  trashdogs: '#2540D6',
  ember:     '#D6253F',
  verdant:   '#0E9A5E',
  solstice:  '#F59E0B',
  aurora:    '#7C3FE5',
};

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
    teamName?: string;
    teamColor?: string;
    eventDate?: string;
    location?: string;
    requestId?: string;
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

const REMINDER_WINDOWS = [
  {
    hoursOut: 48,
    startHours: 47,
    endHours: 49,
    buildNotification: (title: string, dateLabel: string, _timeLabel: string, venue: string) => ({
      title: `Are you in for ${title}?`,
      body: `📅 ${dateLabel} at ${venue}. Tap to respond.`,
    }),
  },
  {
    hoursOut: 24,
    startHours: 23,
    endHours: 25,
    buildNotification: (title: string, _dateLabel: string, timeLabel: string, venue: string) => ({
      title: `Last chance — are you in for ${title}?`,
      body: `⏰ Tomorrow at ${timeLabel} at ${venue}. We need to know!`,
    }),
  },
];

export const sendAvailabilityReminders = onSchedule({ schedule: 'every 60 minutes', region: 'northamerica-northeast1' }, async () => {
  const now = new Date();
  const teamsSnap = await db.collection('teams').get();

  for (const teamDoc of teamsSnap.docs) {
    const teamId = teamDoc.id;
    const teamData = teamDoc.data();
    const teamName: string = teamData['name'] ?? 'Your Team';
    const teamColor: string = PALETTE_HEX[teamData['palette']] ?? '#2540D6';

    for (const window of REMINDER_WINDOWS) {
      const windowStart = new Date(now.getTime() + window.startHours * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + window.endHours * 60 * 60 * 1000);

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
        const eventDate = eventData['startsAt'].toDate();

        const [membersSnap, responsesSnap] = await Promise.all([
          db.collection('teams').doc(teamId).collection('members').get(),
          db.collection('teams').doc(teamId).collection('events').doc(eventId).collection('responses').get(),
        ]);

        const respondedIds = new Set(responsesSnap.docs.map(d => d.id));
        const dateLabel = formatDate(eventDate);
        const timeLabel = formatTime(eventDate);
        const eventDateStr = `${dateLabel} · ${timeLabel}`;
        const { title, body } = window.buildNotification(eventData['title'], dateLabel, timeLabel, eventData['venue']);

        const notifications: ExpoMessage[] = [];
        for (const memberDoc of membersSnap.docs) {
          const member = memberDoc.data();
          if (member['autoIn'] === false || member['role'] === 'spare') continue;
          if (respondedIds.has(memberDoc.id)) continue;
          if (!member['pushToken']) continue;
          if (member['remindersEnabled'] === false) continue;

          notifications.push({
            to: member['pushToken'],
            sound: 'default',
            title,
            body,
            categoryId: 'AVAILABILITY_REQUEST',
            data: {
              eventId,
              teamId,
              userId: memberDoc.id,
              displayName: member['displayName'],
              teamName,
              teamColor,
              eventDate: eventDateStr,
              location: eventData['venue'],
            },
          });
        }

        await sendBatchNotifications(notifications);
      }
    }
  }
});

export const onEventCreated = onDocumentCreated(
  { document: 'teams/{teamId}/events/{eventId}', region: 'northamerica-northeast1' },
  async (event) => {
    const { teamId, eventId } = event.params;
    const eventData = event.data?.data();
    if (!eventData) return;

    const [teamDoc, membersSnap] = await Promise.all([
      db.collection('teams').doc(teamId).get(),
      db.collection('teams').doc(teamId).collection('members').get(),
    ]);

    const teamData = teamDoc.data() ?? {};
    const teamName: string = teamData['name'] ?? 'Your Team';
    const teamColor: string = PALETTE_HEX[teamData['palette']] ?? '#2540D6';

    const eventDate = eventData['startsAt'].toDate();
    const dateLabel = formatDate(eventDate);
    const timeLabel = formatTime(eventDate);
    const eventDateStr = `${dateLabel} · ${timeLabel}`;

    const notifications: ExpoMessage[] = [];
    for (const memberDoc of membersSnap.docs) {
      const member = memberDoc.data();
      if (!member['pushToken']) continue;
      if (member['notificationsEnabled'] === false) continue;

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
          teamName,
          teamColor,
          eventDate: eventDateStr,
          location: eventData['venue'],
        },
      });
    }

    await sendBatchNotifications(notifications);
  },
);

export const recordAvailability = onRequest(
  { region: 'northamerica-northeast1', cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { eventId, teamId, userId, response, displayName } = req.body;

    if (!eventId || !teamId || !userId || !response) {
      res.status(400).send('Missing required fields');
      return;
    }

    const validResponses = ['in', 'out', 'maybe'];
    if (!validResponses.includes(response)) {
      res.status(400).send('Invalid response value');
      return;
    }

    await db
      .collection('teams')
      .doc(teamId)
      .collection('events')
      .doc(eventId)
      .collection('responses')
      .doc(userId)
      .set({
        userId,
        displayName: displayName ?? '',
        response,
        respondedAt: admin.firestore.FieldValue.serverTimestamp(),
        setByManager: false,
      });

    res.status(200).json({ success: true });
  }
);

export const onSubRequestCreated = onDocumentCreated(
  { document: 'teams/{teamId}/subRequests/{requestId}', region: 'northamerica-northeast1' },
  async (event) => {
    const { teamId, requestId } = event.params;
    const requestData = event.data?.data();
    if (!requestData) return;

    const membersSnap = await db
      .collection('teams').doc(teamId).collection('members')
      .where('role', '==', 'manager')
      .get();

    const notifications: ExpoMessage[] = [];
    for (const memberDoc of membersSnap.docs) {
      const member = memberDoc.data();
      if (!member['pushToken']) continue;
      if (member['notificationsEnabled'] === false) continue;

      notifications.push({
        to: member['pushToken'],
        sound: 'default',
        title: `Sub needed — ${requestData['opponent']}`,
        body: `${requestData['gameWeekday']} ${requestData['gameDay']} ${requestData['gameMonth']} · ${requestData['gameVenue']}`,
        categoryId: 'SUB_REQUEST',
        data: {
          eventId: requestData['eventId'] ?? '',
          teamId,
          userId: memberDoc.id,
          displayName: member['displayName'],
          requestId,
        },
      });
    }

    await sendBatchNotifications(notifications);
  },
);