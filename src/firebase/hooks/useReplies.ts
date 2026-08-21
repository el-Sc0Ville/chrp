import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config';
import type { AnnouncementReply } from '../schema';

interface UseRepliesResult {
  replies: AnnouncementReply[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useReplies(teamId: string, announcementId: string): UseRepliesResult {
  const [replies, setReplies] = useState<AnnouncementReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!teamId || !announcementId) { setLoading(false); return; }
    const ref = collection(db, 'teams', teamId, 'announcements', announcementId, 'replies');
    const q   = query(ref, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      snap => { setReplies(snap.docs.map(d => ({ id: d.id, ...d.data() }) as AnnouncementReply)); setLoading(false); setError(null); },
      err  => { setError(err.message); setLoading(false); },
    );
    return unsub;
  }, [teamId, announcementId, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt(n => n + 1);
  }, []);

  return { replies, loading, error, retry };
}
