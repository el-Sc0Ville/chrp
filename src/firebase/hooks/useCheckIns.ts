import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config';

// userId → true if status === 'here'
type CheckInMap = Record<string, boolean>;

export function useCheckIns(teamId: string, eventId: string | null): CheckInMap {
  const [checkIns, setCheckIns] = useState<CheckInMap>({});

  useEffect(() => {
    if (!teamId || !eventId) { setCheckIns({}); return; }
    const ref = collection(db, 'teams', teamId, 'events', eventId, 'responses');
    const unsub = onSnapshot(
      ref,
      snap => {
        const map: CheckInMap = {};
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.status === 'here') map[data.userId as string] = true;
        });
        setCheckIns(map);
      },
      err => console.error('[useCheckIns] snapshot error:', err),
    );
    return unsub;
  }, [teamId, eventId]);

  return checkIns;
}
