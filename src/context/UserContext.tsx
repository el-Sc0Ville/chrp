import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { User } from '../firebase/auth';
import type { TeamKey } from '../theme';

interface UserContextValue {
  user: User | null;
  isManager: boolean;
  setMockUser: (user: User | null, isManager: boolean) => void;
  activeTeamId: string;
  setActiveTeamId: (id: string) => void;
  activeTeamPalette: TeamKey;
  setActiveTeamPalette: (palette: TeamKey) => void;
  needsOnboarding: boolean | undefined;
  setNeedsOnboarding: (v: boolean | undefined) => void;
  completeOnboarding: (teamId: string, palette: TeamKey, isManagerRole: boolean) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<User | null>(null);
  const [isManager, setIsManager] = useState(false);
  // Empty until a real team is resolved from Firestore after sign-in. This used
  // to default to the literal 'trashdogs', so on every cold start (and forever,
  // if the teams lookup failed) every hook subscribed to teams/trashdogs/** —
  // paths the rules deny, which surfaced as a plausible-looking empty app rather
  // than an error. Every hook already no-ops on an empty teamId.
  const [activeTeamId,      setActiveTeamId]      = useState('');
  const [activeTeamPalette, setActiveTeamPalette] = useState<TeamKey>('trashdogs');
  const [needsOnboarding, setNeedsOnboarding]     = useState<boolean | undefined>(undefined);

  const setMockUser = (u: User | null, manager: boolean) => {
    setUser(u);
    setIsManager(manager);
  };

  const completeOnboarding = (teamId: string, palette: TeamKey, isManagerRole: boolean) => {
    setActiveTeamId(teamId);
    setActiveTeamPalette(palette);
    setIsManager(isManagerRole);
    setNeedsOnboarding(false);
  };

  return (
    <UserContext.Provider value={{
      user, isManager, setMockUser,
      activeTeamId, setActiveTeamId,
      activeTeamPalette, setActiveTeamPalette,
      needsOnboarding, setNeedsOnboarding,
      completeOnboarding,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserContext must be used within UserProvider');
  return ctx;
}
