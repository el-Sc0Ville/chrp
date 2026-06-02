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
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Event);
        setEvents(all.filter(e => e.status !== 'cancelled'));
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
