import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config';
import type { Team } from '../schema';

interface UseTeamResult {
  team: Team | null;
  loading: boolean;
  error: string | null;
}

export function useTeam(teamId: string): UseTeamResult {
  const [team,    setTeam]    = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) { setTeam(null); setLoading(false); return; }
    const ref = doc(db, 'teams', teamId);
    const unsub = onSnapshot(
      ref,
      snap => {
        setTeam(snap.exists() ? (snap.data() as Team) : null);
        setLoading(false);
        setError(null);
      },
      err => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [teamId]);

  return { team, loading, error };
}
