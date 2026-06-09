import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config';
import type { AvailabilityResponse } from '../schema';

// userId → response value
type ResponseMap = Record<string, AvailabilityResponse['response']>;

interface UseResponsesResult {
  responses: ResponseMap;
  loading: boolean;
  error: string | null;
}

export function useResponses(teamId: string, eventId: string | null): UseResponsesResult {
  const [responses, setResponses] = useState<ResponseMap>({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!teamId || !eventId) {
      setResponses({});
      setLoading(false);
      return;
    }

    const ref = collection(db, 'teams', teamId, 'events', eventId, 'responses');
    const unsub = onSnapshot(
      ref,
      snap => {
        console.log('useResponses snapshot fired, count:', snap.docs.length);
        const map: ResponseMap = {};
        snap.docs.forEach(d => {
          const data = d.data() as AvailabilityResponse;
          map[data.userId] = data.response;
        });
        setResponses(map);
        setLoading(false);
        setError(null);
      },
      err => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [teamId, eventId]);

  return { responses, loading, error };
}
