import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Must match the region the function is deployed to, or the call 404s.
const FUNCTIONS_REGION = 'northamerica-northeast1';

export interface DeleteAccountResult {
  deletedTeams: number;
  leftTeams: number;
}

/**
 * Thrown when the account cannot be deleted yet because the user is the only
 * manager of a team that still has other members. Carries the team names so the
 * UI can say which ones, rather than showing a generic failure.
 */
export class ManagerHandoverRequired extends Error {
  constructor(public readonly teams: string[]) {
    super('Promote another manager first.');
    this.name = 'ManagerHandoverRequired';
  }
}

/**
 * Deletes the signed-in user's account and all their data.
 *
 * The cascade runs server-side: our security rules deliberately prevent a user
 * from touching other members' documents, and the Firebase Auth record can only
 * be removed with admin credentials. See the deleteAccount function.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const fn = httpsCallable<void, DeleteAccountResult>(
    getFunctions(getApp(), FUNCTIONS_REGION),
    'deleteAccount',
  );

  try {
    const result = await fn();
    return result.data;
  } catch (err) {
    const e = err as { code?: string; details?: { teams?: string[] } };
    if (e.code === 'functions/failed-precondition') {
      throw new ManagerHandoverRequired(e.details?.teams ?? []);
    }
    throw err;
  }
}
