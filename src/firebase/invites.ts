import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import type { TeamKey } from '../theme';

export interface InviteTarget {
  teamId: string;
  teamName: string;
  palette: TeamKey;
}

const CODE_PATTERN = /^[A-Z0-9]{6}$/;

/**
 * Resolve an invite code to the team it belongs to.
 *
 * Codes are read from /inviteCodes/{CODE} rather than by querying /teams. A
 * query over /teams can never be permitted: on a `list` operation the {teamId}
 * wildcard is unbound, so isMember() cannot be evaluated, and opening /teams to
 * listing would hand every team's invite code to any signed-in user. This table
 * is readable by document id only and is explicitly not listable, so codes
 * cannot be enumerated.
 *
 * The caller must already be authenticated — anonymous is fine.
 * Returns null for a malformed or unknown code.
 */
export async function resolveInviteCode(rawCode: string): Promise<InviteTarget | null> {
  const code = rawCode.trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) return null;

  const snap = await getDoc(doc(db, 'inviteCodes', code));
  if (!snap.exists()) return null;

  const data   = snap.data();
  const teamId = data['teamId'] as string | undefined;
  if (!teamId) return null;

  return {
    teamId,
    teamName: (data['teamName'] as string) || 'Your team',
    palette:  ((data['palette'] as TeamKey) ?? 'trashdogs'),
  };
}

/**
 * Publish the lookup entry for a team's invite code. Managers only — the rules
 * allow a create for a team you manage, and an update only when the existing
 * entry already points at your team, so one manager cannot repoint another
 * team's code.
 *
 * Safe to call repeatedly: it also heals teams created before this table
 * existed, whose codes would otherwise resolve to nothing.
 */
export async function publishInviteCode(
  code: string,
  teamId: string,
  teamName: string,
  palette: TeamKey,
): Promise<void> {
  const upper = code.trim().toUpperCase();
  if (!CODE_PATTERN.test(upper)) return;
  await setDoc(doc(db, 'inviteCodes', upper), {
    teamId,
    teamName,
    palette,
    createdAt: serverTimestamp(),
  });
}
