import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { User } from '../firebase/auth';

interface UserContextValue {
  user: User | null;
  isManager: boolean;
  setMockUser: (user: User | null, isManager: boolean) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<User | null>(null);
  const [isManager, setIsManager] = useState(false);

  const setMockUser = (u: User | null, manager: boolean) => {
    setUser(u);
    setIsManager(manager);
  };

  return (
    <UserContext.Provider value={{ user, isManager, setMockUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserContext must be used within UserProvider');
  return ctx;
}
