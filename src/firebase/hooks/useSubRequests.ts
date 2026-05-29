import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config';
import type { SubRequest } from '../schema';

interface UseSubRequestsResult {
  subRequests: SubRequest[];
  loading: boolean;
}

export function useSubRequests(teamId: string): UseSubRequestsResult {
  const [subRequests, setSubRequests] = useState<SubRequest[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const ref = collection(db, 'teams', teamId, 'subRequests');
    const q   = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      snap => { setSubRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SubRequest)); setLoading(false); },
      ()   => setLoading(false),
    );
    return unsub;
  }, [teamId]);

  return { subRequests, loading };
}
