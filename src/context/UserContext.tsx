import React, {
  createContext, useContext, useState, useCallback, useMemo, type ReactNode,
} from 'react';
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

  // These MUST keep a stable identity across renders. They are handed to
  // consumers that put them in effect dependency arrays; when they were plain
  // functions, every provider render produced new ones, so any such effect
  // re-ran on every render. In the auth effect that meant resubscribing to
  // onAuthStateChanged, which immediately set state again — an infinite loop
  // that presented as the launch screen flickering after sign-in.
  const setMockUser = useCallback((u: User | null, manager: boolean) => {
    setUser(u);
    setIsManager(manager);
  }, []);

  const completeOnboarding = useCallback(
    (teamId: string, palette: TeamKey, isManagerRole: boolean) => {
      setActiveTeamId(teamId);
      setActiveTeamPalette(palette);
      setIsManager(isManagerRole);
      setNeedsOnboarding(false);
    },
    [],
  );

  // Memoised for the same reason, and because a fresh object here re-renders
  // every consumer of the context on any state change anywhere in it.
  // The bare setState functions from useState are already stable.
  const value = useMemo<UserContextValue>(() => ({
    user, isManager, setMockUser,
    activeTeamId, setActiveTeamId,
    activeTeamPalette, setActiveTeamPalette,
    needsOnboarding, setNeedsOnboarding,
    completeOnboarding,
  }), [
    user, isManager, setMockUser,
    activeTeamId, activeTeamPalette,
    needsOnboarding, completeOnboarding,
  ]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserContext must be used within UserProvider');
  return ctx;
}
