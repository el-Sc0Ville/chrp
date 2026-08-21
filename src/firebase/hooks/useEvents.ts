import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config';
import type { Event } from '../schema';

interface UseEventsResult {
  events: Event[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useEvents(teamId: string): UseEventsResult {
  const [events,  setEvents]  = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  // onSnapshot never recovers on its own from a terminal error, so the only way
  // back is a fresh subscription. Bumping `attempt` re-runs the effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    const ref = collection(db, 'teams', teamId, 'events');
    const q   = query(ref, orderBy('startsAt', 'asc'));

    const unsub = onSnapshot(
      q,
      snap => {
        setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Event));
        setLoading(false);
        setError(null);
      },
      err => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [teamId, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt(n => n + 1);
  }, []);

  return { events, loading, error, retry };
}
