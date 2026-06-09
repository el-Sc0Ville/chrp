import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config';
import type { AnnouncementReply } from '../schema';

interface UseRepliesResult {
  replies: AnnouncementReply[];
  loading: boolean;
}

export function useReplies(teamId: string, announcementId: string): UseRepliesResult {
  const [replies, setReplies] = useState<AnnouncementReply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !announcementId) { setLoading(false); return; }
    const ref = collection(db, 'teams', teamId, 'announcements', announcementId, 'replies');
    const q   = query(ref, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      snap => { setReplies(snap.docs.map(d => ({ id: d.id, ...d.data() }) as AnnouncementReply)); setLoading(false); },
      ()   => setLoading(false),
    );
    return unsub;
  }, [teamId, announcementId]);

  return { replies, loading };
}
