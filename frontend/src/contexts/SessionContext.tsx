import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { SessionInfo } from '../components/SessionsList/SessionsList';

interface SessionContextType {
  // Current session
  currentSession: SessionInfo | null;
  setCurrentSession: (session: SessionInfo | null) => void;
  
  // Sessions list visibility
  showSessionsList: boolean;
  setShowSessionsList: (show: boolean) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const [showSessionsList, setShowSessionsList] = useState(true);

  const value: SessionContextType = {
    currentSession,
    setCurrentSession,
    showSessionsList,
    setShowSessionsList,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}