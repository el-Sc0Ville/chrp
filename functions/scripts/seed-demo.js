#!/usr/bin/env node
// Builds (or refreshes) the App Review demo team: a full roster of made-up
// players, past / cancelled / upcoming games with answers, an announcement
// thread, a sub request and dues. The made-up players have no accounts, so no
// emails or devices are needed; a reviewer joins with the invite code.
//
// Usage (from the functions folder):
//   node scripts/seed-demo.js --key ~/Downloads/chrp-app-firebase-adminsdk.json
// Options:
//   --code XXXXXX          invite code to publish (default DEMO26)
//   --manager-email EMAIL  also add this existing Chrp account as a manager
//
// Safe to re-run: it rebuilds games, announcements, subs and dues with fresh
// dates and replaces the made-up players, but keeps any real person who has
// joined (for example the App Review account).
//
// The key file is a full admin credential. Never commit it, email it or paste
// it anywhere; delete it once the demo is set up.
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const { Timestamp, FieldValue } = require('firebase-admin/firestore');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const TEAM_ID = 'chrp-demo';
const TEAM_NAME = 'Demo Dogs';
const PALETTE = 'verdant';
const CODE = (arg('code') || 'DEMO26').toUpperCase();
const MANAGER_EMAIL = arg('manager-email');
const KEY = arg('key');
const EMULATOR = process.argv.includes('--emulator');

if (!/^[A-Z0-9]{6}$/.test(CODE)) {
  console.error('The invite code must be exactly 6 letters or digits.');
  process.exit(1);
}

if (EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  admin.initializeApp({ projectId: 'demo-chrp' });
} else {
  if (!KEY) {
    console.error('Missing --key. Download it from Firebase console > Project settings > Service accounts.');
    process.exit(1);
  }
  const keyPath = path.resolve(KEY.replace(/^~/, process.env.HOME || ''));
  if (!fs.existsSync(keyPath)) {
    console.error(`Key file not found: ${keyPath}`);
    process.exit(1);
  }
  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(key) });
  console.log(`Project: ${key.project_id}`);
}
const db = admin.firestore();

// ─── Dates (in this computer's time zone) ────────────────────────────────────
function at(daysFromNow, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}
const ts = d => Timestamp.fromDate(d);
const plusMinutes = (d, m) => new Date(d.getTime() + m * 60000);
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function clock(d) {
  const h = d.getHours(), m = d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ─── Roster (made-up people; ids all start with "demo-") ─────────────────────
const PEOPLE = [
  { id: 'demo-manager', name: 'Sam Carter',     jersey: 9,  role: 'manager' },
  { id: 'demo-p1',      name: 'Alex Morgan',    jersey: 4,  role: 'player' },
  { id: 'demo-p2',      name: 'Jordan Lee',     jersey: 11, role: 'player' },
  { id: 'demo-p3',      name: 'Taylor Brooks',  jersey: 17, role: 'player' },
  { id: 'demo-p4',      name: 'Casey Nguyen',   jersey: 22, role: 'player' },
  { id: 'demo-p5',      name: 'Riley Patel',    jersey: 27, role: 'player' },
  { id: 'demo-p6',      name: 'Morgan Dubois',  jersey: 33, role: 'player' },
  { id: 'demo-p7',      name: 'Jamie Fraser',   jersey: 44, role: 'player' },
  { id: 'demo-p8',      name: 'Drew Santos',    jersey: 71, role: 'player' },
  { id: 'demo-s1',      name: 'Chris Lavoie',   jersey: 15, role: 'spare' },
  { id: 'demo-s2',      name: 'Quinn Murphy',   jersey: 38, role: 'spare' },
];
const name = id => PEOPLE.find(p => p.id === id).name;

async function main() {
  // The code must not already belong to another team.
  const codeRef = db.collection('inviteCodes').doc(CODE);
  const existingCode = await codeRef.get();
  if (existingCode.exists && existingCode.data().teamId !== TEAM_ID) {
    console.error(`Invite code ${CODE} is already used by another team. Pick another with --code.`);
    process.exit(1);
  }

  let manager = null;
  if (MANAGER_EMAIL) {
    const user = await admin.auth().getUserByEmail(MANAGER_EMAIL);
    // Email-link accounts have no Auth display name; the app keeps the name the
    // person chose during onboarding on their profile document instead.
    const profile = (await db.collection('users').doc(user.uid).get()).data() || {};
    manager = { id: user.uid, name: profile.displayName || user.displayName || 'Manager' };
  }

  const teamRef = db.collection('teams').doc(TEAM_ID);

  // Clear what this script owns. Real people who joined (not "demo-") stay.
  for (const sub of ['events', 'announcements', 'subRequests', 'dues']) {
    await db.recursiveDelete(teamRef.collection(sub));
  }
  const oldMembers = await teamRef.collection('members').get();
  for (const m of oldMembers.docs) {
    if (m.id.startsWith('demo-')) await db.recursiveDelete(m.ref);
  }

  const ops = [];
  const set = (ref, data) => ops.push([ref, data]);
  const now = new Date();

  const managerIds = ['demo-manager', ...(manager ? [manager.id] : [])];
  set(teamRef, {
    name: TEAM_NAME,
    sport: 'Hockey',
    palette: PALETTE,
    managerIds,
    inviteCode: CODE,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto',
    createdAt: ts(at(-30, 12)),
  });
  set(codeRef, { teamId: TEAM_ID, teamName: TEAM_NAME, palette: PALETTE, createdAt: FieldValue.serverTimestamp() });

  for (const p of PEOPLE) {
    set(teamRef.collection('members').doc(p.id), {
      userId: p.id,
      displayName: p.name,
      jerseyNumber: p.jersey,
      role: p.role,
      email: '',
      autoIn: p.role !== 'spare',
      joinedAt: ts(at(-30, 12)),
    });
  }
  if (manager) {
    // Only written if missing, so a re-run never resets the manager's settings.
    const ref = teamRef.collection('members').doc(manager.id);
    if (!(await ref.get()).exists) {
      set(ref, {
        userId: manager.id, displayName: manager.name, jerseyNumber: 1, role: 'manager',
        email: MANAGER_EMAIL, autoIn: true, joinedAt: ts(now),
      });
    }
    set(db.collection('users').doc(manager.id).collection('teams').doc(TEAM_ID), {
      teamId: TEAM_ID, teamName: TEAM_NAME, palette: PALETTE, role: 'manager', joinedAt: ts(now),
    });
  }

  // ─── Games ────────────────────────────────────────────────────────────────
  const roster = PEOPLE.filter(p => p.role !== 'spare').map(p => p.id);
  const games = [
    { id: 'past',      opp: 'Ice Hawks',      days: -6, hour: 21, venue: 'Westside Arena — Rink 2',
      extra: { scoreUs: 4, scoreThem: 2 },
      answers: { 'demo-p3': 'out', 'demo-p6': 'maybe' } },
    { id: 'cancelled', opp: 'North Stars',    days: 4,  hour: 20, venue: 'Riverside Community Rink',
      extra: { status: 'cancelled', cancelReason: 'Rink closed for maintenance. See you next week!' },
      answers: {} },
    { id: 'next',      opp: 'Blue Line Club', days: 2,  hour: 20, minute: 30, venue: 'Westside Arena — Rink 2',
      answers: { 'demo-p2': 'out', 'demo-p5': 'maybe', 'demo-p7': 'out' } },
    { id: 'game3',     opp: 'Puck Dynasty',   days: 9,  hour: 21, venue: 'Westside Arena — Rink 1',
      answers: { 'demo-p4': 'maybe' } },
    { id: 'game4',     opp: 'Ice Hawks',      days: 16, hour: 19, minute: 45, venue: 'Riverside Community Rink',
      answers: {} },
    { id: 'game5',     opp: 'North Stars',    days: 23, hour: 20, minute: 30, venue: 'Westside Arena — Rink 2',
      answers: {} },
  ];
  for (const g of games) {
    const start = at(g.days, g.hour, g.minute || 0);
    const ref = teamRef.collection('events').doc(g.id);
    set(ref, {
      type: 'game',
      title: `vs ${g.opp}`,
      opponent: g.opp,
      venue: g.venue,
      startsAt: ts(start),
      endsAt: ts(plusMinutes(start, 90)),
      recurring: false,
      status: 'active',
      ...(g.extra || {}),
      createdBy: 'demo-manager',
      createdAt: ts(at(-20, 12)),
    });
    if (g.extra && g.extra.status === 'cancelled') continue;
    // Same shape the app's auto-in writes: everyone on the roster starts "in",
    // then a few have changed their answer.
    for (const uid of roster) {
      const changed = g.answers[uid];
      set(ref.collection('responses').doc(uid), {
        userId: uid,
        displayName: name(uid),
        response: changed || 'in',
        respondedAt: ts(at(-1, 12)),
        setByManager: false,
        ...(changed ? {} : { autoIn: true }),
      });
    }
  }

  // ─── Announcements ────────────────────────────────────────────────────────
  const welcome = teamRef.collection('announcements').doc('welcome');
  set(welcome, {
    body: 'Welcome to the Demo Dogs! Answer In / Out / Maybe for each game, and if you can\'t make it, Chrp will offer to find you a sub.',
    authorId: 'demo-manager', authorName: name('demo-manager'), pinned: true,
    createdAt: ts(at(-3, 18)),
  });
  set(welcome.collection('replies').doc('r1'), {
    authorId: 'demo-p1', authorName: name('demo-p1'), body: 'Thanks Sam, see everyone at the rink!',
    createdAt: ts(at(-3, 19)),
  });
  set(welcome.collection('replies').doc('r2'), {
    authorId: 'demo-p4', authorName: name('demo-p4'), body: 'Bringing the extra pucks 🏒',
    createdAt: ts(at(-2, 9)),
  });
  set(teamRef.collection('announcements').doc('jerseys'), {
    body: 'New jerseys arrive next week. Pick yours up before the Puck Dynasty game.',
    authorId: 'demo-manager', authorName: name('demo-manager'), pinned: false,
    createdAt: ts(at(-1, 20)),
  });

  // ─── Sub request (Jordan is out for the next game) ───────────────────────
  const nextStart = at(2, 20, 30);
  set(teamRef.collection('subRequests').doc('jordan-next'), {
    eventId: 'next',
    requestedBy: 'demo-p2',
    requestedByName: name('demo-p2'),
    reason: null,
    status: 'pending',
    createdAt: ts(at(-1, 13)),
    opponent: 'Blue Line Club',
    gameWeekday: WEEKDAYS[nextStart.getDay()],
    gameDay: String(nextStart.getDate()).padStart(2, '0'),
    gameMonth: MONTHS[nextStart.getMonth()],
    gameVenue: 'Westside Arena — Rink 2',
    gameTime: clock(nextStart),
  });

  // ─── Dues ─────────────────────────────────────────────────────────────────
  const dues = [
    ['demo-p1', 250, 'paid'], ['demo-p2', 125, 'partial'], ['demo-p3', 250, 'paid'],
    ['demo-p4', 0, 'pending'], ['demo-p5', 250, 'paid'], ['demo-p6', 0, 'overdue'],
    ['demo-p7', 250, 'paid'], ['demo-p8', 100, 'partial'],
  ];
  for (const [uid, paid, status] of dues) {
    set(teamRef.collection('dues').doc(uid), {
      userId: uid, displayName: name(uid), seasonAmount: 250, amountPaid: paid, status,
      dueDate: ts(at(14, 12)),
    });
  }

  // Write in batches (Firestore allows 500 writes per batch).
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    for (const [ref, data] of ops.slice(i, i + 400)) batch.set(ref, data);
    await batch.commit();
  }

  console.log(`Done. Team "${TEAM_NAME}" is ready with ${PEOPLE.length} made-up members and ${games.length} games.`);
  console.log(`Invite code for App Review: ${CODE}`);
  console.log('Next upcoming game is in 2 days; the last one is in 23 days. Re-run this any time to refresh the dates.');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Seeding failed:', err.message || err);
  process.exit(1);
});
