import type { Timestamp } from 'firebase/firestore';

// /teams/{teamId}
export interface Team {
  id: string;
  name: string;
  sport: string;
  palette: 'trashdogs' | 'ember' | 'verdant' | 'solstice' | 'aurora';
  managerIds: string[];
  createdAt: Timestamp;
}

// /teams/{teamId}/members/{userId}
export interface Member {
  userId: string;
  displayName: string;
  jerseyNumber: number;
  role: 'manager' | 'player';
  email: string;
  joinedAt: Timestamp;
}

// /teams/{teamId}/events/{eventId}
export interface Event {
  id: string;
  type: 'game' | 'practice' | 'social';
  title: string;
  opponent?: string;
  venue: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  recurring: boolean;
  scoreUs?: number;
  scoreThem?: number;
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
}

// /teams/{teamId}/events/{eventId}/responses/{userId}
export interface AvailabilityResponse {
  userId: string;
  displayName: string;
  response: 'in' | 'out' | 'maybe';
  respondedAt: Timestamp;
  setByManager: boolean;
}

// /teams/{teamId}/announcements/{announcementId}
export interface Announcement {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  pinned: boolean;
  createdAt: Timestamp;
}

// /teams/{teamId}/announcements/{announcementId}/replies/{replyId}
export interface AnnouncementReply {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Timestamp;
}

// /teams/{teamId}/subRequests/{requestId}
export interface SubRequest {
  id: string;
  eventId: string;
  requestedBy: string;
  requestedByName: string;
  reason?: string;
  status: 'pending' | 'filled' | 'cancelled';
  filledBy?: string;
  createdAt: Timestamp;
  opponent: string;
  gameWeekday: string;
  gameDay: string;
  gameMonth: string;
  gameVenue: string;
  gameTime: string;
}

// /teams/{teamId}/dues/{userId}
export interface DuesRecord {
  userId: string;
  displayName: string;
  seasonAmount: number;
  amountPaid: number;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
  notes?: string;
  lastPaymentAt?: Timestamp;
}
