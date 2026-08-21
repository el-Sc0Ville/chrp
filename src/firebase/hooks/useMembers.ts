import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config';
import type { Member } from '../schema';

interface UseMembersResult {
  members: Member[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useMembers(teamId: string): UseMembersResult {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    const ref = collection(db, 'teams', teamId, 'members');
    const q   = query(ref, orderBy('displayName', 'asc'));
    const unsub = onSnapshot(
      q,
      snap => { setMembers(snap.docs.map(d => d.data() as Member)); setLoading(false); setError(null); },
      err  => { setError(err.message); setLoading(false); },
    );
    return unsub;
  }, [teamId, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt(n => n + 1);
  }, []);

  return { members, loading, error, retry };
}
