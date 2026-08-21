import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config';

interface UseBlackoutsResult {
  dates: string[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useBlackouts(teamId: string, userId: string): UseBlackoutsResult {
  const [dates,   setDates]   = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!teamId || !userId) {
      setDates([]);
      setLoading(false);
      return;
    }
    const ref = collection(db, 'teams', teamId, 'members', userId, 'blackouts');
    const unsub = onSnapshot(
      ref,
      snap => {
        const all: string[] = [];
        snap.docs.forEach(d => {
          const docDates = d.data().dates as string[] | undefined;
          if (docDates) all.push(...docDates);
        });
        setDates(all);
        setLoading(false);
        setError(null);
      },
      err => { console.error('[useBlackouts] snapshot error:', err); setError(err.message); setLoading(false); },
    );
    return unsub;
  }, [teamId, userId, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt(n => n + 1);
  }, []);

  return { dates, loading, error, retry };
}
