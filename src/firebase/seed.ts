import {
  doc, setDoc, collection, writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { Team, Member, Event, AvailabilityResponse, Announcement, AnnouncementReply, DuesRecord } from './schema';
const TEAM_ID = 'trashdogs';

// ─── Timestamps ───────────────────────────────────────────────────────────────

function daysAgo(n: number): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Timestamp.fromDate(d);
}

function daysFromNow(n: number, hour = 19, minute = 30): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, minute, 0, 0);
  return Timestamp.fromDate(d);
}

// ─── Members ──────────────────────────────────────────────────────────────────

const MEMBERS: Omit<Member, 'joinedAt'>[] = [
  { userId: 'r1',  displayName: 'Pat Normandin',        jerseyNumber: 11, role: 'manager', email: 'pat@trashdogs.ca',       autoIn: true },
  { userId: 'r2',  displayName: 'Mathieu Gagnon',        jerseyNumber: 29, role: 'manager', email: 'mathieu@trashdogs.ca',   autoIn: true },
  { userId: 'r3',  displayName: 'Pat Normandin',         jerseyNumber: 11, role: 'player',  email: 'pat.p@trashdogs.ca',     autoIn: true },
  { userId: 'r4',  displayName: 'Olivier Tremblay',      jerseyNumber:  4, role: 'player',  email: 'olivier@trashdogs.ca',   autoIn: true },
  { userId: 'r5',  displayName: 'Alexis Bergeron',       jerseyNumber: 19, role: 'player',  email: 'alexis@trashdogs.ca',    autoIn: true },
  { userId: 'r6',  displayName: 'Marc-Antoine Bouchard', jerseyNumber: 88, role: 'player',  email: 'marc@trashdogs.ca',      autoIn: true },
  { userId: 'r7',  displayName: 'Émilie Lemieux',        jerseyNumber: 23, role: 'player',  email: 'emilie@trashdogs.ca',    autoIn: true },
  { userId: 'r8',  displayName: 'Jean-François Caron',   jerseyNumber: 16, role: 'player',  email: 'jf@trashdogs.ca',        autoIn: true },
  { userId: 'r9',  displayName: 'Stéphane Lapointe',     jerseyNumber: 55, role: 'spare',   email: 'stephane@trashdogs.ca',  autoIn: false },
  { userId: 'r10', displayName: 'Véronique Rivard',      jerseyNumber: 37, role: 'spare',   email: 'veronique@trashdogs.ca', autoIn: false },
];

// ─── Events ───────────────────────────────────────────────────────────────────

interface EventSeed {
  event: Omit<Event, 'createdAt'>;
  responses: Omit<AvailabilityResponse, 'respondedAt'>[];
}

const EVENTS: EventSeed[] = [
  {
    event: {
      id: 'e1',
      type: 'game',
      title: 'vs Ember FC',
      opponent: 'Ember FC',
      venue: 'Arena Nord',
      startsAt: daysFromNow(2, 19, 30),
      endsAt:   daysFromNow(2, 21,  0),
      recurring: false,
      createdBy: 'r1',
    },
    responses: [
      { userId: 'r1',  displayName: 'Pat Normandin',        response: 'in',    setByManager: false },
      { userId: 'r2',  displayName: 'Mathieu Gagnon',        response: 'in',    setByManager: false },
      { userId: 'r3',  displayName: 'Pat Normandin',         response: 'in',    setByManager: false },
      { userId: 'r5',  displayName: 'Alexis Bergeron',       response: 'in',    setByManager: false },
      { userId: 'r6',  displayName: 'Marc-Antoine Bouchard', response: 'in',    setByManager: false },
      { userId: 'r8',  displayName: 'Jean-François Caron',   response: 'in',    setByManager: false },
      { userId: 'r9',  displayName: 'Stéphane Lapointe',     response: 'in',    setByManager: false },
      { userId: 'r4',  displayName: 'Olivier Tremblay',      response: 'out',   setByManager: false },
      { userId: 'r7',  displayName: 'Émilie Lemieux',        response: 'out',   setByManager: false },
      { userId: 'r10', displayName: 'Véronique Rivard',      response: 'maybe', setByManager: false },
    ],
  },
  {
    event: {
      id: 'e2',
      type: 'practice',
      title: 'Team Practice',
      venue: 'Inner Ice Complex',
      startsAt: daysFromNow(6, 18, 0),
      endsAt:   daysFromNow(6, 19, 30),
      recurring: true,
      createdBy: 'r1',
    },
    responses: [
      { userId: 'r1',  displayName: 'Pat Normandin',        response: 'in',  setByManager: false },
      { userId: 'r2',  displayName: 'Mathieu Gagnon',        response: 'in',  setByManager: false },
      { userId: 'r3',  displayName: 'Pat Normandin',         response: 'in',  setByManager: false },
      { userId: 'r5',  displayName: 'Alexis Bergeron',       response: 'in',  setByManager: false },
      { userId: 'r6',  displayName: 'Marc-Antoine Bouchard', response: 'in',  setByManager: false },
      { userId: 'r7',  displayName: 'Émilie Lemieux',        response: 'in',  setByManager: false },
      { userId: 'r8',  displayName: 'Jean-François Caron',   response: 'in',  setByManager: false },
      { userId: 'r9',  displayName: 'Stéphane Lapointe',     response: 'in',  setByManager: false },
      { userId: 'r10', displayName: 'Véronique Rivard',      response: 'in',  setByManager: false },
      { userId: 'r4',  displayName: 'Olivier Tremblay',      response: 'out', setByManager: false },
    ],
  },
  {
    event: {
      id: 'e3',
      type: 'game',
      title: '@ Aurora Sky',
      opponent: 'Aurora Sky',
      venue: 'Stadium B',
      startsAt: daysFromNow(9, 20, 0),
      endsAt:   daysFromNow(9, 21, 30),
      recurring: false,
      createdBy: 'r1',
    },
    responses: [
      { userId: 'r1',  displayName: 'Pat Normandin',        response: 'in',    setByManager: false },
      { userId: 'r2',  displayName: 'Mathieu Gagnon',        response: 'in',    setByManager: false },
      { userId: 'r6',  displayName: 'Marc-Antoine Bouchard', response: 'in',    setByManager: false },
      { userId: 'r9',  displayName: 'Stéphane Lapointe',     response: 'in',    setByManager: false },
      { userId: 'r10', displayName: 'Véronique Rivard',      response: 'in',    setByManager: false },
      { userId: 'r4',  displayName: 'Olivier Tremblay',      response: 'out',   setByManager: false },
      { userId: 'r5',  displayName: 'Alexis Bergeron',       response: 'out',   setByManager: false },
      { userId: 'r7',  displayName: 'Émilie Lemieux',        response: 'out',   setByManager: false },
      { userId: 'r3',  displayName: 'Pat Normandin',         response: 'maybe', setByManager: false },
      { userId: 'r8',  displayName: 'Jean-François Caron',   response: 'maybe', setByManager: false },
    ],
  },
  {
    event: {
      id: 'e4',
      type: 'social',
      title: 'End of Season Party',
      venue: 'The Penalty Box',
      startsAt: daysFromNow(15, 19, 0),
      endsAt:   daysFromNow(15, 23, 0),
      recurring: false,
      createdBy: 'r1',
    },
    responses: [
      { userId: 'r1',  displayName: 'Pat Normandin',        response: 'in',  setByManager: false },
      { userId: 'r2',  displayName: 'Mathieu Gagnon',        response: 'in',  setByManager: false },
      { userId: 'r3',  displayName: 'Pat Normandin',         response: 'in',  setByManager: false },
      { userId: 'r5',  displayName: 'Alexis Bergeron',       response: 'in',  setByManager: false },
      { userId: 'r6',  displayName: 'Marc-Antoine Bouchard', response: 'in',  setByManager: false },
      { userId: 'r7',  displayName: 'Émilie Lemieux',        response: 'in',  setByManager: false },
      { userId: 'r8',  displayName: 'Jean-François Caron',   response: 'in',  setByManager: false },
      { userId: 'r9',  displayName: 'Stéphane Lapointe',     response: 'in',  setByManager: false },
      { userId: 'r10', displayName: 'Véronique Rivard',      response: 'in',  setByManager: false },
      { userId: 'r4',  displayName: 'Olivier Tremblay',      response: 'out', setByManager: false },
    ],
  },
  // Past events with scores
  {
    event: {
      id: 'p1',
      type: 'game',
      title: 'vs Verdant FC',
      opponent: 'Verdant FC',
      venue: 'Arena Nord',
      startsAt: daysFromNow(-12, 19, 30),
      endsAt:   daysFromNow(-12, 21,  0),
      recurring: false,
      scoreUs: 4,
      scoreThem: 2,
      createdBy: 'r1',
    },
    responses: [],
  },
  {
    event: {
      id: 'p2',
      type: 'practice',
      title: 'Team Practice',
      venue: 'Inner Ice Complex',
      startsAt: daysFromNow(-8, 18, 0),
      endsAt:   daysFromNow(-8, 19, 30),
      recurring: true,
      createdBy: 'r1',
    },
    responses: [],
  },
  {
    event: {
      id: 'p3',
      type: 'game',
      title: 'vs Ice Kings',
      opponent: 'Ice Kings',
      venue: 'The Barn — Rink 2',
      startsAt: daysFromNow(-19, 19, 30),
      endsAt:   daysFromNow(-19, 21,  0),
      recurring: false,
      scoreUs: 1,
      scoreThem: 3,
      createdBy: 'r1',
    },
    responses: [],
  },
];

// ─── Announcements ────────────────────────────────────────────────────────────

interface AnnouncementSeed {
  announcement: Omit<Announcement, 'createdAt'>;
  replies: Omit<AnnouncementReply, 'createdAt'>[];
}

const ANNOUNCEMENTS: AnnouncementSeed[] = [
  {
    announcement: {
      id: 'ann1',
      authorId: 'r1',
      authorName: 'Pat Normandin',
      body: "⚠️ Heads up: ice time has moved to 9:45 pm this Sunday. Gate C is still our meeting point — see you out there.",
      pinned: true,
    },
    replies: [
      { id: 'rep1a', authorId: 'r2',  authorName: 'Mathieu Gagnon',        body: "Got it. Does that change the warm-up time too?" },
      { id: 'rep1b', authorId: 'r3',  authorName: 'Pat Normandin',         body: "Thanks for the heads up! 👍" },
      { id: 'rep1c', authorId: 'r4',  authorName: 'Olivier Tremblay',      body: "Will we still use the same entrance?" },
    ],
  },
  {
    announcement: {
      id: 'ann2',
      authorId: 'r1',
      authorName: 'Pat Normandin',
      body: "New jerseys are in — see me before or after Sunday's game to pick yours up. Extra smalls and XLs still available.",
      pinned: false,
    },
    replies: [
      { id: 'rep2a', authorId: 'r6',  authorName: 'Marc-Antoine Bouchard', body: "Can we pick them up before the game on Sunday?" },
      { id: 'rep2b', authorId: 'r7',  authorName: 'Émilie Lemieux',        body: "I'm a medium — saving you the trouble of guessing 😄" },
    ],
  },
  {
    announcement: {
      id: 'ann3',
      authorId: 'r2',
      authorName: 'Mathieu Gagnon',
      body: "Friendly reminder to update your availability for the playoff rounds — we need a final headcount by Thursday noon.",
      pinned: false,
    },
    replies: [],
  },
  {
    announcement: {
      id: 'ann4',
      authorId: 'r1',
      authorName: 'Pat Normandin',
      body: "Great game last week everyone 🎉 Heading to Tavern on the Green after Sunday's game if you're in — first round's on me.",
      pinned: false,
    },
    replies: [
      { id: 'rep4a', authorId: 'r8',  authorName: 'Jean-François Caron',  body: "I'm in! Best post-game tradition 🍺" },
      { id: 'rep4b', authorId: 'r9',  authorName: 'Stéphane Lapointe',    body: "Count me in too 🙌" },
    ],
  },
];

// ─── Dues ─────────────────────────────────────────────────────────────────────

const DUES: DuesRecord[] = [
  { userId: 'r1',  displayName: 'Pat Normandin',        seasonAmount: 500, amountPaid: 0, status: 'pending' },
  { userId: 'r2',  displayName: 'Mathieu Gagnon',        seasonAmount: 500, amountPaid: 0, status: 'pending' },
  { userId: 'r3',  displayName: 'Pat Normandin',         seasonAmount: 500, amountPaid: 0, status: 'pending' },
  { userId: 'r4',  displayName: 'Olivier Tremblay',      seasonAmount: 500, amountPaid: 0, status: 'pending' },
  { userId: 'r5',  displayName: 'Alexis Bergeron',       seasonAmount: 500, amountPaid: 0, status: 'pending' },
  { userId: 'r6',  displayName: 'Marc-Antoine Bouchard', seasonAmount: 500, amountPaid: 0, status: 'pending' },
  { userId: 'r7',  displayName: 'Émilie Lemieux',        seasonAmount: 500, amountPaid: 0, status: 'pending' },
  { userId: 'r8',  displayName: 'Jean-François Caron',   seasonAmount: 500, amountPaid: 0, status: 'pending' },
];

// ─── Seed function ────────────────────────────────────────────────────────────

export async function seedDatabase(): Promise<void> {
  const now = Timestamp.now();

  // Team document
  const team: Team = {
    id: TEAM_ID,
    name: 'Trash Dogs',
    sport: 'hockey',
    palette: 'trashdogs',
    managerIds: ['r1', 'r2'],
    createdAt: daysAgo(60),
  };
  await setDoc(doc(db, 'teams', TEAM_ID), team);

  // Members
  {
    const batch = writeBatch(db);
    for (const m of MEMBERS) {
      const ref = doc(db, 'teams', TEAM_ID, 'members', m.userId);
      batch.set(ref, { ...m, joinedAt: daysAgo(60) } satisfies Member);
    }
    await batch.commit();
  }

  // Events + responses
  for (const { event, responses } of EVENTS) {
    const eventRef = doc(db, 'teams', TEAM_ID, 'events', event.id);
    await setDoc(eventRef, { ...event, createdAt: now } satisfies Event);

    if (responses.length > 0) {
      const batch = writeBatch(db);
      for (const r of responses) {
        const rRef = doc(db, 'teams', TEAM_ID, 'events', event.id, 'responses', r.userId);
        batch.set(rRef, { ...r, respondedAt: daysAgo(1) } satisfies AvailabilityResponse);
      }
      await batch.commit();
    }
  }

  // Announcements + replies
  const annTimestamps = [daysAgo(0), daysAgo(1), daysAgo(3), daysAgo(5)];
  const repOffsets    = [daysAgo(0), daysAgo(1), daysAgo(3), daysAgo(5)];

  for (let i = 0; i < ANNOUNCEMENTS.length; i++) {
    const { announcement, replies } = ANNOUNCEMENTS[i];
    const annRef = doc(db, 'teams', TEAM_ID, 'announcements', announcement.id);
    await setDoc(annRef, { ...announcement, createdAt: annTimestamps[i] } satisfies Announcement);

    if (replies.length > 0) {
      const batch = writeBatch(db);
      for (const r of replies) {
        const rRef = doc(db, 'teams', TEAM_ID, 'announcements', announcement.id, 'replies', r.id);
        batch.set(rRef, { ...r, createdAt: repOffsets[i] } satisfies AnnouncementReply);
      }
      await batch.commit();
    }
  }

  // Dues
  {
    const batch = writeBatch(db);
    for (const d of DUES) {
      const ref = doc(db, 'teams', TEAM_ID, 'dues', d.userId);
      batch.set(ref, d);
    }
    await batch.commit();
  }
}

// One-time dev utility: set autoIn: true on all existing members without re-seeding
export async function updateMemberDefaults(): Promise<void> {
  const batch = writeBatch(db);
  for (const m of MEMBERS) {
    if (m.role === 'spare') continue;
    batch.update(doc(db, 'teams', TEAM_ID, 'members', m.userId), { autoIn: true });
  }
  await batch.commit();
}
