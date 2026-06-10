import type { Timestamp } from 'firebase/firestore';
import type { TeamKey } from '../theme';

// /teams/{teamId}
export interface Team {
  id: string;
  name: string;
  sport: string;
  palette: TeamKey;
  managerIds: string[];
  inviteCode?: string;
  createdAt: Timestamp;
}

// /teams/{teamId}/members/{userId}
export interface Member {
  userId: string;
  displayName: string;
  jerseyNumber: number;
  role: 'manager' | 'player' | 'spare';
  email: string;
  joinedAt: Timestamp;
  autoIn?: boolean;
  pushToken?: string;
  notificationsEnabled?: boolean;
  remindersEnabled?: boolean;
  locationEnabled?: boolean;
}

// /teams/{teamId}/members/{userId}/blackouts/{docId}
export interface BlackoutDate {
  id: string;
  dates: string[]; // 'YYYY-MM-DD' strings
  label?: string;
  createdAt: Timestamp;
}

// /teams/{teamId}/events/{eventId}
export interface Event {
  id: string;
  type: 'game' | 'practice' | 'social';
  title: string;
  opponent?: string;
  venue: string;
  venueCoords?: { lat: number; lng: number };
  startsAt: Timestamp;
  endsAt: Timestamp;
  recurring: boolean;
  status?: 'active' | 'cancelled';
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
  status?: 'here';
  checkedInAt?: Timestamp;
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

// /users/{userId}/teams/{teamId}
export interface UserTeam {
  teamId: string;
  teamName: string;
  palette: TeamKey;
  role: 'manager' | 'player';
  joinedAt: Timestamp;
}

// /teams/{teamId}/dues/{userId}
export interface DuesRecord {
  userId: string;
  displayName: string;
  seasonAmount: number;
  amountPaid: number;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
  notes?: string;
  dueDate?: Timestamp;
  lastPaymentAt?: Timestamp;
}
