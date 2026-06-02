import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config';

interface UseBlackoutsResult {
  dates: string[];
  loading: boolean;
}

export function useBlackouts(teamId: string, userId: string): UseBlackoutsResult {
  const [dates,   setDates]   = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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
      },
      () => setLoading(false),
    );
    return unsub;
  }, [teamId, userId]);

  return { dates, loading };
}
