import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config';
import type { UserTeam } from '../schema';

export function useUserTeams(userId: string | null): { teams: UserTeam[]; loading: boolean } {
  const [teams,   setTeams]   = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setTeams([]);
      setLoading(false);
      return;
    }
    const ref = collection(db, 'users', userId, 'teams');
    const unsub = onSnapshot(
      ref,
      snap => { setTeams(snap.docs.map(d => d.data() as UserTeam)); setLoading(false); },
      ()   => setLoading(false),
    );
    return unsub;
  }, [userId]);

  return { teams, loading };
}
