import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config';
import type { DuesRecord } from '../schema';

interface UseDuesResult {
  dues: DuesRecord[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

// Pass `userId` from every non-manager caller. The dues rule only binds the
// {userId} wildcard on a get, so an unfiltered listen is denied for players —
// the where('userId','==',uid) form is the shape the rule allows. Managers omit
// it and keep the whole-collection listener.
export function useDues(teamId: string, userId?: string): UseDuesResult {
  const [dues,    setDues]    = useState<DuesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    const ref = collection(db, 'teams', teamId, 'dues');
    const q   = userId ? query(ref, where('userId', '==', userId)) : ref;
    const unsub = onSnapshot(
      q,
      snap => { setDues(snap.docs.map(d => ({ userId: d.id, ...d.data() }) as DuesRecord)); setLoading(false); setError(null); },
      err  => { setError(err.message); setLoading(false); },
    );
    return unsub;
  }, [teamId, userId, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt(n => n + 1);
  }, []);

  return { dues, loading, error, retry };
}
