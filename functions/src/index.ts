// Deploy with: firebase deploy --only functions
import * as admin from 'firebase-admin';
// Imported directly rather than reached through the legacy `admin.firestore.*`
// namespace: the Functions emulator patches firebase-admin in a way that leaves
// admin.firestore.FieldValue undefined, so every write here threw locally even
// though it works when deployed. Using the modular entry point makes the
// emulator usable and drops the dependency on the legacy namespace.
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import fetch from 'node-fetch';

admin.initializeApp();
const db = admin.firestore();

// Cloud Functions run in UTC, so getDay()/getHours() rendered a 7 PM Eastern
// game as "11 PM" in every notification — including the "Tomorrow at X"
// reminders, which is exactly the kind of thing that makes people miss games.
// Format in the team's own zone instead.
const DEFAULT_TIME_ZONE = 'America/Toronto';

function formatDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone,
  }).format(date);
}

function formatTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone,
  }).formatToParts(date);
  const pick = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const minute = pick('minute') || '00';
  // Keep the existing shape: "7 PM" on the hour, "7:30 PM" otherwise.
  return minute === '00'
    ? `${pick('hour')} ${pick('dayPeriod')}`
    : `${pick('hour')}:${minute} ${pick('dayPeriod')}`;
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
  categoryId?: string;
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
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        console.error('[sendBatchNotifications] Expo API error:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('[sendBatchNotifications] fetch failed:', err);
    }
  }
}

const REMINDER_WINDOWS = [
  {
    hoursOut: 48,
    startHours: 47,
    endHours: 49,
    buildNotification: (title: string, dateLabel: string, _timeLabel: string, venue: string) => ({
      title: `Are you in for ${title}?`,
      body: `📅 ${dateLabel} at ${venue} — Swipe ↓ or hold to reply`,
    }),
  },
  {
    hoursOut: 24,
    startHours: 23,
    endHours: 25,
    buildNotification: (title: string, _dateLabel: string, timeLabel: string, venue: string) => ({
      title: `Last chance — are you in for ${title}?`,
      body: `⏰ Tomorrow at ${timeLabel} at ${venue} — Swipe ↓ or hold to reply`,
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
    const teamTimeZone: string = teamData['timeZone'] ?? DEFAULT_TIME_ZONE;

    for (const window of REMINDER_WINDOWS) {
      const windowStart = new Date(now.getTime() + window.startHours * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + window.endHours * 60 * 60 * 1000);

      const eventsSnap = await db
        .collection('teams')
        .doc(teamId)
        .collection('events')
        .where('startsAt', '>=', Timestamp.fromDate(windowStart))
        .where('startsAt', '<=', Timestamp.fromDate(windowEnd))
        .get();

      for (const eventDoc of eventsSnap.docs) {
        const eventData = eventDoc.data();
        if (eventData['status'] === 'cancelled') continue;
        const eventId = eventDoc.id;
        const eventDate = eventData['startsAt'].toDate();

        const [membersSnap, responsesSnap] = await Promise.all([
          db.collection('teams').doc(teamId).collection('members').get(),
          db.collection('teams').doc(teamId).collection('events').doc(eventId).collection('responses').get(),
        ]);

        const respondedIds = new Set(responsesSnap.docs.map(d => d.id));
        const dateLabel = formatDate(eventDate, teamTimeZone);
        const timeLabel = formatTime(eventDate, teamTimeZone);
        const eventDateStr = `${dateLabel} · ${timeLabel}`;
        const { title, body } = window.buildNotification(eventData['title'], dateLabel, timeLabel, eventData['venue']);

        const notifications: ExpoMessage[] = [];
        for (const memberDoc of membersSnap.docs) {
          const member = memberDoc.data();
          if (member['role'] === 'spare') continue;
          if (respondedIds.has(memberDoc.id)) continue;
          if (!member['pushToken']) continue;
          if (member['notificationsEnabled'] === false) continue;

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
    const teamTimeZone: string = teamData['timeZone'] ?? DEFAULT_TIME_ZONE;

    const eventDate = eventData['startsAt'].toDate();
    const dateLabel = formatDate(eventDate, teamTimeZone);
    const timeLabel = formatTime(eventDate, teamTimeZone);
    const eventDateStr = `${dateLabel} · ${timeLabel}`;

    const notifications: ExpoMessage[] = [];
    for (const memberDoc of membersSnap.docs) {
      const member = memberDoc.data();
      if (member['role'] === 'spare') continue;
      if (!member['pushToken']) continue;
      if (member['notificationsEnabled'] === false) continue;

      notifications.push({
        to: member['pushToken'],
        sound: 'default',
        title: `New event: ${eventData['title']}`,
        body: `📅 ${dateLabel} at ${eventData['venue']} — Hold to reply`,
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

    try {
      // This endpoint is unauthenticated — the notification extension cannot
      // carry a Firebase token — so verify the target is a real member of the
      // team before writing. Without this, any request with three plausible
      // ids could create availability records for people who do not exist.
      const memberSnap = await db
        .collection('teams').doc(teamId)
        .collection('members').doc(userId)
        .get();

      if (!memberSnap.exists) {
        res.status(404).send('Not a member of this team');
        return;
      }

      const eventSnap = await db
        .collection('teams').doc(teamId)
        .collection('events').doc(eventId)
        .get();

      if (!eventSnap.exists) {
        res.status(404).send('Event not found');
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
          // Prefer the roster's own name over whatever the caller sent, so a
          // spoofed displayName cannot land in the team's availability list.
          displayName: (memberSnap.data()?.['displayName'] as string) || displayName || '',
          response,
          respondedAt: FieldValue.serverTimestamp(),
          setByManager: false,
        });
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('[recordAvailability] Firestore write failed:', err);
      res.status(500).json({ error: 'Failed to record availability' });
    }
  }
);

export const onSubRequestCreated = onDocumentCreated(
  { document: 'teams/{teamId}/subRequests/{requestId}', region: 'northamerica-northeast1' },
  async (event) => {
    const { teamId, requestId } = event.params;
    const requestData = event.data?.data();
    console.log('[onSubRequestCreated] triggered', { teamId, requestId, requestData });
    if (!requestData) return;

    const membersSnap = await db
      .collection('teams').doc(teamId).collection('members')
      .where('role', '==', 'manager')
      .get();

    console.log('[onSubRequestCreated] managers found:', membersSnap.docs.length);

    const notifications: ExpoMessage[] = [];
    for (const memberDoc of membersSnap.docs) {
      const member = memberDoc.data();
      console.log('[onSubRequestCreated] manager:', memberDoc.id, 'pushToken:', member['pushToken'] ?? 'none');
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

    console.log('[onSubRequestCreated] sending', notifications.length, 'notifications');
    await sendBatchNotifications(notifications);
  },
);
// Apple requires any app offering account creation to offer in-app account
// deletion (App Review Guideline 5.1.1(v)). The cascade cannot run on the
// client: our rules deliberately stop a user touching other members' documents,
// and nobody can delete their own Firebase Auth record's server-side data.
//
// onCall rather than onRequest so the caller's identity comes from the verified
// ID token — an unauthenticated endpoint that deletes accounts would be a gift
// to anyone who learned a uid.
export const deleteAccount = onCall(
  { region: 'northamerica-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in to delete your account.');
    }

    const userTeamsSnap = await db.collection('users').doc(uid).collection('teams').get();
    const teamIds = userTeamsSnap.docs.map(d => d.id);

    // Pass 1 — decide what happens to each team, and refuse the whole operation
    // before deleting anything if any team would be left without a manager.
    const teamsToDelete: string[] = [];
    const teamsToLeave: string[] = [];
    const blockedBy: string[] = [];

    for (const teamId of teamIds) {
      const membersSnap = await db.collection('teams').doc(teamId).collection('members').get();
      const me = membersSnap.docs.find(d => d.id === uid);
      if (!me) continue; // stale pointer; cleaned up below

      const others = membersSnap.docs.filter(d => d.id !== uid);

      if (others.length === 0) {
        // Last person out turns off the lights.
        teamsToDelete.push(teamId);
        continue;
      }

      const iAmManager = me.data()['role'] === 'manager';
      const anotherManager = others.some(d => d.data()['role'] === 'manager');

      if (iAmManager && !anotherManager) {
        const teamDoc = await db.collection('teams').doc(teamId).get();
        blockedBy.push((teamDoc.data()?.['name'] as string) || 'your team');
        continue;
      }

      teamsToLeave.push(teamId);
    }

    if (blockedBy.length > 0) {
      // failed-precondition so the client can tell this apart from a real error
      // and show the team names rather than a generic failure.
      throw new HttpsError(
        'failed-precondition',
        'Promote another manager first.',
        { teams: blockedBy },
      );
    }

    // Pass 2 — carry it out. Nothing above has mutated anything yet.
    for (const teamId of teamsToDelete) {
      const teamRef = db.collection('teams').doc(teamId);
      const teamDoc = await teamRef.get();
      const inviteCode = teamDoc.data()?.['inviteCode'] as string | undefined;
      if (inviteCode) {
        await db.collection('inviteCodes').doc(inviteCode).delete().catch(() => {});
      }
      // recursiveDelete clears every subcollection: members (and their
      // blackouts), events (and their responses), announcements (and replies),
      // subRequests, dues.
      await db.recursiveDelete(teamRef);
    }

    for (const teamId of teamsToLeave) {
      // Their member doc, which carries their blackouts underneath it.
      await db.recursiveDelete(db.collection('teams').doc(teamId).collection('members').doc(uid));
      await db.collection('teams').doc(teamId).collection('dues').doc(uid).delete().catch(() => {});
      await db.collection('teams').doc(teamId).update({ managerIds: FieldValue.arrayRemove(uid) })
        .catch(() => {}); // team may not track managerIds
      // Their availability on every event.
      const eventsSnap = await db.collection('teams').doc(teamId).collection('events').get();
      for (const eventDoc of eventsSnap.docs) {
        await eventDoc.ref.collection('responses').doc(uid).delete().catch(() => {});
      }
    }

    // Their own profile tree, then the auth record itself.
    await db.recursiveDelete(db.collection('users').doc(uid));
    await admin.auth().deleteUser(uid);

    return { deletedTeams: teamsToDelete.length, leftTeams: teamsToLeave.length };
  },
);

// When a manager invites a specific spare to cover a game, ask that spare
// directly. Nothing notified them before — the manager invited someone and then
// waited, with no way for the spare to know they had been asked.
//
// Note the separate category. The manager-facing notification above uses
// SUB_REQUEST, which registers no action buttons; putting "I'm available" on
// that category would have put those buttons on the manager's notification too.
export const onSubSpareInvited = onDocumentUpdated(
  { document: 'teams/{teamId}/subRequests/{requestId}', region: 'northamerica-northeast1' },
  async (event) => {
    const { teamId, requestId } = event.params;
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!after) return;

    const invitedId = after['invitedSpareId'] as string | undefined;
    // Only fire when a NEW spare has just been invited. This trigger also runs
    // when the spare answers and when the manager confirms, and neither of
    // those should send another invitation.
    if (!invitedId || invitedId === before?.['invitedSpareId']) return;

    const spareDoc = await db
      .collection('teams').doc(teamId)
      .collection('members').doc(invitedId)
      .get();
    if (!spareDoc.exists) return;

    const spare = spareDoc.data() ?? {};
    if (!spare['pushToken']) return;
    if (spare['notificationsEnabled'] === false) return;

    const teamDoc  = await db.collection('teams').doc(teamId).get();
    const teamData = teamDoc.data() ?? {};

    const when  = [after['gameWeekday'], after['gameDay'], after['gameMonth']]
      .filter(Boolean).join(' ');
    const venue = after['gameVenue'] ? ` · ${after['gameVenue']}` : '';

    await sendBatchNotifications([{
      to: spare['pushToken'] as string,
      sound: 'default',
      title: `Sub needed — ${after['opponent'] ?? 'a game'}`,
      body: `A teammate needs a replacement. Are you available?${when ? `\n${when}${venue}` : ''}`,
      categoryId: 'SUB_OFFER',
      data: {
        eventId:     (after['eventId'] as string) ?? '',
        teamId,
        userId:      invitedId,
        displayName: spare['displayName'] as string,
        teamName:    (teamData['name'] as string) ?? 'Your Team',
        teamColor:   PALETTE_HEX[teamData['palette']] ?? '#2540D6',
        requestId,
      },
    }]);
  },
);
