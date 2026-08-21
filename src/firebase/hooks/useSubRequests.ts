import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config';
import type { SubRequest } from '../schema';

interface UseSubRequestsResult {
  subRequests: SubRequest[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useSubRequests(teamId: string): UseSubRequestsResult {
  const [subRequests, setSubRequests] = useState<SubRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [attempt,     setAttempt]     = useState(0);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    const ref = collection(db, 'teams', teamId, 'subRequests');
    const q   = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      snap => { setSubRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SubRequest)); setLoading(false); setError(null); },
      err  => { console.error('[useSubRequests] snapshot error:', err); setError(err.message); setLoading(false); },
    );
    return unsub;
  }, [teamId, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt(n => n + 1);
  }, []);

  return { subRequests, loading, error, retry };
}
