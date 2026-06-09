import React, { createContext, useContext, useState } from 'react';

export type PlayerResponse = 'in' | 'out' | 'maybe' | null;

interface GameResponseContextValue {
  responses: Record<string, PlayerResponse>;
  setResponse: (eventId: string, response: PlayerResponse) => void;
}

export const GameResponseContext = createContext<GameResponseContextValue>({
  responses: {},
  setResponse: () => {},
});

export function GameResponseProvider({ children }: { children: React.ReactNode }) {
  const [responses, setResponses] = useState<Record<string, PlayerResponse>>({});

  const setResponse = (eventId: string, response: PlayerResponse) => {
    setResponses(prev => ({ ...prev, [eventId]: response }));
  };

  return (
    <GameResponseContext.Provider value={{ responses, setResponse }}>
      {children}
    </GameResponseContext.Provider>
  );
}

export function useGameResponse() {
  return useContext(GameResponseContext);
}
