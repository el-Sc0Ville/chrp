import React, { createContext, useContext, useState } from 'react';

export type DateGroup = 'today' | 'yesterday' | 'earlier';

interface BaseNotif {
  id: string;
  date: DateGroup;
  timestamp: string;
  read: boolean;
}

export interface AvailabilityNotif extends BaseNotif {
  type: 'availability';
  eventId: string;
  opponent: string;
  weekday: string;
  time: string;
}

export interface AnnouncementNotif extends BaseNotif {
  type: 'announcement';
  authorName: string;
  body: string;
  announcementId: string;
}

export interface SubFilledNotif extends BaseNotif {
  type: 'sub_filled';
  subName: string;
  weekday: string;
  opponent: string;
}

export type AppNotification = AvailabilityNotif | AnnouncementNotif | SubFilledNotif;

interface NotificationContextValue {
  notifications: AppNotification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  markRead: () => {},
  markAllRead: () => {},
  unreadCount: 0,
});

const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    type: 'availability',
    date: 'today',
    timestamp: '1h ago',
    read: false,
    eventId: 'home_game',
    opponent: 'Wildcats',
    weekday: 'Sunday',
    time: '9:45 pm',
  },
  {
    id: 'n2',
    type: 'announcement',
    date: 'today',
    timestamp: '2h ago',
    read: false,
    authorName: 'Pat Normandin',
    body: 'Ice time has moved to 9:45 pm this Sunday. Gate C is still our meeting point — see you out there.',
    announcementId: 'ann1',
  },
  {
    id: 'n3',
    type: 'sub_filled',
    date: 'today',
    timestamp: '4h ago',
    read: true,
    subName: 'François Lapointe',
    weekday: 'Sunday',
    opponent: 'Wildcats',
  },
  {
    id: 'n4',
    type: 'availability',
    date: 'yesterday',
    timestamp: 'yesterday',
    read: true,
    eventId: 'game_ember',
    opponent: 'Ember FC',
    weekday: 'Friday',
    time: '8:00 pm',
  },
  {
    id: 'n5',
    type: 'announcement',
    date: 'yesterday',
    timestamp: 'yesterday',
    read: false,
    authorName: 'Marco Beauchamp',
    body: 'Reminder to update your availability for the playoff rounds — we need a final headcount by Thursday noon.',
    announcementId: 'ann3',
  },
];

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, markRead, markAllRead, unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
