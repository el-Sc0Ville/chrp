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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

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
