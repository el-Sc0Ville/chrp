import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config';
import type { Member } from '../schema';

interface UseMembersResult {
  members: Member[];
  loading: boolean;
  error: string | null;
}

export function useMembers(teamId: string): UseMembersResult {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const ref = collection(db, 'teams', teamId, 'members');
    const q   = query(ref, orderBy('displayName', 'asc'));
    const unsub = onSnapshot(
      q,
      snap => { setMembers(snap.docs.map(d => d.data() as Member)); setLoading(false); setError(null); },
      err  => { setError(err.message); setLoading(false); },
    );
    return unsub;
  }, [teamId]);

  return { members, loading, error };
}
