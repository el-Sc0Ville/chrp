// Reporting, blocking and removal for user-generated content (announcements and
// replies). App Store guideline 1.2 requires every app with user content to let
// people report objectionable posts, block abusive users, and filter what gets
// posted; this module is the one place those rules live.
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { Alert } from 'react-native';
import {
  addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './firebase';
import { useUserContext } from './context/UserContext';
import * as haptics from './lib/haptics';

interface ModerationValue {
  // uid -> display name, so the Profile list can show who is blocked.
  blocked: Record<string, string>;
  // Content keys ("a:<announcementId>" / "r:<announcementId>/<replyId>") the
  // user reported; hidden for them straight away.
  hidden: Set<string>;
  isHidden: (authorId: string, key: string) => boolean;
  unblock: (uid: string) => Promise<void>;
}

const ModerationContext = createContext<ModerationValue>({
  blocked: {},
  hidden: new Set(),
  isHidden: () => false,
  unblock: async () => {},
});

export function ModerationProvider({ children }: { children: ReactNode }) {
  const { user } = useUserContext();
  const uid = user?.uid;
  const [blocked, setBlocked] = useState<Record<string, string>>({});
  const [hiddenList, setHiddenList] = useState<string[]>([]);

  useEffect(() => {
    setBlocked({});
    setHiddenList([]);
    if (!uid) return;
    return onSnapshot(
      doc(db, 'users', uid),
      snap => {
        const data = snap.data() ?? {};
        setBlocked((data['blockedUsers'] as Record<string, string>) ?? {});
        setHiddenList((data['hiddenContent'] as string[]) ?? []);
      },
      err => console.error('[Moderation] profile listener failed:', err),
    );
  }, [uid]);

  const hidden = useMemo(() => new Set(hiddenList), [hiddenList]);
  const isHidden = useCallback(
    (authorId: string, key: string) => authorId in blocked || hidden.has(key),
    [blocked, hidden],
  );
  const unblock = useCallback(async (blockedUid: string) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid), { [`blockedUsers.${blockedUid}`]: deleteField() });
  }, [uid]);

  const value = useMemo(() => ({ blocked, hidden, isHidden, unblock }), [blocked, hidden, isHidden, unblock]);
  return <ModerationContext.Provider value={value}>{children}</ModerationContext.Provider>;
}

export function useModeration(): ModerationValue {
  return useContext(ModerationContext);
}

export const announcementKey = (announcementId: string) => `a:${announcementId}`;
export const replyKey = (announcementId: string, replyId: string) => `r:${announcementId}/${replyId}`;

export interface ContentTarget {
  teamId: string;
  announcementId: string;
  replyId?: string;
  authorId: string;
  authorName: string;
  body: string;
}

async function fileReport(target: ContentTarget, reporterId: string, reason: 'reported' | 'blocked') {
  await addDoc(collection(db, 'reports'), {
    teamId: target.teamId,
    announcementId: target.announcementId,
    replyId: target.replyId ?? null,
    contentAuthorId: target.authorId,
    contentAuthorName: target.authorName,
    // A copy, so the report survives the post being edited or deleted.
    body: target.body.slice(0, 1000),
    reporterId,
    reason,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

/**
 * The ⋯ menu for an announcement or reply. Offers what the viewer may do:
 *  - their own post: Delete
 *  - someone else's, viewer is a manager: Delete, Block
 *  - someone else's, viewer is a player: Report, Block
 * Alert keeps this to three buttons, the most Android shows.
 */
export function openContentMenu(
  target: ContentTarget,
  viewer: { uid: string; isManager: boolean },
  onDeleted?: () => void,
) {
  const isOwn = target.authorId === viewer.uid;
  const what = target.replyId ? 'reply' : 'announcement';
  const contentRef = target.replyId
    ? doc(db, 'teams', target.teamId, 'announcements', target.announcementId, 'replies', target.replyId)
    : doc(db, 'teams', target.teamId, 'announcements', target.announcementId);
  const key = target.replyId ? replyKey(target.announcementId, target.replyId) : announcementKey(target.announcementId);

  const confirmDelete = () => Alert.alert(
    `Delete this ${what}?`,
    isOwn ? 'It will be removed for everyone.' : `${target.authorName}'s ${what} will be removed for everyone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(contentRef);
            haptics.success();
            onDeleted?.();
          } catch (err) {
            console.error('[Moderation] delete failed:', err);
            haptics.error();
            Alert.alert("Couldn't delete", 'Please try again.');
          }
        },
      },
    ],
  );

  const report = async () => {
    try {
      await fileReport(target, viewer.uid, 'reported');
      await setDoc(doc(db, 'users', viewer.uid), { hiddenContent: arrayUnion(key) }, { merge: true });
      haptics.success();
      Alert.alert(
        'Thanks for reporting',
        `This ${what} is now hidden for you. Your team's managers and the Chrp team have been notified and will review it within 24 hours.`,
      );
    } catch (err) {
      console.error('[Moderation] report failed:', err);
      haptics.error();
      Alert.alert("Couldn't send report", 'Please try again.');
    }
  };

  const confirmBlock = () => Alert.alert(
    `Block ${target.authorName}?`,
    `You won't see their announcements or replies anymore. They aren't told. You can unblock them from your Profile.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block', style: 'destructive',
        onPress: async () => {
          try {
            await setDoc(
              doc(db, 'users', viewer.uid),
              { blockedUsers: { [target.authorId]: target.authorName } },
              { merge: true },
            );
            // Blocking signals abuse; the Chrp team is told as well.
            await fileReport(target, viewer.uid, 'blocked').catch(err =>
              console.error('[Moderation] block report failed:', err),
            );
            haptics.success();
          } catch (err) {
            console.error('[Moderation] block failed:', err);
            haptics.error();
            Alert.alert("Couldn't block", 'Please try again.');
          }
        },
      },
    ],
  );

  if (isOwn) {
    Alert.alert(`Your ${what}`, undefined, [
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  } else if (viewer.isManager) {
    Alert.alert(`${target.authorName}'s ${what}`, undefined, [
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      { text: `Block ${target.authorName}`, onPress: confirmBlock },
      { text: 'Cancel', style: 'cancel' },
    ]);
  } else {
    Alert.alert(`${target.authorName}'s ${what}`, undefined, [
      { text: 'Report', style: 'destructive', onPress: report },
      { text: `Block ${target.authorName}`, onPress: confirmBlock },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
}
