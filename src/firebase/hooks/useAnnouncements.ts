import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config';
import type { Announcement } from '../schema';
import { useModeration, announcementKey } from '../../moderation';

interface UseAnnouncementsResult {
  announcements: Announcement[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useAnnouncements(teamId: string): UseAnnouncementsResult {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    const ref = collection(db, 'teams', teamId, 'announcements');
    const q   = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      snap => { setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Announcement)); setLoading(false); setError(null); },
      err  => { setError(err.message); setLoading(false); },
    );
    return unsub;
  }, [teamId, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt(n => n + 1);
  }, []);

  // Posts by people this user blocked, or that they reported, never reach a screen.
  const { isHidden } = useModeration();
  const visible = useMemo(
    () => announcements.filter(a => !isHidden(a.authorId, announcementKey(a.id))),
    [announcements, isHidden],
  );

  return { announcements: visible, loading, error, retry };
}
