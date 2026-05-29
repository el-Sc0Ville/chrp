import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config';
import type { Event } from '../schema';

interface UseEventsResult {
  events: Event[];
  loading: boolean;
  error: string | null;
}

export function useEvents(teamId: string): UseEventsResult {
  const [events,  setEvents]  = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    console.log('useEvents called with teamId:', teamId);
    const ref = collection(db, 'teams', teamId, 'events');
    const q   = query(ref, orderBy('startsAt', 'asc'));

    const unsub = onSnapshot(
      q,
      snap => {
        console.log('useEvents: snapshot fired, docs count:', snap.docs.length);
        setEvents(snap.docs.map(d => d.data() as Event));
        setLoading(false);
        setError(null);
      },
      err => {
        setError(err.message);
        setLoading(false);
      },
    );
    console.log('useEvents: setting up snapshot for team:', teamId);
    return unsub;
  }, [teamId]);

  return { events, loading, error };
}
