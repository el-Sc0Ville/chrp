import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config';
import type { DuesRecord } from '../schema';

interface UseDuesResult {
  dues: DuesRecord[];
  loading: boolean;
  error: string | null;
}

export function useDues(teamId: string): UseDuesResult {
  const [dues,    setDues]    = useState<DuesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const ref = collection(db, 'teams', teamId, 'dues');
    const unsub = onSnapshot(
      ref,
      snap => { setDues(snap.docs.map(d => d.data() as DuesRecord)); setLoading(false); setError(null); },
      err  => { setError(err.message); setLoading(false); },
    );
    return unsub;
  }, [teamId]);

  return { dues, loading, error };
}
