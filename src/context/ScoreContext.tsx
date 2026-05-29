import React, { createContext, useContext, useState } from 'react';

export interface Score { us: number; them: number }
export type ScoreResult = 'win' | 'loss' | 'tie';

interface ScoreContextValue {
  scores: Record<string, Score>;
  setScore: (eventId: string, score: Score) => void;
}

export const ScoreContext = createContext<ScoreContextValue>({
  scores: {},
  setScore: () => {},
});

// Seeded to match ScheduleScreen static p1 data ("W 4–2")
const SEED: Record<string, Score> = {
  p1: { us: 4, them: 2 },
};

export function ScoreProvider({ children }: { children: React.ReactNode }) {
  const [scores, setScores] = useState<Record<string, Score>>(SEED);

  const setScore = (eventId: string, score: Score) => {
    setScores(prev => ({ ...prev, [eventId]: score }));
  };

  return (
    <ScoreContext.Provider value={{ scores, setScore }}>
      {children}
    </ScoreContext.Provider>
  );
}

export function useScores() {
  return useContext(ScoreContext);
}

export function scoreResult(us: number, them: number): ScoreResult {
  if (us > them) return 'win';
  if (us < them) return 'loss';
  return 'tie';
}

export function scoreLabel(us: number, them: number): string {
  const prefix = us > them ? 'W' : us < them ? 'L' : 'T';
  return `${prefix} ${us}–${them}`;
}
