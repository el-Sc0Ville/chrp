import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../config';
import { reloadWidget } from '../../widget';
import type { AvailabilityResponse } from '../schema';

// userId → response value
type ResponseMap = Record<string, AvailabilityResponse['response']>;

interface UseResponsesResult {
  responses: ResponseMap;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useResponses(teamId: string, eventId: string | null): UseResponsesResult {
  const [responses, setResponses] = useState<ResponseMap>({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [attempt,   setAttempt]   = useState(0);

  useEffect(() => {
    if (!teamId || !eventId) {
      setResponses({});
      setLoading(false);
      return;
    }

    const ref = collection(db, 'teams', teamId, 'events', eventId, 'responses');
    // Set when the signed-in player's own answer changes, and acted on once the
    // server has it: the widget fetches from the server, so reloading it while
    // the write is still pending would just show the old answer again.
    // includeMetadataChanges is what delivers that "now confirmed" snapshot.
    let ownChangePending = false;
    let firstSnapshot = true;
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      snap => {
        const changes = snap.docChanges();
        const uid = auth.currentUser?.uid;
        // The first snapshot lists every doc as "added"; that is a load, not a change.
        if (!firstSnapshot && uid && changes.some(c => c.doc.id === uid)) ownChangePending = true;
        if (ownChangePending && !snap.metadata.hasPendingWrites && !snap.metadata.fromCache) {
          ownChangePending = false;
          reloadWidget();
        }
        // Metadata-only snapshots carry no new data; skip the re-render.
        if (!firstSnapshot && changes.length === 0) return;
        firstSnapshot = false;
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
  }, [teamId, eventId, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt(n => n + 1);
  }, []);

  return { responses, loading, error, retry };
}
